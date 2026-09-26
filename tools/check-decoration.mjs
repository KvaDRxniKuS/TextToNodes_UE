#!/usr/bin/env node
/**
 * Критерии приёмки ступени 3 (декоратора) по ТЗ — проверка по TEXT'у двух ступеней.
 *
 *   node tools/check-decoration.mjs [код-на-входе tests/….stage2-arranger.txt] [код ступени 3]
 *
 * Проверяется ровно то, что обещано правилом «берёт XY пинов соединённых нод, двигает ноды
 * так, чтобы Y подходящих пинов совпадали, и оставляет зазор в 5 шагов сетки по X»:
 *   A. у каждой связи, укладывающейся в один уровень, Y выходов и входов совпадают (пин в пин);
 *   B. соседние ноды уровня стоят ровно через `clearance` (по умолчанию 5 * grid = 80);
 *   C. knot-переносы: X первого = X пина-выхода источника, X второго = X пина-входа цели,
 *      Y общего отрезка — в щели между уровнями;
 *   D. ноды не наложились друг на друга;
 *   E. состав уровней не изменился (декоратор не переставлял ноды между рядами и не трогал
 *      код нод / провода);
 *   F. ядро уровня на месте: узел с exec-пинами, которому в уровне нечем выровнять Y (событие или
 *      вход через knot-перенос), декоратор не двигает вовсе — на нём держится вся раскладка ряда.
 *   A/B/C/F считаются по модели пинов из `src/generator.js` (это та же модель, что у ступеней 1—2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseToGraphs } from '../src/parser.js';
import { estNodeWidth, estNodeHeight, pinCenterY, GRID } from '../src/generator.js';
import { flatLinks, buildLevels, pinCenterX, isKnot, KNOT_W } from '../src/decorator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const IN = path.resolve(argv[0] || path.join(ROOT, 'tests/three-stage-01.stage2-arranger.txt'));
const OUT = path.resolve(argv[1] || path.join(ROOT, 'tests/three-stage-01.stage3-decorator.txt'));
const grid = GRID;
const clearance = argv[2] ? Number(argv[2]) : 5 * grid;

const nodes = parseToGraphs(fs.readFileSync(OUT, 'utf8')).EventGraph.nodes;
const before = parseToGraphs(fs.readFileSync(IN, 'utf8')).EventGraph.nodes;
const real = nodes.filter(n => !isKnot(n));
const links = flatLinks(nodes);
const levels = buildLevels(real);
const levelOf = new Map();
levels.forEach((l, i) => l.nodes.forEach(n => levelOf.set(n.id, i)));

const problems = [];
let aligned = 0, sameLevel = 0;
for (const l of links) {
  if (levelOf.get(l.source.id) !== levelOf.get(l.target.id)) continue;
  sameLevel++;
  const ys = pinCenterY(l.source, l.out), yt = pinCenterY(l.target, l.input);
  if (ys !== yt) problems.push(`A: ${l.source.id}.${l.out.name} (y=${ys}) ≠ ${l.target.id}.${l.input.name} (y=${yt}) — пины не совмещены`);
  else aligned++;
}

// B: зазор между соседними нодами уровня по X
let gaps = 0;
for (const l of levels) {
  const ordered = l.nodes.slice().sort((a, b) => a.pos.x - b.pos.x);
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1], cur = ordered[i];
    const gap = cur.pos.x - (prev.pos.x + estNodeWidth(prev));
    if (gap < clearance - 1) problems.push(`B: ${cur.id} стоит в ${gap}px от ${prev.id} (нужно ≥ ${clearance})`);
    else gaps++;
  }
}

// C: knot-переносы по пинам концов + коридор
let knotsOk = 0;
const knotNodes = nodes.filter(isKnot);
for (const l of links) {
  if (!l.via.length) continue;
  const first = l.via[0], last = l.via[l.via.length - 1];
  const wantFirst = pinCenterX(l.source, l.out);
  const wantLast = pinCenterX(l.target, l.input) - (l.via.length > 1 ? KNOT_W : 0);
  if (first.pos.x !== wantFirst) problems.push(`C: ${first.id}.x = ${first.pos.x}, а пин-выход ${l.source.id}.${l.out.name} на x=${wantFirst}`);
  else if (last.pos.x !== wantLast) problems.push(`C: ${last.id}.x = ${last.pos.x}, а пин-вход ${l.target.id}.${l.input.name} на x=${wantLast + (l.via.length > 1 ? KNOT_W : 0)}`);
  else if (l.via.some(k => k.pos.y !== first.pos.y)) problems.push(`C: knot'ы пары на разных Y (${l.via.map(k => k.pos.y)}) — горизонтальный участок переноса сломан`);
  else {
    const ls = levelOf.get(l.source.id), lt = levelOf.get(l.target.id);
    const band = ls === lt ? null : (lt > ls
      ? [Math.max(...levels.slice(ls, lt).map(x => x.bottom)), levels[lt].top]
      : [levels[lt].bottom, Math.min(...levels.slice(lt + 1, ls + 1).map(x => x.top))]);
    if (band && !(first.pos.y >= Math.min(...band) && first.pos.y <= Math.max(...band))) {
      problems.push(`C: перенос ${l.source.id} → ${l.target.id} на y=${first.pos.y} вне щели ${band[0]}…${band[1]} между уровнями`);
    } else knotsOk++;
  }
}
const orphanKnots = knotNodes.filter(k => !links.some(l => l.via.includes(k)));
if (orphanKnots.length) problems.push(`C: knot'ы без связи через перенос: ${orphanKnots.map(k => k.id).join(', ')}`);

// D: наложения
const rect = n => ({ x1: n.pos.x, x2: n.pos.x + estNodeWidth(n), y1: n.pos.y, y2: n.pos.y + estNodeHeight(n) });
for (let i = 0; i < real.length; i++) for (let j = i + 1; j < real.length; j++) {
  const a = rect(real[i]), b = rect(real[j]);
  if (a.x1 < b.x2 - 1 && b.x1 < a.x2 - 1 && a.y1 < b.y2 - 1 && b.y1 < a.y2 - 1) problems.push(`D: ${real[i].id} перекрывает ${real[j].id}`);
}

// E: состав уровней и код нод
const beforeLevels = buildLevels(before.filter(n => !isKnot(n)));
const signature = ls => ls.map(l => l.nodes.map(n => n.id).sort().join(' ')).sort().join(' | ');
if (signature(beforeLevels) !== signature(levels)) {
  problems.push('E: состав уровней изменился — расстановщик построил не то, что оставил декоратор');
  console.log('  было:', signature(beforeLevels));
  console.log('  стало:', signature(levels));
}
const byIdBefore = new Map(before.map(n => [n.id, n]));
const codeOf = n => n.rawBlock.split(/\r?\n/).filter(l => !/^\s*Node(PosX|PosY)=/.test(l)).join('\n');
for (const n of nodes) {
  const b = byIdBefore.get(n.id);
  if (!b) { problems.push(`E: ${n.id} — нода появилась на ступени 3 (декоратор не создаёт ноды)`); continue; }
  if (codeOf(n) !== codeOf(b)) problems.push(`E: ${n.id} — изменён код/провода (ступень 3 вправе двигать только координаты)`);
}

// F: exec-якоря уровней (события и входы через перенос) не сдвигаются ни на пиксель
const beforeLevels2 = buildLevels(before.filter(n => !isKnot(n)));
const beforeIds = new Map(before.map(n => [n.id, n]));
let anchorsOk = 0;
for (const l of levels) {
  const mine = new Set(l.nodes.map(n => n.id));
  for (const n of l.nodes) {
    if (!(n.pins || []).some(p => p.category === 'exec')) continue;
    if (links.some(x => x.target === n && mine.has(x.source.id))) continue; // выровнен по соседу ряда
    const b = beforeIds.get(n.id);
    if (b && (b.pos.x !== n.pos.x || b.pos.y !== n.pos.y)) {
      problems.push(`F: ${n.id} — ядро уровня сдвинуто с (${b.pos.x},${b.pos.y}) на (${n.pos.x},${n.pos.y}): расстановщик так не ставил`);
    } else if (b) anchorsOk++;
  }
}

console.log(`${path.relative(ROOT, OUT)} против ${path.relative(ROOT, IN)} · зазор ${clearance}px (5 × сетка ${grid})`);
console.log(`  уровней=${levels.length} · связей в уровне=${sameLevel}, из них пин-в-пин=${aligned}`
  + ` · зазоров=OK ${gaps} · knot-пар по пинам=${knotsOk} · якорей уровней не тронуто=${anchorsOk} · наложений=0 · код нод не тронут`);
if (problems.length) {
  console.log(`\n✗ нарушений: ${problems.length}`);
  problems.forEach(p => console.log('  ! ' + p));
  process.exit(1);
}
console.log('✓ ступень 3 соответствует ТЗ: пины совмещены, зазор 5 клеток, переносы по пинам в коридоре, уровни сохранены');

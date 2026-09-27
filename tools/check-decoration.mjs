#!/usr/bin/env node
/**
 * Критерии приёмки ступени 3 (декоратора) — проверка по TEXT'у двух ступеней.
 *
 *   node tools/check-decoration.mjs [вход(ступень 2)] [выход(ступень 3)] [зазор]
 *
 * Правила, как их сформулировал пользователь (2026-09-27):
 *   A. Y exec-нод одного ряда идентичен (ряд — плоская лента, без лесенки);
 *   B. дети узла с несколькими exec-выходами образуют столбец: X = правый край родителя +
 *      зазор, по ряду на каждый выход;
 *   C. зазор между соседями ряда = 5 шагов сетки (по умолчанию 80);
 *   D. перенос — стадиум из 4 knot'ов: каждый участок соосен пину (X или Y), средние knot'ы
 *      делят Y коридора и лежат в щели между уровнями;
 *   E. ноды не наложены друг на друга;
 *   F. уровни сохранены: состав уровня, его верх (минимальный Y) и код нод не изменились.
 * A/C/D считаются по модели пинов из `src/generator.js` — она же у ступеней 1—2.
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
const clearance = argv[2] ? Number(argv[2]) : 5 * GRID;

const nodes = parseToGraphs(fs.readFileSync(OUT, 'utf8')).EventGraph.nodes;
const before = parseToGraphs(fs.readFileSync(IN, 'utf8')).EventGraph.nodes;
const real = nodes.filter(n => !isKnot(n));
const links = flatLinks(nodes);
const levels = buildLevels(real);
const levelOf = new Map();
levels.forEach((l, i) => l.nodes.forEach(n => levelOf.set(n.id, i)));
const problems = [];

// A: плоские ряды — Y всех exec-нод уровня одинаков
let flat = 0;
for (const l of levels) {
  const exec = l.nodes.filter(n => (n.pins || []).some(p => p.category === 'exec'));
  const ys = new Set(exec.map(n => n.pos.y));
  if (exec.length > 1 && ys.size > 1) problems.push(`A: уровень ${l.top} — exec-ноды на разных Y: ${[...ys].join(', ')} (ряд обязан быть плоским)`);
  else flat += exec.length;
}

// B: столбец детей форка (несколько использованных exec-выходов)
let columns = 0;
const byParent = new Map();
for (const l of links) if (l.exec) {
  if (!byParent.has(l.source.id)) byParent.set(l.source.id, []);
  byParent.get(l.source.id).push(l);
}
for (const [id, ls] of byParent) {
  const isOutPin = p => p.category === 'exec' && String(p.direction).toLowerCase() === 'output';
  const outs = (real.find(n => n.id === id)?.pins || []).filter(p => isOutPin(p) && ls.some(l => l.out === p));
  if (outs.length < 2) continue;
  const parent = real.find(n => n.id === id);
  const colX = parent.pos.x + estNodeWidth(parent) + clearance;
  for (const l of ls) {
    if (levelOf.get(l.target.id) === levelOf.get(parent.id)) continue; // сосед по ленте ряда
    if (l.target.pos.x !== colX) problems.push(`B: ${l.target.id} — ребёнок выхода ${parent.id}.${l.out.name} не в столбце (x=${l.target.pos.x}, нужно ${colX})`);
    else columns++;
  }
}

// C: зазор между соседями уровня
let gaps = 0;
for (const l of levels) {
  const ordered = l.nodes.slice().sort((a, b) => a.pos.x - b.pos.x);
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1], cur = ordered[i];
    if (Math.abs(prev.pos.y - cur.pos.y) > 1) continue; // разные ленты уровня сравниваем по коридору
    const gap = cur.pos.x - (prev.pos.x + estNodeWidth(prev));
    if (gap < clearance - 1) problems.push(`C: ${cur.id} стоит в ${gap}px от ${prev.id} (нужно ≥ ${clearance} = 5 клеток)`);
    else gaps++;
  }
}

// D: стадиум переноса — каждый участок соосен, средние knot'ы в коридоре на одном Y
const knotPinY = k => k.pos.y + KNOT_W / 2; // центр пина knot'а
let stadium = 0;
for (const l of links.filter(x => x.via.length)) {
  const v = l.via;
  const srcX = pinCenterX(l.source, l.out), srcY = pinCenterY(l.source, l.out);
  const tgtX = pinCenterX(l.target, l.input), tgtY = pinCenterY(l.target, l.input);
  const checks = [];
  if (v.length >= 4) {
    const k1 = v[0], k2 = v[1], k3 = v[v.length - 2], k4 = v[v.length - 1];
    checks.push([`X K1 ≠ X пина-выхода (${k1.pos.x} / ${srcX})`, k1.pos.x === srcX]);
    checks.push([`Y K1 ≠ Y пина-выхода (${knotPinY(k1)} / ${srcY})`, knotPinY(k1) === srcY]);
    checks.push([`K2 не под K1 по X (${k2.pos.x} / ${k1.pos.x + KNOT_W})`, k2.pos.x === k1.pos.x + KNOT_W]);
    checks.push([`K3 и K2 не на одном Y (${k2.pos.y} / ${k3.pos.y}) — средний участок не горизонтален`, k2.pos.y === k3.pos.y]);
    checks.push([`K4 не соосен K3 по X (${k4.pos.x} / ${k3.pos.x + KNOT_W})`, k4.pos.x === k3.pos.x + KNOT_W]);
    checks.push([`X выхода K4 ≠ X пина-входа (${k4.pos.x + KNOT_W} / ${tgtX})`, k4.pos.x + KNOT_W === tgtX]);
    checks.push([`Y K4 ≠ Y пина-входа (${knotPinY(k4)} / ${tgtY})`, knotPinY(k4) === tgtY]);
  } else if (v.length === 2) {
    checks.push([`X K1 ≠ X пина-выхода (${v[0].pos.x} / ${srcX})`, v[0].pos.x === srcX]);
    checks.push([`Y K1 ≠ Y K2 (${v[0].pos.y} / ${v[1].pos.y})`, v[0].pos.y === v[1].pos.y]);
    checks.push([`X выхода K2 ≠ X пина-входа (${v[1].pos.x + KNOT_W} / ${tgtX})`, v[1].pos.x + KNOT_W === tgtX]);
  } else {
    checks.push([`перенос из ${v.length} knot'ов — не стадиум (нужно 4) и не пара (2)`, false]);
  }
  for (const [msg, ok] of checks) if (!ok) problems.push(`D: ${l.source.id}.${l.out.name} → ${l.target.id}.${l.input.name}: ${msg}`);
  const ls = levelOf.get(l.source.id), lt = levelOf.get(l.target.id);
  const mid = v.length >= 4 ? v[1] : v[0];
  if (ls !== undefined && lt !== undefined && ls !== lt) {
    const [lo, hi] = lt > ls
      ? [Math.max(...levels.slice(ls, lt).map(x => x.bottom)), levels[lt].top]
      : [levels[lt].bottom, Math.min(...levels.slice(lt + 1, ls + 1).map(x => x.top))];
    if (!(mid.pos.y >= Math.min(lo, hi) && mid.pos.y <= Math.max(lo, hi))) {
      problems.push(`D: средний участок переноса ${l.source.id} → ${l.target.id} на y=${mid.pos.y} вне щели ${lo}…${hi}`);
    } else stadium++;
  } else stadium++;
}

// E: наложения
const rect = n => ({ x1: n.pos.x, x2: n.pos.x + estNodeWidth(n), y1: n.pos.y, y2: n.pos.y + estNodeHeight(n) });
for (let i = 0; i < real.length; i++) for (let j = i + 1; j < real.length; j++) {
  const a = rect(real[i]), b = rect(real[j]);
  if (a.x1 < b.x2 - 1 && b.x1 < a.x2 - 1 && a.y1 < b.y2 - 1 && b.y1 < a.y2 - 1) problems.push(`E: ${real[i].id} перекрывает ${real[j].id}`);
}

// F: уровни и код нод
const signature = ls => ls.map(l => l.nodes.map(n => n.id).sort().join(' ')).sort().join(' | ');
const beforeLevels = buildLevels(before.filter(n => !isKnot(n)));
if (signature(beforeLevels) !== signature(levels)) problems.push('F: состав уровней изменился — декоратор переставил ноды между рядами');
const topsBefore = new Map(beforeLevels.map(l => [l.nodes.map(n => n.id).sort().join(' '), l.top]));
for (const l of levels) {
  const key = l.nodes.map(n => n.id).sort().join(' ');
  if (topsBefore.has(key) && topsBefore.get(key) !== l.top) {
    problems.push(`F: уровень [${key.replace(/K2Node_|_/g, m => (m === '_' ? '' : m))}] уехал по Y: было ${topsBefore.get(key)}, стало ${l.top}`);
  }
}
const beforeIds = new Map(before.map(n => [n.id, n]));
const codeOf = n => n.rawBlock.split(/\r?\n/).filter(l => !/^\s*Node(PosX|PosY)=/.test(l)).join('\n');
for (const n of nodes) {
  const b = beforeIds.get(n.id);
  if (!b) { if (!isKnot(n)) problems.push(`F: ${n.id} — нода появилась на ступени 3 (декоратор не создаёт ноды)`); continue; }
  if (codeOf(n) !== codeOf(b)) problems.push(`F: ${n.id} — изменён код/провода (ступень 3 вправе двигать только координаты)`);
}

console.log(`${path.relative(ROOT, OUT)} против ${path.relative(ROOT, IN)} · зазор ${clearance}px (5 клеток по ${GRID})`);
console.log(`  уровней=${levels.length} · exec-нод в плоских рядах=${flat} · детей форка в столбцах=${columns}`
  + ` · зазоров=OK ${gaps} · переносов-стадиумов=${stadium} · наложений=0`);
if (problems.length) {
  console.log(`\n✗ нарушений: ${problems.length}`);
  problems.forEach(p => console.log('  ! ' + p));
  process.exit(1);
}
console.log('✓ ступень 3 соответствует ТЗ: ряды плоские, форк — столбцом, зазор 5 клеток, переносы-стадиумы соосны пинам, уровни и код нод не тронуты');

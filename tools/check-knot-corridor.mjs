#!/usr/bin/env node
/**
 * Текстовый контроль геометрии knot-переносов (ступень 2; ступень 3 — по желанию).
 *
 * Контракт (вердикт пользователя 2026-09-28: «первые два и последние два выровнены по Y между
 * собой»): перенос — стадиум из 4 knot'ов, где
 *   · K1 и K2 лежат НА СТРОКЕ ПИНА-ВЫХОДА источника (общий Y),
 *   · K3 и K4 — НА СТРОКЕ ПИНА-ВХОДА цели (общий Y),
 *   · K2 и K3 стоят на одном X (выход K2 = вход K3) → между ними строго вертикальный участок,
 *   · K1 сидит на пине-выходе, выход K4 — на пине-входа (провода по нулевой длине),
 *   · вертикаль переноса идёт по СВОБОДНОЙ КОЛОНКЕ: не перечёркивает прямоугольники нод,
 *     а внутри ряда knot'ы не вылезают за щель между соседями.
 * С 2026-10-01 соседние knot'ы ближе MIN_KNOT_GAP сливаются → переносы из 1–3 knot'ов тоже законны;
 * проверяется: K1 на пине-выходе, последний knot на строке входа, соседи не ближе порога.
 *
 * Использование:
 *   node tools/check-knot-corridor.mjs [tests/three-stage-01.stage2-arranger.txt]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseToGraphs } from '../src/parser.js';
import { estNodeWidth, estNodeHeight, pinCenterY } from '../src/generator.js';
import { MIN_KNOT_GAP } from '../src/arranger.js';
import { isKnot, flatLinks, buildLevels, pinCenterX, KNOT_W } from '../src/decorator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'tests/three-stage-01.stage2-arranger.txt');
const nodes = parseToGraphs(fs.readFileSync(file, 'utf8')).EventGraph.nodes;
const real = nodes.filter(n => !isKnot(n));
const knots = nodes.filter(isKnot);
const levels = buildLevels(real);
const levelOf = new Map();
levels.forEach((l, i) => l.nodes.forEach(n => levelOf.set(n.id, i)));

console.log(`${path.relative(ROOT, file)} — knot'ов: ${knots.length}, уровней: ${levels.length}`);
levels.forEach((l, i) => console.log(`  уровень ${i}: Y ${l.top}…${l.bottom}  [${l.nodes.map(n => n.id.split('_').slice(-1)[0]).join(', ')}]`));

const knotPinY = (k) => k.pos.y + KNOT_W / 2;   // центр пина knot'а
let bad = 0, checked = 0;

for (const l of flatLinks(nodes).filter(x => x.via.length)) {
  checked++;
  const v = l.via;
  const srcPinY = pinCenterY(l.source, l.out), tgtPinY = pinCenterY(l.target, l.input);
  const xOut = pinCenterX(l.source, l.out), xIn = pinCenterX(l.target, l.input);
  const problems = [];
  let vx = null;
  // стадиум K1..K4 после слияния близких knot'ов (правило 2026-10-01, MIN_KNOT_GAP): 1–4 knot'а
  if (!v.length || v.length > 4) problems.push(`перенос из ${v.length} knot'ов`);
  else {
    const first = v[0], last = v[v.length - 1];
    const srcBottom = l.source.pos.y + estNodeHeight(l.source);
    if (knotPinY(first) !== srcPinY) problems.push(`K1 не на строке пина-выхода: Y ${knotPinY(first)} / ${srcPinY}`);
    if (v.length === 4) {
      if (v[1].pos.x !== first.pos.x) problems.push(`K2 не под K1`);
      if (knotPinY(v[1]) < srcBottom) problems.push(`линия щели выше низа источника: ${knotPinY(v[1])} < ${srcBottom}`);
      if (v[1].pos.y !== v[2].pos.y) problems.push(`K2·K3 не на одной линии щели`);
      if (v[2].pos.x !== v[3].pos.x) problems.push(`K3·K4 не в одной колонке`);
    }
    if (first.pos.x !== xOut) problems.push(`K1 не на пине-выходе: x=${first.pos.x} / ${xOut}`);
    if (v.length > 1 && knotPinY(last) !== tgtPinY) problems.push(`последний knot не на строке пина-входа: Y ${knotPinY(last)} / ${tgtPinY}`);
    for (let q = 1; q < v.length; q++) {
      const d = Math.max(Math.abs(v[q].pos.x - v[q - 1].pos.x), Math.abs(v[q].pos.y - v[q - 1].pos.y));
      if (d < MIN_KNOT_GAP) problems.push(`соседние knot'ы ближе ${MIN_KNOT_GAP}px (${d})`);
    }
    vx = last.pos.x;
  }

  const ls = levelOf.get(l.source.id), lt = levelOf.get(l.target.id);
  const crossLevel = ls !== undefined && lt !== undefined && ls !== lt;
  if (crossLevel && vx !== null) {
    // вертикальный участок переноса: свободная колонка на всём его диапазоне Y
    const y0 = Math.min(srcPinY, tgtPinY), y1 = Math.max(srcPinY, tgtPinY);
    const crossed = real.filter(n => n.id !== l.source.id && n.id !== l.target.id)
      .filter(n => vx > n.pos.x && vx < n.pos.x + estNodeWidth(n) && y1 > n.pos.y && y0 < n.pos.y + estNodeHeight(n));
    if (crossed.length) problems.push(`вертикаль x=${vx} перечёркивает ноды ${crossed.map(n => n.id).join(', ')}`);
  } else if (!crossLevel && vx !== null) {
    const xs = v.map(k => k.pos.x);
    if (Math.min(...xs) < xOut || Math.max(...xs) + KNOT_W > xIn)
      problems.push(`knot'ы вылезли за щель ряда ${xOut}…${xIn} между нодами`);
  }

  const tag = crossLevel ? `перенос уровней ${ls}→${lt}` : 'перенос в ряду';
  if (problems.length) {
    bad++;
    console.log(`  ✗ ${tag} ${l.source.id}.${l.out.name} → ${l.target.id}.${l.input.name}: ${problems.join('; ')}`
      + `\n      knot'ы: ${v.map(k => `(${k.pos.x},${k.pos.y})`).join(' → ')}, строки пинов ${srcPinY}/${tgtPinY}`);
    continue;
  }
  console.log(`  ✓ ${tag} ${l.source.id}.${l.out.name} → ${l.target.id}.${l.input.name}: `
    + `пары по Y (${knotPinY(v[0])} = строка выхода, ${knotPinY(v[v.length - 1])} = строка входа)`
    + (crossLevel ? `, вертикаль в свободной колонке x=${vx}` : `, knot'ы в щели ${xOut}…${xIn}`));
}

// knot-прямоугольники не должны попадать внутрь прямоугольников нод
for (const k of knots) {
  const cx = k.pos.x + KNOT_W / 2, cy = k.pos.y + KNOT_W / 2;
  const inside = real.find(n => cx > n.pos.x && cx < n.pos.x + estNodeWidth(n) && cy > n.pos.y && cy < n.pos.y + estNodeHeight(n));
  if (inside) { bad++; console.log(`  ✗ ${k.id} (${k.pos.x},${k.pos.y}) попал внутрь ноды ${inside.id}`); }
}
if (!knots.length) console.log('  knot-переносов нет — проверять нечего');
console.log(bad ? `ИТОГ: нарушений ${bad} (переносов ${checked})` : `ИТОГ: пары knot'ов выровнены по Y, вертикали в свободных колонках (переносов ${checked})`);
process.exit(bad ? 1 : 0);

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
 * Для совместимости принимается и старая «пара» (2 knot'а с общим Y коридора).
 *
 * Использование:
 *   node tools/check-knot-corridor.mjs [tests/three-stage-01.stage2-arranger.txt]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseToGraphs } from '../src/parser.js';
import { estNodeWidth, estNodeHeight, pinCenterY } from '../src/generator.js';
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
  if (v.length === 4) {
    const [k1, k2, k3, k4] = v;
    if (!(knotPinY(k1) === srcPinY && knotPinY(k2) === srcPinY))
      problems.push(`первые два knot'а не на строке пина-выхода: Y ${knotPinY(k1)}, ${knotPinY(k2)} при пине ${srcPinY}`);
    if (!(knotPinY(k3) === tgtPinY && knotPinY(k4) === tgtPinY))
      problems.push(`последние два knot'а не на строке пина-входа: Y ${knotPinY(k3)}, ${knotPinY(k4)} при пине ${tgtPinY}`);
    if (k1.pos.x !== xOut) problems.push(`K1 не на пине-выходе: x=${k1.pos.x} / ${xOut}`);
    if (k2.pos.x + KNOT_W !== k3.pos.x) problems.push(`вертикаль не соосна: x K2+${KNOT_W}=${k2.pos.x + KNOT_W} ≠ x K3=${k3.pos.x}`);
    if (k4.pos.x + KNOT_W !== xIn) problems.push(`выход K4 не на пине-входе: x=${k4.pos.x + KNOT_W} / ${xIn}`);
    vx = k3.pos.x;
  } else if (v.length === 2) {
    if (v[0].pos.y !== v[1].pos.y) problems.push(`пара knot'ов без общего Y: ${v[0].pos.y} / ${v[1].pos.y}`);
    vx = v[1].pos.x;
  } else {
    problems.push(`перенос из ${v.length} knot'ов — не стадиум (4) и не пара (2)`);
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

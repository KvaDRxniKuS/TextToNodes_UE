#!/usr/bin/env node
/**
 * Текстовый контроль коридора knot-переносов в файле ступени 2 (или любой другой).
 *
 * Требование пользователя: пара узлов переноса обязана лежать МЕЖДУ уровнями
 * (в щели после нижнего края уровня-источника и перед верхним краем уровня-цели),
 * а не под целевым уровнем.
 *
 * Использование:
 *   node tools/check-knot-corridor.mjs [tests/three-stage-01.stage2-arranger.txt]
 *
 * Проверки для каждой пары knot'ов:
 *   · оба узла на одном Y (горизонтальный участок переноса);
 *   · Y внутри щели между уровнем источника и уровнем цели;
 *   · Y НЕ ниже низа целевого уровня (прежний баг «knot'ы под рядом»);
 *   · X первого knot'а правее края источника, X второго левее края цели.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseToGraphs } from '../src/parser.js';
import { estNodeWidth, estNodeHeight } from '../src/generator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'tests/three-stage-01.stage2-arranger.txt');
const nodes = parseToGraphs(fs.readFileSync(file, 'utf8')).EventGraph.nodes;

const isKnot = n => /Knot/.test(n.className);
const real = nodes.filter(n => !isKnot(n));
const knots = nodes.filter(isKnot);

// уровни = строки с одинаковым Y у РЕАЛЬНЫХ нод (knot'ы уровни не сдвигают)
const byRow = new Map();
for (const n of real) {
  const key = n.pos.y;
  if (!byRow.has(key)) byRow.set(key, []);
  byRow.get(key).push(n);
}
const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([y, list]) => ({
  top: y,
  bottom: Math.max(...list.map(n => y + estNodeHeight(n))),
  nodes: list,
}));
const rowOf = n => rows.find(r => r.top === n.pos.y);

console.log(`${path.relative(ROOT, file)} — knot'ов: ${knots.length}, уровней: ${rows.length}`);
rows.forEach((r, i) => console.log(`  уровень ${i}: Y ${r.top}…${r.bottom}  [${r.nodes.map(n => n.id.split('_').slice(-1)[0]).join(', ')}]`));

const partner = (knot, wantOutput) => {
  // у разобранного из текста direction = 'Input'/'Output', у собранных в памяти — 'input'/'output'
  const pin = knot.pins.find(p => String(p.direction || '').toLowerCase() === (wantOutput ? 'output' : 'input'));
  const link = pin?.linkedTo?.[0];
  return link ? nodes.find(n => n.id === link.nodeName) : null;
};

let bad = 0;
for (let i = 0; i + 1 < knots.length; i += 2) {
  const a = knots[i];
  const b = knots[i + 1];
  const src = partner(a, false);   // узел, чей выход приходит в первый knot
  const dst = partner(b, true);     // узел, в чей вход выходит второй knot
  if (!src || !dst) { bad++; console.log(`  пара ${i / 2}: разорвана связь knot'а — не удалось найти конец`); continue; }
  const rs = rowOf(src);
  const rd = rowOf(dst);
  if (!rs || !rd) { bad++; console.log(`  пара ${i / 2}: ${src.id}→${dst.id} — узел вне расставленных уровней`); continue; }
  const si = rows.indexOf(rs);
  const ti = rows.indexOf(rd);
  // щель коридора: от самого низкого низа уровней между рядом источника и рядом цели
  // (включая ряд источника) до верха целевого ряда — ровно как считает расстановщик
  let lo, hi, underTarget;
  if (ti >= si) {
    lo = Math.max(...rows.slice(si, ti).map(r => r.bottom));
    hi = rows[ti].top;
    underTarget = a.pos.y >= rd.bottom;
  } else {
    lo = rows[ti].bottom;
    hi = Math.min(...rows.slice(ti + 1, si + 1).map(r => r.top));
    underTarget = a.pos.y <= rd.top;
  }
  const same = a.pos.y === b.pos.y;
  const inGap = a.pos.y >= lo && a.pos.y <= hi;
  const xOk = a.pos.x >= src.pos.x && b.pos.x <= dst.pos.x;
  const ok = same && inGap && !underTarget && xOk;
  if (!ok) bad++;
  console.log(`  пара ${i / 2}: ${src.id} → ${dst.id}  Y=${a.pos.y}/${b.pos.y} (щель ${lo}…${hi}) `
    + `X=${a.pos.x}/${b.pos.x} (края ${src.pos.x + estNodeWidth(src)} / ${dst.pos.x})  ⇒ ${ok ? 'ОК' : 'НАРУШЕНИЕ'}`
    + `${underTarget ? ' [knot под целевым уровнем — прежний баг]' : ''}`);
}
if (!knots.length) console.log('  knot-переносов нет — проверять нечего');
console.log(bad ? `ИТОГ: нарушений ${bad}` : 'ИТОГ: коридор между уровнями соблюдён');
process.exit(bad ? 1 : 0);

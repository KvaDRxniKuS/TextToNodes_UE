#!/usr/bin/env node
// Вспомогательный вывод таблиц для docs/tests (не часть приёмки; утилитарный снапшот геометрии).
//   node tools/table-draft.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseToGraphs } from '../src/parser.js';
import { pinCenterY } from '../src/generator.js';
import { flatLinks, isKnot } from '../src/decorator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => parseToGraphs(fs.readFileSync(path.join(ROOT, f), 'utf8')).EventGraph.nodes;
const a = rd('tests/three-stage-01.stage2-arranger.txt');
const b = rd('tests/three-stage-01.stage3-decorator.txt');
const A = new Map(a.map(n => [n.id, n]));
const nb = x => x.replace('K2Node_', '')
  .replace('CallFunction_', 'FN').replace('CustomEvent_', 'EV').replace('ExecutionSequence_', 'SEQ')
  .replace('AddDelegate_', 'ADD').replace('IfThenElse_', 'BR').replace('VariableGet_', 'GET').replace('Knot_', 'K');

console.log('| нода | черновик (ступень 2) | финал (ступень 3) |');
console.log('|---|---|---|');
for (const n of b.filter(n => !isKnot(n)).sort((x, y) => x.pos.y - y.pos.y || x.pos.x - y.pos.x)) {
  const p = A.get(n.id).pos, q = n.pos;
  const fin = p.x === q.x && p.y === q.y ? '— (не сдвинута)' : `(${q.x}, ${q.y})`;
  console.log(`| \`${nb(n.id)}\` | (${p.x}, ${p.y}) | ${fin} |`);
}
console.log('');
console.log('| провод | ΔY пинов | цепочка knot’ов: ступень 2 → ступень 3 |');
console.log('|---|---|---|');
for (const l of flatLinks(b).filter(l => l.via.length)) {
  const c2 = l.via.map(k => `${A.get(k.id).pos.x},${A.get(k.id).pos.y}`).join(' → ');
  const c3 = l.via.map(k => `${k.pos.x},${k.pos.y}`).join(' → ');
  const dy = pinCenterY(l.target, l.input) - pinCenterY(l.source, l.out);
  console.log(`| \`${nb(l.source.id)}.${l.out.name} → ${nb(l.target.id)}.${l.input.name}\` | ${dy} | ${c2}<br>·<br>${c3} |`);
}

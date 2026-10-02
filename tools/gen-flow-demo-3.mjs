#!/usr/bin/env node
// Проба компактных VariableSet: высота 64 + branchGap 32 = шаг столбца 96.
// Ступень 1 создаёт только код (0,0, без LinkedTo); ступень 2 читает текст,
// материализует закладки соединений и вызывает arrangeExecFlow.
// Event → Sequence3: then_0 → Set FlowSetA → Print; then_1 → Set FlowSetB; then_2 → Set FlowSetC.
// Общий Get FlowSetA → значения трёх Set; расстановщик делает отдельный Get у каждого.
// Для вставки/компиляции нужны три свои переменные Float (double): FlowSetA, FlowSetB, FlowSetC.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createStage1Graph } from '../src/stage1.js';
import { applyConnections } from '../src/arranger.js';
import { arrangeExecFlow, flowHeight, flowWidth } from '../src/flow-layout.js';
import { generateUEText, parseToGraphs, seedGuids } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';
import { lintLayout } from '../src/layout-lint.js';

const REGISTRY = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const OUTPUT = new URL('../sweep/chapters/flow-demo-3.txt', import.meta.url);
export const FLOW_DEMO_3_SPEC = `
set nameBase 3000
1 event FlowDemo3                       @row=0 @col=0
2 fn Sequence3                         @row=0 @col=1
3 self-set FlowSetA float               @row=0 @col=2
4 self-set FlowSetB float               @row=1 @col=2
5 self-set FlowSetC float               @row=2 @col=2
6 self-get FlowSetA float               @row=3 @col=1
7 fn PrintString InString=SetA          @row=0 @col=3
link 1.then 2.execute
link 2.then_0 3.execute
link 2.then_1 4.execute
link 2.then_2 5.execute
link 3.then 7.execute
link 6.FlowSetA 3.FlowSetA
link 6.FlowSetA 4.FlowSetB
link 6.FlowSetA 5.FlowSetC
`;

/** Только построение двух ступеней; seed и диагностические пузыри задаёт CLI. */
export function buildFlowDemo3() {
  const stage1 = createStage1Graph(FLOW_DEMO_3_SPEC, { registry: REGISTRY });
  const problems = [...stage1.problems, ...stage1.validation.errors];
  if (problems.length) throw new Error(`ступень 1: ${problems.join('; ')}`);
  const nodes = parseToGraphs(stage1.text).EventGraph.nodes;
  const wired = applyConnections(nodes, stage1.connections);
  const { rows } = arrangeExecFlow(nodes);
  const setters = nodes.filter(n => /(?:^|\.)K2Node_VariableSet$/.test(n.className));
  const gets = nodes.filter(n => /(?:^|\.)K2Node_VariableGet$/.test(n.className));
  return { stage1, nodes, rows, setters, gets, wired };
}

export function nameFlowDemo3(n, nodes) {
  if (/CustomEvent$/.test(n.className)) return 'Event FlowDemo3';
  if (/ExecutionSequence$/.test(n.className)) return 'Sequence (3 exec-выхода)';
  if (/VariableSet$/.test(n.className)) return `Set ${n.varName}`;
  if (/VariableGet$/.test(n.className)) {
    const link = n.pins.find(p => p.direction === 'Output')?.linkedTo[0];
    const consumer = nodes.find(m => m.id === link?.nodeName);
    return `Get ${n.varName} → ${consumer ? nameFlowDemo3(consumer, nodes) : '?'}`;
  }
  return 'Print (после Set FlowSetA)';
}

function main() {
  seedGuids('flow-demo-3');
  const { stage1, nodes, rows, setters, gets, wired } = buildFlowDemo3();
  // Диагностика пробы — после расстановки, не часть arranger. Парсеный rawBlock экспортёр
  // сохраняет дословно (кроме pos/links), поэтому одного n.bubble здесь недостаточно.
  for (const n of nodes) {
    n.bubble = `${nameFlowDemo3(n, nodes)} (${n.pos.x}, ${n.pos.y})`;
    const props = `   bCommentBubbleVisible=True\n   NodeComment="${n.bubble.replace(/"/g, "'")}"\n`;
    n.rawBlock = n.rawBlock.replace(/^[ \t]*(?:bCommentBubbleVisible|NodeComment)=[^\n]*\n/gm, '')
      .replace(/^[ \t]*NodeGuid=/m, line => props + line);
  }
  const text = generateUEText(nodes, { syncLinks: true }) + '\n';
  const v = validateStrict(text), lint = lintLayout(nodes);
  const overlaps = nodes.flatMap((a, i) => nodes.slice(i + 1).filter(b =>
    a.pos.x < b.pos.x + flowWidth(b) && b.pos.x < a.pos.x + flowWidth(a)
    && a.pos.y < b.pos.y + flowHeight(b) && b.pos.y < a.pos.y + flowHeight(a)));
  const report = process.argv.includes('--stdout') ? console.error : console.log;
  report(`ступень 1: нод=${stage1.nodes.length}, закладок=${stage1.connections.length}, координаты=0, проводов=0`);
  report(`ступень 2: нод=${nodes.length}, соединений=${wired.length}, Get=${gets.length}, STRICT errors=${v.errors.length}, overlaps=${overlaps.length}`);
  report('Нужны свои переменные Float (double): FlowSetA, FlowSetB, FlowSetC. Можно создать через Create Variable на Set.');
  report(`Set: высота=${flowHeight(setters[0])}, шаги=${setters.slice(1).map((n, i) => n.pos.y - setters[i].pos.y).join(', ')}`);
  report(`lint: ${lint.length ? lint.map(x => x.code).join(', ') : 'чисто'}`);
  rows.forEach((row, i) => report(` exec-ряд ${i}, слева направо: ${row.map(n => nameFlowDemo3(n, nodes)).join(' → ')}`));
  for (const n of nodes) report(' ', n.bubble);
  for (const e of v.errors) report(' ERROR:', e);
  if (v.errors.length || overlaps.length || lint.length) { process.exitCode = 1; return; }
  if (process.argv.includes('--stdout')) process.stdout.write(text);
  else if (process.argv.includes('--check')) {
    if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== text) {
      console.error('sweep/chapters/flow-demo-3.txt расходится с генератором — перегенери');
      process.exitCode = 1;
    } else report('✓ sweep/chapters/flow-demo-3.txt совпадает с генератором');
  } else {
    fs.writeFileSync(OUTPUT, text);
    report('wrote sweep/chapters/flow-demo-3.txt');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

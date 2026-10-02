#!/usr/bin/env node
// Проба потокового расстановщика №2: правило 10 (копия Self/Get у каждого потребителя),
// правило 11 (Sequence → столбец) и правило 13 (ещё 128 px за каждый дополнительный exec-выход).
// Event → Sequence: then_0 → Set Actor Location (Target ← Self, NewLocation ← Get Actor Location ← Self) → Print
//                   then_1 → Set Actor Rotation (Target ← Self)
//                   then_2 / then_3 / then_4 → свой Print
// Пять выходов — как в пользовательском copy-back flow-demo-2-reference.md.
// Один Self подключён к трём входам — расстановщик делает 3 Self, каждый у своего потребителя.
import fs from 'node:fs';
import { createCustomEvent } from '../src/modules.js';
import { createSequence, createCallFunction, linkPins } from '../src/generator.js';
import { createSelf } from '../src/special-nodes.js';
import { arrangeExecFlow, flowExecGap } from '../src/flow-layout.js';
import { generateUEText, seedGuids } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';
import { lintLayout } from '../src/layout-lint.js';

seedGuids('flow-demo-2');
const L = JSON.parse(fs.readFileSync('data/ue-functions.json', 'utf8'));
const F = id => createCallFunction(L.find(x => x.func === id));
const ev = createCustomEvent('FlowDemo2', [], { x: 0, y: 0 });
const seq = createSequence(5), self = createSelf();
const setL = F('K2_SetActorLocation'), getL = F('K2_GetActorLocation'), pr = F('PrintString');
const setR = F('K2_SetActorRotation'), pr2 = F('PrintString'), pr3 = F('PrintString'), pr4 = F('PrintString');
linkPins(ev, 'then', seq, 'execute');
linkPins(seq, 'then_0', setL, 'execute'); linkPins(setL, 'then', pr, 'execute');
linkPins(seq, 'then_1', setR, 'execute'); linkPins(seq, 'then_2', pr2, 'execute');
linkPins(seq, 'then_3', pr3, 'execute'); linkPins(seq, 'then_4', pr4, 'execute');
linkPins(self, 'self', setL, 'self'); linkPins(self, 'self', getL, 'self'); linkPins(self, 'self', setR, 'self');
linkPins(getL, 'ReturnValue', setL, 'NewLocation');
const nodes = [ev, seq, self, setL, getL, pr, setR, pr2, pr3, pr4];
const names = new Map([[ev, 'Event FlowDemo2'], [seq, 'Sequence'], [setL, 'Set Actor Location'], [getL, 'Get Actor Location'], [pr, 'Print (после Set Location)'], [setR, 'Set Actor Rotation'], [pr2, 'Print (then 2)'], [pr3, 'Print (then 3)'], [pr4, 'Print (then 4)']]);
const { rows } = arrangeExecFlow(nodes); // добавит копии Self в nodes
const consumerOf = n => { const l = n.pins[0].linkedTo[0]; const c = nodes.find(m => m.id === l.nodeName); return names.get(c); };
for (const n of nodes) n.bubble = `${names.get(n) || 'Self → ' + consumerOf(n)} (${n.pos.x}, ${n.pos.y})`;
const text = generateUEText(nodes, { syncLinks: true }) + '\n';
const v = validateStrict(text);
const lint = lintLayout(nodes); console.log('lint:', lint.length ? lint.map(x => JSON.stringify(x)).join('; ') : 'чисто');
fs.writeFileSync('sweep/chapters/flow-demo-2.txt', text);
console.log(`wrote sweep/chapters/flow-demo-2.txt nodes=${nodes.length} errors=${v.errors.length}`);
console.log(`Sequence: 5 exec-выходов, зазор до следующего столбца ≥ ${flowExecGap(seq)} px (48 + 4×128)`);
rows.forEach((row, i) => console.log(` exec-ряд ${i}, слева направо: ${row.map(n => names.get(n)).join(' → ')}`));
for (const n of nodes) console.log(' ', n.bubble);
v.errors.forEach(e => console.log('  ERROR:', e));
if (v.errors.length) process.exitCode = 1;

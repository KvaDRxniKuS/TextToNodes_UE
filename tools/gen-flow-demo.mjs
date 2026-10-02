#!/usr/bin/env node
// Проба потокового расстановщика (правила 1/3/6/7/8/9): аналог I_SetValue на нодах из реестра.
// Event → Branch(RandomBool) → Print(время строкой) → SetActorLocation(GetActorLocation + MakeVector) → Print «done»
// Branch.else → Print «else» (под следующей нодой хребта).
import fs from 'node:fs';
import { createCustomEvent } from '../src/modules.js';
import { createBranch, createCallFunction, linkPins } from '../src/generator.js';
import { arrangeExecFlow } from '../src/flow-layout.js';
import { generateUEText, seedGuids } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';
import { lintLayout } from '../src/layout-lint.js';

seedGuids('flow-demo');
const raw = JSON.parse(fs.readFileSync('data/ue-functions.json', 'utf8'));
const L = Array.isArray(raw) ? raw : Object.values(raw);
const F = id => createCallFunction(L.find(x => x.func === id));
const ev = createCustomEvent('FlowDemo', [], { x: 0, y: 0 });
const br = createBranch(), rnd = F('RandomBool');
const pr1 = F('PrintString'), time = F('GetGameTimeInSeconds'), conv = F('Conv_DoubleToString');
const set = F('K2_SetActorLocation'), get = F('K2_GetActorLocation'), add = F('Add_VectorVector'), mk = F('MakeVector');
const pr2 = F('PrintString'), prElse = F('PrintString');
linkPins(ev, 'then', br, 'execute'); linkPins(rnd, 'ReturnValue', br, 'Condition');
linkPins(br, 'then', pr1, 'execute'); linkPins(time, 'ReturnValue', conv, 'InDouble'); linkPins(conv, 'ReturnValue', pr1, 'InString');
linkPins(pr1, 'then', set, 'execute'); linkPins(get, 'ReturnValue', add, 'A'); linkPins(mk, 'ReturnValue', add, 'B'); linkPins(add, 'ReturnValue', set, 'NewLocation');
linkPins(set, 'then', pr2, 'execute'); linkPins(br, 'else', prElse, 'execute');
const nodes = [ev, br, rnd, pr1, time, conv, set, get, add, mk, pr2, prElse];
const names = new Map([[ev, 'Event FlowDemo'], [br, 'Branch'], [rnd, 'Random Bool'], [pr1, 'Print (время)'], [time, 'Get Game Time'], [conv, 'To String'], [set, 'Set Actor Location'], [get, 'Get Actor Location'], [add, 'vector + vector'], [mk, 'Make Vector'], [pr2, 'Print (хребет, конец)'], [prElse, 'Print (else)']]);
arrangeExecFlow(nodes);
for (const n of nodes) n.bubble = `${names.get(n)} (${n.pos.x}, ${n.pos.y})`;
const text = generateUEText(nodes, { syncLinks: true }) + '\n';
const v = validateStrict(text);
const lint = lintLayout(nodes); console.log('lint:', lint.length ? lint.map(x => x.code || JSON.stringify(x)).join('; ') : 'чисто');
fs.writeFileSync('sweep/chapters/flow-demo.txt', text);
console.log(`wrote sweep/chapters/flow-demo.txt nodes=${nodes.length} errors=${v.errors.length}`);
for (const n of nodes) console.log(' ', n.bubble);
v.errors.forEach(e => console.log('  ERROR:', e));
if (v.errors.length) process.exitCode = 1;

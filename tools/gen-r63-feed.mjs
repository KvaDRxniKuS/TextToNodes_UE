#!/usr/bin/env node
// R63 probe: Make Array/Set/Map со значениями, подключённые к входам-контейнерам (createContainerFor + linkPins).
import fs from 'node:fs';
import { createCallFunction, linkPins, fitComment } from '../src/generator.js';
import { createCustomEvent, createCallCustomEvent, createContainerFor } from '../src/modules.js';
import { positionBlueprint } from '../src/layout-pipeline.js';
import { generateUEText, seedGuids } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';

seedGuids('r63-feed');
const registry = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const entry = id => { const r = registry.find(e => e.id === id); if (!r) throw new Error(id); return r; };
const B = (n, t) => { n.bubble = `R63: ${t}`; return n; };

// Ряд 1: событие с контейнер-параметрами (const-ref после R62) и его вызов, входы которого питаются Make-нодами.
const ev = B(createCustomEvent('R63_Feed', ['Points:vector[]', 'Tags:set<name>', 'Scores:map<name,int>']), 'событие R63_Feed (Points vector[], Tags set<name>, Scores map<name,int>)');
const call = B(createCallCustomEvent(ev), 'вызов R63_Feed');
const mPoints = B(createContainerFor(call, 'Points', [[0, 0, 0], [100, 0, 50]]), 'Make Array vector → Points');
const mTags = B(createContainerFor(call, 'Tags', ['Idle', 'Run']), 'Make Set name → Tags');
const mScores = B(createContainerFor(call, 'Scores', [['Gold', 10], ['Wood', 5]]), 'Make Map name→int → Scores');
for (const m of [mPoints, mTags, mScores]) linkPins(m, m.outPin, call, m === mPoints ? 'Points' : m === mTags ? 'Tags' : 'Scores');
linkPins(ev, 'then', call, 'execute');

// Ряд 2: функция движка с const-ref массивом.
const join = B(createCallFunction(entry('JoinStringArray')), 'Join String Array ← Make Array string');
const mStr = B(createContainerFor(join, 'SourceArray', ['A', 'B', 'C']), 'Make Array string → SourceArray');
linkPins(mStr, 'Array', join, 'SourceArray');

const nodes = [ev, mPoints, mTags, mScores, call, mStr, join];
const res = positionBlueprint(nodes, { rows: [[ev, mPoints, mTags, mScores, call], [mStr, join]], arrange: { x: 0, y: 0, gap: 160, rowGap: 240 } });
const head = 'R63: Make-контейнеры, подключённые к входам. Ряды: 1) событие + 3 Make + вызов = 5; 2) Make Array string + Join String Array = 2. Проверить: связи на месте, нет ошибок компиляции (Points принимает временный массив благодаря const).';
const out = res.nodes;
const comment = fitComment(head, out);
const text = generateUEText([comment, ...out]) + '\n';
const v = validateStrict(text);
if (v.errors.length) { console.error(v.errors.join('\n')); process.exit(1); }
fs.writeFileSync('sweep/probes/r63-probe.txt', text);
console.log(`R63: нод=${out.length} errors=0 warnings=${v.warnings.length}`);

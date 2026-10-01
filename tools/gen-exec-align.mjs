#!/usr/bin/env node
// Проба выравнивания exec-пинов (правило 1/7): один ряд из нод с разной шапкой, arrangeRows({alignExec}).
// Ожидание: все exec-провода прямые горизонтальные; «Target is…» стоит на 16 выше, Array-нода на 16 ниже.
import fs from 'node:fs';
import { createCustomEvent } from '../src/creator.js';
import { createBranch, createSequence, createCallFunction } from '../src/generator.js';
import { arrangeRows } from '../src/arranger.js';
import { generateUEText, seedGuids } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';

seedGuids('exec-align-probe');
const raw = JSON.parse(fs.readFileSync('data/ue-functions.json', 'utf8'));
const L = Array.isArray(raw) ? raw : (raw.entries || raw.functions || Object.values(raw));
const fn = id => { const e = L.find(x => x.func === id); if (!e) throw new Error('нет в реестре: ' + id); return e; };
const ev = createCustomEvent('ExecAlignProbe', [], { x: 0, y: 0 });
const nodes = [ev, createBranch(), createCallFunction(fn('PrintString')), createCallFunction(fn('K2_SetActorLocation')),
  createCallFunction(fn('Array_Clear')), createSequence(2), createCallFunction(fn('K2_SetActorRotation'))];
const link = (a, b) => { const p = a.pins.find(x => x.category === 'exec' && x.direction === 'Output'), q = b.pins.find(x => x.category === 'exec' && x.direction === 'Input'); p.linkedTo.push({ nodeName: b.id, pinId: q.id }); q.linkedTo.push({ nodeName: a.id, pinId: p.id }); };
for (let i = 0; i + 1 < nodes.length; i++) link(nodes[i], nodes[i + 1]);
arrangeRows([nodes], { gap: 64, alignExec: true });
const titles = ['ExecAlignProbe', 'Branch', 'Print String', 'Set Actor Location', 'Clear', 'Sequence', 'Set Actor Rotation'];
nodes.forEach((n, i) => { n.bubble = `${i + 1}. ${titles[i]} (Y=${n.pos.y})`; });
const text = generateUEText(nodes, { syncLinks: true }) + '\n';
const v = validateStrict(text);
fs.writeFileSync('sweep/chapters/exec-align.txt', text);
console.log(`wrote sweep/chapters/exec-align.txt nodes=${nodes.length} errors=${v.errors.length} warnings=${v.warnings.length}`);
nodes.forEach((n, i) => console.log(' ', titles[i], n.pos.x, n.pos.y));
v.errors.forEach(e => console.log('  ERROR:', e)); v.warnings.forEach(e => console.log('  WARNING:', e));
if (v.errors.length) process.exitCode = 1;

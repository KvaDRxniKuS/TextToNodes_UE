#!/usr/bin/env node
// Проба 3-строчных заголовков: replicated Custom Event («Name / Custom Event / Replicated To …»).
// Модель: нода с N строками стоит на 16·(N−1) выше однострочной (Branch). Ожидание: в каждом ряду провода прямые.
import fs from 'node:fs';
import { createCustomEvent } from '../src/modules.js';
import { createBranch, createCallFunction } from '../src/generator.js';
import { arrangeRows, headerLines } from '../src/arranger.js';
import { generateUEText, seedGuids } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';

seedGuids('exec-align-3-probe');
const raw = JSON.parse(fs.readFileSync('data/ue-functions.json', 'utf8'));
const L = Array.isArray(raw) ? raw : (raw.entries || raw.functions || Object.values(raw));
const fn = id => L.find(x => x.func === id);
const link = (a, b) => { const p = a.pins.find(x => x.category === 'exec' && x.direction === 'Output'), q = b.pins.find(x => x.category === 'exec' && x.direction === 'Input'); p.linkedTo.push({ nodeName: b.id, pinId: q.id }); q.linkedTo.push({ nodeName: a.id, pinId: p.id }); };
const kinds = [['AlignPlain', null], ['AlignMulticast', 'multicast'], ['AlignServer', 'server'], ['AlignClient', 'client']];
const rows = kinds.map(([name, rpc]) => {
  const r = [createCustomEvent(name, [], { x: 0, y: 0 }, rpc ? { rpc, reliable: true } : {}), createBranch(), createCallFunction(fn('PrintString'))];
  link(r[0], r[1]); link(r[1], r[2]); return r;
});
arrangeRows(rows, { gap: 64, rowGap: 160, alignExec: true, createRerouteKnots: false });
const all = rows.flat();
const titles = n => n.eventName || n.title || 'Branch';
rows.forEach((r, ri) => r.forEach((n, i) => { n.bubble = `ряд ${ri + 1}, ${i + 1}. ${titles(n)}: строк ${headerLines(n)}, Y=${n.pos.y}`; }));
const text = generateUEText(all, { syncLinks: true }) + '\n';
const v = validateStrict(text);
fs.writeFileSync('sweep/chapters/exec-align-3.txt', text);
console.log(`wrote sweep/chapters/exec-align-3.txt nodes=${all.length} errors=${v.errors.length}`);
all.forEach(n => console.log(' ', n.bubble));
v.errors.forEach(e => console.log('  ERROR:', e));
if (v.errors.length) process.exitCode = 1;

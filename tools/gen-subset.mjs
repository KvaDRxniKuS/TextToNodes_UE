#!/usr/bin/env node
// Отдельный sweep-блок из выбранных записей реестра (досылки к уже закрытым главам).
//   node tools/gen-subset.mjs <out.txt> "<заголовок>" id1 id2 ...
import fs from 'node:fs';
import { createFromEntry, layoutRow, fitComment } from '../src/generator.js';
import { generateUEText } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';
const [out, title, ...ids] = process.argv.slice(2);
const reg = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const nodes = ids.map(id => { const e = reg.find(x => x.id === id); if (!e) throw new Error('no id ' + id); return createFromEntry(e); });
const PER = 5, rows = [];
for (let i = 0; i < nodes.length; i += PER) rows.push(nodes.slice(i, i + PER));
let y = 0;
for (const r of rows) { layoutRow(r, 0, y); y += Math.max(...r.map(n => 140 + n.pins.filter(p => !p.hidden).length * 28)) + 60; }
const cm = fitComment(`${title} (${nodes.length} узлов)`, nodes);
const t = generateUEText([cm, ...nodes]);
const v = validateStrict(t);
fs.writeFileSync(out, t);
console.log(`${out}: nodes=${nodes.length} errors=${v.errors.length} warnings=${v.warnings.length} bytes=${t.length}`);
v.errors.forEach(e => console.log('  ', e));

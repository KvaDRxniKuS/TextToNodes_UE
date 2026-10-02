// Разовая (идемпотентная) раскладка записей «Gameplay Systems» по категориям из src/categories.js.
import fs from 'node:fs';
import { categoryFor } from '../src/categories.js';
const p = new URL('../data/ue-functions.json', import.meta.url);
const reg = JSON.parse(fs.readFileSync(p, 'utf8'));
let n = 0;
for (const e of reg) if (e.category === 'Gameplay Systems') { e.category = categoryFor(e); e.from = 'probe'; n++; }
fs.writeFileSync(p, JSON.stringify(reg, null, 1) + '\n');
console.log(`перенесено ${n}`);

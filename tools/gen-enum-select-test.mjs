#!/usr/bin/env node
// Enum-indexed K2Node_Select + SwitchEnum probe, based on user's EDrawDebugTrace copy-back.
import fs from 'node:fs';
import { createFromEntry } from '../src/generator.js';
import { generateUEText, seedGuids } from '../src/parser.js';

seedGuids('sweep:enum-select-test.txt'); // пересборка без GUID-шума
import { validateStrict } from '../src/validate.js';

const registry = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const selectEntry = registry.find(e => e.id === 'SelectEnum_EDrawDebugTrace');
const switchEntry = registry.find(e => e.id === 'SwitchEnum');
if (!selectEntry || !switchEntry) throw new Error('Registry entries SelectEnum_EDrawDebugTrace / SwitchEnum are required');
const select = createFromEntry(selectEntry, {x:0,y:0});
const sw = createFromEntry(switchEntry, {x:480,y:0});
const text = generateUEText([select,sw]) + '\n';
const result = validateStrict(text);
fs.writeFileSync('sweep/enum-select-test.txt', text);
console.log(`wrote sweep/enum-select-test.txt (${text.length} bytes); STRICT errors=${result.errors.length}, warnings=${result.warnings.length}`);
result.errors.forEach(e => console.log('  ERROR:', e));
result.warnings.forEach(e => console.log('  WARNING:', e));
if (result.errors.length) process.exitCode = 1;

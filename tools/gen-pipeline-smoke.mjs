#!/usr/bin/env node
// Minimal end-to-end smoke of the main cycle: creator -> arranger -> serializer.
// (ступень 3, декоратор, — в разработке и в цикл не входит)
import fs from 'node:fs';
import { createCallFunction, createCustomEvent, linkPins } from '../src/creator.js';
import { positionBlueprint } from '../src/layout-pipeline.js';
import { generateUEText, seedGuids } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';

seedGuids('current-pipeline-smoke'); // PinId/Guid детерминированы: перегенерация без шума в diff

const registry = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const entry = id => {
  const result = registry.find(item => item.id === id);
  if (!result) throw new Error(`Missing registry entry: ${id}`);
  return result;
};

// Stage 1: create three nodes and connect the exec pins; linkPins does not position.
const start = createCustomEvent('PipelineSmokeStart');
const delay = createCallFunction(entry('Delay'));
const print = createCallFunction(entry('PrintString'));
linkPins(start, 'then', delay, 'execute');
linkPins(delay, 'then', print, 'execute');

// Stage 2: explicit exec row. Decoration (stage 3) is parked — pass `decorate: {}` to re-enable.
const result = positionBlueprint([start, delay, print], {
  rows: [[start, delay, print]],
  arrange: { x: 0, y: 0, gap: 160, rowGap: 160 },
});
const text = generateUEText(result.nodes) + '\n';
const validation = validateStrict(text);
if (validation.errors.length) {
  console.error(validation.errors.join('\n'));
  process.exitCode = 1;
} else {
  fs.writeFileSync('sweep/layout/pipeline-smoke.txt', text);
  console.log(`Wrote sweep/layout/pipeline-smoke.txt; nodes=${result.nodes.length}; errors=0; warnings=${validation.warnings.length}`);
}

#!/usr/bin/env node
import fs from 'node:fs';
import { createCallFunction, createCustomEvent, linkPins } from '../src/creator.js';
import { arrangeRows } from '../src/arranger.js';
import { generateUEText } from '../src/parser.js';

const registry = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const entry = id => {
  const value = registry.find(item => item.id === id);
  if (!value) throw new Error(`Missing registry entry: ${id}`);
  return value;
};

// Creator: create the requested nodes and the sequential exec connections.
const event = createCustomEvent('DebugDrawStripStart');
const print = createCallFunction(entry('PrintString'));
const arrow = createCallFunction(entry('DrawDebugArrow'));
arrow.rawProps = ['EnabledState=DevelopmentOnly'];
const trace = createCallFunction(entry('LineTraceSingle'));
const destroy = createCallFunction(entry('DestroyActor'));
print.pins.find(p => p.name === 'InString').defaultValue = 'Debug draw strip test';
linkPins(event, 'then', print, 'execute');
linkPins(print, 'then', arrow, 'execute');
linkPins(arrow, 'then', trace, 'execute');
linkPins(trace, 'then', destroy, 'execute');

// Arranger only: preserve the requested three rows and materialize cross-row exec links.
const result = arrangeRows([[event, print, arrow], [trace], [destroy]], {
  x: 0, y: 0, gap: 160, rowGap: 160, createRerouteKnots: true, continueX: true,
});
const text = generateUEText(result.nodes) + '\n';
fs.writeFileSync('ultimate-test.txt', text);
console.log(`Wrote ultimate-test.txt (${text.length} bytes, ${result.nodes.length} nodes including ${result.knots.length} arranger knots)`);

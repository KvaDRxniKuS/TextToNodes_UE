// tools/gen-m-series.mjs — M1: round-trip pure BreakHitResult (трейд + OutHit→Hit).
// Запуск: node tools/gen-m-series.mjs
import fs from 'fs';
import { generateUEText } from '../src/parser.js';
import { createCallFunction, fitComment, linkPins, layoutRow } from '../src/generator.js';
import { validateStrict } from '../src/validate.js';

const reg = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const byId = id => reg.find(e => e.id === id);

function emit(tag, nodes) {
  const txt = generateUEText(nodes);
  const v = validateStrict(txt);
  console.log(`===== ${tag}: nodes=${v.nodes} links=${v.links} errors=${v.errors.length} warnings=${v.warnings.length} ${v.valid ? 'STRICT-OK' : 'STRICT-FAIL'}`);
  v.errors.forEach(e => console.log('ERR ' + e));
  v.warnings.forEach(w => console.log('WARN ' + w));
  console.log(txt);
  console.log('');
}

// M1: полный LineTraceSingle + pure BreakHitResult, провод OutHit→Hit
{
  const tr = createCallFunction(byId('LineTraceSingle'));
  const bh = createCallFunction(byId('BreakHitResult_pure'));
  layoutRow([tr, bh]);
  linkPins(tr, 'OutHit', bh, 'Hit');
  emit('M1 pure break round-trip', [fitComment('M1: OutHit→pure BreakHitResult', [tr, bh]), tr, bh]);
}

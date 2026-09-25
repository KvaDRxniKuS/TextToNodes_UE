// tools/gen-n-series.mjs — N1: CapsuleTraceMulti → ForEachLoop(wildcard) → pure BreakHitResult.
// Тест предсказания: резолвнет ли движок wildcard-макро при вставке с проводами (прецедент L2-Knot).
// Запуск: node tools/gen-n-series.mjs
import fs from 'fs';
import { generateUEText } from '../src/parser.js';
import { createCallFunction, createMacroInstance, fitComment, linkPins } from '../src/generator.js';
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

// N1: multi-трейд + цикл по хитам + разбор элемента
{
  const tr = createCallFunction(byId('CapsuleTraceMulti'), { x: 0, y: 0 });
  const fe = createMacroInstance(byId('ForEachLoop'), { x: 320, y: 0 });
  const bh = createCallFunction(byId('BreakHitResult_pure'), { x: 640, y: 0 });
  linkPins(tr, 'then', fe, 'Exec');
  linkPins(tr, 'OutHits', fe, 'Array');
  linkPins(fe, 'Array Element', bh, 'Hit');
  emit('N1 multi+foreach+break', [fitComment('N1: CapsuleTraceMulti→ForEachLoop→BreakHitResult', [tr, fe, bh]), tr, fe, bh]);
}

// tools/gen-o-series.mjs — O1/O2: добивка семейства трейсов.
// O1: полные Multi-аналогии Sphere/Box (предсказания — вставка подтвердит/опровергнет).
// O2: минимальные Single-заготовки + ForObjects (completion-тест: движок достроит сигнатуры).
// Запуск: node tools/gen-o-series.mjs
import fs from 'fs';
import { generateUEText } from '../src/parser.js';
import { createCallFunction, fitComment } from '../src/generator.js';
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

// O1: SphereTraceMulti (16) + BoxTraceMulti (16) — полные формы по аналогии
{
  const sp = createCallFunction(byId('SphereTraceMulti'), { x: 0, y: 0 });
  const bx = createCallFunction(byId('BoxTraceMulti'), { x: 320, y: 0 });
  emit('O1 multi analogies', [fitComment('O1: SphereTraceMulti + BoxTraceMulti (предсказания)', [sp, bx]), sp, bx]);
}

// O2: SphereTraceSingle (7) + CapsuleTraceSingle (8) + LineTraceSingleForObjects (6) — completion
{
  const s1 = createCallFunction(byId('SphereTraceByChannel'), { x: 0, y: 0 });
  const c1 = createCallFunction(byId('CapsuleTraceByChannel'), { x: 320, y: 0 });
  const fo = createCallFunction(byId('LineTraceByObject'), { x: 640, y: 0 });
  emit('O2 single sketches', [fitComment('O2: Sphere/CapsuleSingle + ForObjects (достройка?)', [s1, c1, fo]), s1, c1, fo]);
}

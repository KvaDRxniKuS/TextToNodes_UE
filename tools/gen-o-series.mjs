// tools/gen-o-series.mjs — O1/O2: добивка семейства трейсов.
// O1: Sphere/BoxTraceMulti (verified; Box = HalfSize + Orientation-Rotator).
// O2: Sphere/CapsuleTraceSingle + LineTraceSingleForObjects (verified, полные формы).
// Раскладка: layoutRow — широкий ряд без наложений (фикс O-фидбека про Δ320).
// Запуск: node tools/gen-o-series.mjs
import fs from 'fs';
import { generateUEText } from '../src/parser.js';
import { createCallFunction, fitComment, layoutRow } from '../src/generator.js';
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

// O1: SphereTraceMulti (16) + BoxTraceMulti (17)
{
  const sp = createCallFunction(byId('SphereTraceMulti'));
  const bx = createCallFunction(byId('BoxTraceMulti'));
  layoutRow([sp, bx]);
  emit('O1 multi verified', [fitComment('O1: SphereTraceMulti + BoxTraceMulti (verified)', [sp, bx]), sp, bx]);
}

// O2: SphereTraceSingle (16) + CapsuleTraceSingle (17) + LineTraceSingleForObjects (15)
{
  const s1 = createCallFunction(byId('SphereTraceSingle'));
  const c1 = createCallFunction(byId('CapsuleTraceSingle'));
  const fo = createCallFunction(byId('LineTraceSingleForObjects'));
  layoutRow([s1, c1, fo]);
  emit('O2 singles verified', [fitComment('O2: Sphere/CapsuleSingle + ForObjects (verified)', [s1, c1, fo]), s1, c1, fo]);
}

// tools/gen-l-series.mjs — L1/L2/L3: тест связей (exec + data + Knot + OutHit→Break).
// Запуск: node tools/gen-l-series.mjs
import fs from 'fs';
import { generateUEText } from '../src/parser.js';
import { createCallFunction, createStructNode, createSequence, createKnot, createComment, fitComment, linkPins, layoutRow } from '../src/generator.js';
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

// L1: exec-цепочка Sequence → PrintString(мин) → Delay
{
  const seq = createSequence(2);
  const ps = byId('PrintString');
  const prt = createCallFunction({ ...ps, pins: ps.pins.filter(p => ['execute', 'then', 'InString'].includes(p.name)) });
  const dly = createCallFunction(byId('Delay'));
  layoutRow([seq, prt, dly]);
  linkPins(seq, 'then_0', prt, 'execute');
  linkPins(prt, 'then', dly, 'execute');
  emit('L1 exec chain', [fitComment('L1: exec Sequence→Print→Delay', [seq, prt, dly]), seq, prt, dly]);
}

// L2: data + Knot — MakeVector.Vector → Knot → BreakVector.Vector; BreakVector.X → Delay.Duration
{
  const mk = createStructNode(byId('MakeVector'));
  const kn = createKnot();
  const br = createStructNode(byId('BreakVector'));
  const dly = createCallFunction(byId('Delay'));
  layoutRow([mk, kn, br, dly]);
  linkPins(mk, 'Vector', kn, 'InputPin');
  linkPins(kn, 'OutputPin', br, 'Vector');
  linkPins(br, 'X', dly, 'Duration');
  emit('L2 data+knot', [fitComment('L2: data Make→Knot→Break, X→Delay.Duration', [mk, kn, br, dly]), mk, kn, br, dly]);
}

// L3: OutHit→BreakHitResult — полный трейд + минимальный трейд (дифференциал: съедает ли достройка связи)
{
  const full = createCallFunction(byId('LineTraceSingle'));
  const bA = createStructNode(byId('BreakHitResult'));
  const lt = byId('LineTraceSingle');
  const mini = createCallFunction({ ...lt, pins: lt.pins.filter(p => ['execute', 'then', 'ReturnValue', 'OutHit'].includes(p.name)) });
  const bB = createStructNode(byId('BreakHitResult'));
  layoutRow([full, bA, mini, bB]);
  linkPins(full, 'OutHit', bA, 'HitResult');
  linkPins(mini, 'OutHit', bB, 'HitResult');
  emit('L3 outhit-break', [fitComment('L3: OutHit→Break (full + minimal)', [full, bA, mini, bB]), full, bA, mini, bB]);
}

// tools/gen-l-series.mjs — L1/L2/L3: тест связей (exec + data + Knot + OutHit→Break).
// Запуск: node tools/gen-l-series.mjs
import fs from 'fs';
import { generateUEText } from '../src/parser.js';
import { createCallFunction, createStructNode, createSequence, createKnot, createComment, linkPins } from '../src/generator.js';
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
  const seq = createSequence(2, { x: 0, y: 0 });
  const ps = byId('PrintString');
  const prt = createCallFunction({ ...ps, pins: ps.pins.filter(p => ['execute', 'then', 'InString'].includes(p.name)) }, { x: 320, y: 0 });
  const dly = createCallFunction(byId('Delay'), { x: 640, y: 0 });
  linkPins(seq, 'then_0', prt, 'execute');
  linkPins(prt, 'then', dly, 'execute');
  emit('L1 exec chain', [createComment('L1: exec Sequence→Print→Delay', { x: -80, y: -160 }), seq, prt, dly]);
}

// L2: data + Knot — MakeVector.Vector → Knot → BreakVector.Vector; BreakVector.X → Delay.Duration
{
  const mk = createStructNode(byId('MakeVector'), { x: 0, y: 0 });
  const kn = createKnot({ x: 320, y: 0 });
  const br = createStructNode(byId('BreakVector'), { x: 640, y: 0 });
  const dly = createCallFunction(byId('Delay'), { x: 960, y: 0 });
  linkPins(mk, 'Vector', kn, 'InputPin');
  linkPins(kn, 'OutputPin', br, 'Vector');
  linkPins(br, 'X', dly, 'Duration');
  emit('L2 data+knot', [createComment('L2: data Make→Knot→Break, X→Delay.Duration', { x: -80, y: -160 }), mk, kn, br, dly]);
}

// L3: OutHit→BreakHitResult — полный трейд + минимальный трейд (дифференциал: съедает ли достройка связи)
{
  const full = createCallFunction(byId('LineTraceSingle'), { x: 0, y: 0 });
  const bA = createStructNode(byId('BreakHitResult'), { x: 320, y: 0 });
  const lt = byId('LineTraceSingle');
  const mini = createCallFunction({ ...lt, pins: lt.pins.filter(p => ['execute', 'then', 'ReturnValue', 'OutHit'].includes(p.name)) }, { x: 640, y: 0 });
  const bB = createStructNode(byId('BreakHitResult'), { x: 960, y: 0 });
  linkPins(full, 'OutHit', bA, 'HitResult');
  linkPins(mini, 'OutHit', bB, 'HitResult');
  emit('L3 outhit-break', [createComment('L3: OutHit→Break (full + minimal)', { x: -80, y: -160 }), full, bA, mini, bB]);
}

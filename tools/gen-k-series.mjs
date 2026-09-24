// tools/gen-k-series.mjs — генерация K1/K2/K3 для engine-теста (UE 5.8).
// Каждый вариант валидируется через validateStrict и печатается в stdout.
// Запуск: node tools/gen-k-series.mjs
import fs from 'fs';
import { generateUEText } from '../src/parser.js';
import { createCallFunction, createMacroInstance, createBranch, createSequence, createKnot, createComment } from '../src/generator.js';
import { validateStrict } from '../src/validate.js';

const reg = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const byId = id => reg.find(e => e.id === id);

function emit(tag, nodes) {
  const txt = generateUEText(nodes);
  const v = validateStrict(txt);
  console.log(`===== ${tag}: nodes=${v.nodes} errors=${v.errors.length} warnings=${v.warnings.length} ${v.valid ? 'STRICT-OK' : 'STRICT-FAIL'}`);
  v.errors.forEach(e => console.log('ERR ' + e));
  v.warnings.forEach(w => console.log('WARN ' + w));
  console.log(txt);
  console.log('');
}

// K1: LineTraceSingle полный (15 пинов; self движок добавляет сам)
const k1 = createCallFunction(byId('LineTraceSingle'), { x: 0, y: 0 });
emit('K1 full LineTraceSingle', [createComment('K1: LineTraceSingle полный (15 пинов)', { x: -80, y: -160 }), k1]);

// K2: LineTraceSingle минимальный (тест engine-completion)
const full = byId('LineTraceSingle');
const mini = { ...full, pins: full.pins.filter(p => ['execute', 'then', 'ReturnValue'].includes(p.name)) };
const k2 = createCallFunction(mini, { x: 0, y: 0 });
emit('K2 minimal LineTraceSingle', [createComment('K2: LineTraceSingle минимум (execute/then/ReturnValue)', { x: -80, y: -160 }), k2]);

// K3: control-flow (Branch + Sequence + Knot + ForEachLoop)
const br = createBranch({ x: 0, y: 0 });
const sq = createSequence(2, { x: 320, y: 0 });
const kn = createKnot({ x: 640, y: 0 });
const fe = createMacroInstance(byId('ForEachLoop'), { x: 960, y: 0 });
emit('K3 control-flow', [createComment('K3: Branch+Sequence+Knot+ForEachLoop', { x: -80, y: -160 }), br, sq, kn, fe]);

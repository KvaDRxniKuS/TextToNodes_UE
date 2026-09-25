// tools/gen-r21b.mjs — R21b: базовая цепочка Enhanced Input (без BeginPlay: K2Node_Event запрещён E08).
// GetPlayerController → Cast To PlayerController → Get EnhancedInputLocalPlayerSubsystem → Add Mapping Context.
import fs from 'fs';
import { generateUEText } from '../src/parser.js';
import { createFromEntry, linkPins, layoutRow, fitComment } from '../src/generator.js';
import { validateStrict } from '../src/validate.js';
const reg = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const byId = id => reg.find(e => e.id === id);
const gpc = createFromEntry(byId('GetPlayerController'));
const cast = createFromEntry(byId('CastToPlayerController'));
const sub = createFromEntry(byId('GetEnhancedInputSubsystem'));
const add = createFromEntry(byId('AddMappingContext'));
layoutRow([gpc, cast, sub, add], 0, 0);
sub.pos.y = 220; sub.pos.x = cast.pos.x + 60;
linkPins(gpc, 'ReturnValue', cast, 'Object');
linkPins(cast, 'then', add, 'execute');
linkPins(cast, 'AsPlayer Controller', sub, 'PlayerController');
linkPins(sub, 'ReturnValue', add, 'self');
const nodes = [gpc, cast, sub, add];
const cm = fitComment('SWEEP 21b: Enhanced Input — Cast → Subsystem → AddMappingContext (draft)', nodes);
const text = generateUEText([cm, ...nodes]);
const v = validateStrict(text);
fs.writeFileSync(new URL('../sweep/21b-enhanced-input-chain.txt', import.meta.url), text);
console.log(`21b: nodes=${nodes.length} errors=${v.errors.length} warnings=${v.warnings.length}`);
v.errors.forEach(e => console.log('  ', e));

// R21c: узлы Enhanced Input с ассетами (пути шаблона UE5 — при другом проекте заменить путь InputAction).
{
  const ev = createFromEntry(byId('EnhancedInputActionEvent'));
  const gv = createFromEntry(byId('GetInputActionValue'));
  layoutRow([ev, gv], 0, 0);
  const cm2 = fitComment('SWEEP 21c: Enhanced Input — событие IA_Jump + Get IA_Move (пути шаблона /Game/Input/Actions)', [ev, gv]);
  const t2 = generateUEText([cm2, ev, gv]);
  const v2 = validateStrict(t2);
  fs.writeFileSync(new URL('../sweep/21c-enhanced-input-assets.txt', import.meta.url), t2);
  console.log(`21c: nodes=2 errors=${v2.errors.length} warnings=${v2.warnings.length}`);
  v2.errors.forEach(e => console.log('  ', e));
}

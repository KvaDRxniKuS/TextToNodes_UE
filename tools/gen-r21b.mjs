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

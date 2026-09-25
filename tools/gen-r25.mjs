// tools/gen-r25.mjs — R25 Events/Delegates: связанная сцена (K2Node_Event запрещён E08 — только CustomEvent/делегатные узлы).
// MyEvent → Bind(OnActorBeginOverlap ← OnOverlapActor) → Unbind(← Create Event) → Unbind all → Call OnDamaged(10).
import fs from 'fs';
import { generateUEText } from '../src/parser.js';
import { createFromEntry, linkPins, layoutRow, fitComment } from '../src/generator.js';
import { validateStrict } from '../src/validate.js';
const reg = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const byId = id => { const e = reg.find(x => x.id === id); if (!e) throw new Error('no id ' + id); return createFromEntry(e); };
const ev = byId('CustomEvent'), bind = byId('BindEventActorBeginOverlap'), unb = byId('UnbindEventActorBeginOverlap');
const clr = byId('UnbindAllActorBeginOverlap'), call = byId('CallCustomEvent');
const evOv = byId('CustomEventOverlap'), mk = byId('CreateEvent'), evDmg = byId('CustomEventParam');
layoutRow([ev, bind, unb, clr, call], 0, 0);
layoutRow([evOv, mk], bind.pos.x - 420, 360);
evDmg.pos.x = call.pos.x; evDmg.pos.y = 360;
linkPins(ev, 'then', bind, 'execute');
linkPins(bind, 'then', unb, 'execute');
linkPins(unb, 'then', clr, 'execute');
linkPins(clr, 'then', call, 'execute');
linkPins(evOv, 'OutputDelegate', bind, 'Delegate', { align: false });
linkPins(mk, 'OutputDelegate', unb, 'Delegate', { align: false });
call.memberGuid = evDmg.guid; // ссылка на функцию события = его NodeGuid
const nodes = [ev, bind, unb, clr, call, evOv, mk, evDmg];
const cm = fitComment('SWEEP 25: Events / Delegates — Custom Event, Bind/Unbind/Unbind all (OnActorBeginOverlap), Create Event, вызов Custom Event', nodes);
const text = generateUEText([cm, ...nodes]);
const v = validateStrict(text);
fs.writeFileSync(new URL('../sweep/25-events-delegates.txt', import.meta.url), text);
console.log(`25: nodes=${nodes.length} errors=${v.errors.length} warnings=${v.warnings.length} bytes=${text.length}`);
v.errors.forEach(e => console.log('  ', e));
v.warnings.forEach(e => console.log('   W', e.slice(0, 160)));

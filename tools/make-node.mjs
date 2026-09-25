#!/usr/bin/env node
// tools/make-node.mjs — конструктор модулей: любые классы/события/делегаты/функции реестра → текст для вставки в UE.
//
//   node tools/make-node.mjs [--chain] [--title "коммент"] [-o out.txt] "<спека>" "<спека>" ...
//
// Спеки (по одной на узел, номера узлов = порядок, с 1):
//   cast <Класс> [class] [pure]            Cast To <Класс>; class → Cast To <Класс> Class; pure → без exec
//   event <Имя> [Парам:тип ...]            Custom Event с параметрами
//   event-for <Класс.Делегат> <Имя>        Custom Event с сигнатурой делегата (как «Create matching event»)
//   call-event <Имя> [Парам=значение ...]  вызов своего события (параметры берутся из event <Имя> в этой же пачке)
//   bind|unbind|clear <Класс.Делегат>      Bind Event to / Unbind Event from / Unbind all Events from
//   create-event <Функция>                 Create Event (делегат по имени функции)
//   widget <WBP-путь|none>                 Create Widget (Class = /Game/UI/WBP_X; none — выбрать в движке)
//   get|set <Класс.Свойство> <тип> [знач]  Get/Set свойства любого класса (напр. set PlayerController.bShowMouseCursor bool true)
//   fn <id-или-функция-реестра> [Пин=значение ...]   любой узел реестра data/ue-functions.json
//   link <i>.<Пин> <j>.<Пин>               связь выход→вход (Пин может оканчиваться на *: As* → AsBP Enemy)
//
// Классы: Actor | /Script/Module.Class | /Game/Path/BP_X (BP → _C автоматически).
// Типы: bool int int64 byte float string name text vector rotator transform vector2d linearcolor hitresult key timerhandle
//       object:Класс class:Класс enum:EИмя, суффикс [] — массив.
// Неизвестный делегат: bind /Game/BP_Door.OnOpened --sig /Game/BP_Door.OnOpened Who:object:Actor  (сигнатура + параметры).
// --chain: exec по порядку (then→execute, первая «event» — старт), делегаты event-for/create-event → ближайший свободный вход Delegate.
import fs from 'node:fs';
import { generateUEText } from '../src/parser.js';
import { layoutRow, fitComment, linkPins, estNodeWidth } from '../src/generator.js';
import { validateStrict } from '../src/validate.js';
import { createCast, createCustomEvent, createCallCustomEvent, createDelegateNode, createEventFor, createCreateEvent, createFn, createWidget, createMemberVar } from '../src/modules.js';

process.on('uncaughtException', e => { console.error('make-node: ОШИБКА — ' + e.message); process.exit(1); });
const reg = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const argv = process.argv.slice(2);
let chain = false, title = '', out = '';
const specs = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--chain') chain = true;
  else if (argv[i] === '--title') title = argv[++i];
  else if (argv[i] === '-o') out = argv[++i];
  else specs.push(argv[i]);
}
if (!specs.length) { console.error(fs.readFileSync(new URL(import.meta.url)).toString().split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); process.exit(1); }

const nodes = [], links = [], kinds = [];
const kv = words => Object.fromEntries(words.map(w => { const i = w.indexOf('='); if (i < 0) throw new Error(`«${w}»: ожидалось Пин=значение`); return [w.slice(0, i), w.slice(i + 1)]; }));
const optSig = words => { const i = words.indexOf('--sig'); if (i < 0) return { rest: words }; return { sig: words[i + 1], rest: words.filter((_, j) => j !== i && j !== i + 1) }; };

for (const spec of specs) {
  const [cmd, ...w] = spec.trim().split(/\s+/);
  let n;
  switch (cmd) {
    case 'cast': n = createCast(w[0], { kind: w.includes('class') ? 'class' : 'object', pure: w.includes('pure') }); break;
    case 'event': n = createCustomEvent(w[0], w.slice(1)); break;
    case 'event-for': { const o = optSig(w); n = createEventFor(o.rest[0], o.rest[1], { sig: o.sig, params: o.rest.length > 2 ? o.rest.slice(2) : undefined }); break; }
    case 'call-event': { const ev = nodes.find(x => x.eventName === w[0]); n = createCallCustomEvent(ev || w[0], kv(w.slice(1))); break; }
    case 'bind': case 'unbind': case 'clear': { const o = optSig(w); n = createDelegateNode(cmd, o.rest[0], { sig: o.sig, params: o.rest.length > 1 ? o.rest.slice(1) : undefined }); break; }
    case 'create-event': n = createCreateEvent(w[0]); break;
    case 'widget': n = createWidget(w[0] && w[0].toLowerCase() !== 'none' ? w[0] : null); break;
    case 'get': case 'set': n = createMemberVar(cmd, w[0], w[1], w.slice(2).join(' ')); break;
    case 'fn': {
      const e = reg.find(x => x.id === w[0]) || reg.find(x => x.func === w[0]);
      if (!e) throw new Error(`fn ${w[0]}: нет в реестре (id или func)`);
      if (e.hidden) console.error(`! ${e.id}: запись скрыта (FAIL в движке)`);
      n = createFn(e, kv(w.slice(1))); break;
    }
    case 'link': links.push(w); continue;
    default: throw new Error(`неизвестная спека «${cmd}» (cast|event|event-for|call-event|bind|unbind|clear|create-event|widget|get|set|fn|link)`);
  }
  nodes.push(n); kinds.push(cmd);
}

// раскладка: исполняемые узлы — ряд 0, события/pure — ряд 1
const hasExecIn = n => n.pins.some(p => p.name === 'execute' && p.direction === 'Input');
const top = nodes.filter(hasExecIn), bottom = nodes.filter(n => !hasExecIn(n));
layoutRow(top, 0, 0);
layoutRow(bottom, 0, 420);

const findPin = (n, name, dir) => {
  const pr = name.endsWith('*') ? p => p.name.startsWith(name.slice(0, -1)) : p => p.name === name;
  const p = n.pins.find(x => x.direction === dir && pr(x));
  if (!p) throw new Error(`${n.title}: нет ${dir === 'Output' ? 'выхода' : 'входа'} ${name} (есть: ${n.pins.filter(x => x.direction === dir).map(x => x.name).join(', ')})`);
  return p.name;
};
if (chain) {
  const execs = nodes.filter(hasExecIn);
  const start = nodes.find((n, i) => kinds[i] === 'event');
  if (start && execs[0]) linkPins(start, 'then', execs[0], 'execute');
  for (let i = 0; i + 1 < execs.length; i++) {
    const thenPin = execs[i].pins.find(p => p.name === 'then' && p.direction === 'Output');
    if (thenPin) linkPins(execs[i], 'then', execs[i + 1], 'execute');
  }
  const srcs = nodes.filter((n, i) => kinds[i] === 'event-for' || kinds[i] === 'create-event');
  for (const s of srcs) {
    const tgt = nodes.find(n => n.pins.some(p => p.name === 'Delegate' && p.direction === 'Input' && !p.linkedTo.length));
    if (tgt) linkPins(s, 'OutputDelegate', tgt, 'Delegate', { align: false });
  }
}
for (const [a, b] of links) {
  const [ia, pa] = [parseInt(a), a.slice(a.indexOf('.') + 1)], [ib, pb] = [parseInt(b), b.slice(b.indexOf('.') + 1)];
  const A = nodes[ia - 1], B = nodes[ib - 1];
  if (!A || !B) throw new Error(`link ${a} ${b}: нет узла`);
  linkPins(A, findPin(A, pa, 'Output'), B, findPin(B, pb, 'Input'), { align: false });
}

const cm = fitComment(title || `Модуль: ${specs.filter(s => !s.startsWith('link')).map(s => s.split(/\s+/).slice(0, 2).join(' ')).join(' → ')}`, nodes);
const text = generateUEText([cm, ...nodes]);
const v = validateStrict(text);
if (out) fs.writeFileSync(out, text); else process.stdout.write(text + '\n');
console.error(`make-node: nodes=${nodes.length} errors=${v.errors.length} warnings=${v.warnings.length} bytes=${text.length}`);
v.errors.forEach(e => console.error('  ERR ' + e));
if (v.errors.length) process.exit(2);

#!/usr/bin/env node
// tools/make-node.mjs — конструктор модулей: любые классы/события/делегаты/функции реестра → текст для вставки в UE.
//
//   node tools/make-node.mjs [--chain] [--wrap N | --width PX] [--decorate] [--title "коммент"] [-o out.txt]
//                            [--root /Game/X/BP_X.BP_X:Граф] [--bp /Game/X/BP_X] [--context ctx.json [--new A,B]] "<спека>" ...
//
//   --root PATH   реальный путь графа → ExportPath как у движка (без флага ExportPath не пишется)
//   --bp PATH     путь своего BP (для self-пина своих переменных; по умолчанию выводится из --root)
//   --context F   инвентарь целевой функции (tools/inventory.mjs): каждая переменная — из контекста или объявлена
//                 явно новая (--new A,B — «создаю новую», завести в BP вручную); иначе ошибка E19 (контекст-первый, P2)
//
// Раскладка (всё опционально):
//   --wrap N      не больше N исполняемых узлов в ряду, дальше перенос на ряд ниже (с начала, как строки текста)
//   --width PX    перенос по ширине ряда в px (напр. 3000)
//   --decorate    декор: exec-связи с переносом назад → 2 knot'а в коридоре между рядами (под выходом / над входом),
//                 exec со сдвигом высоты → «ступенька» из 2 knot'ов; стартовое событие — в начало ряда 0;
//                 pure/данные — подрядом под своим потребителем (выравнивание по X); сетка 16. Без флага раскладка прежняя.
//
// Спеки (по одной на узел, номера узлов = порядок, с 1):
//   cast <Класс> [class] [pure]            Cast To <Класс>; class → Cast To <Класс> Class; pure → без exec
//   event <Имя> [Парам:тип ...]            Custom Event с параметрами
//   event-for <Класс.Делегат> <Имя>        Custom Event с сигнатурой делегата (как «Create matching event»)
//   call-event <Имя> [Парам=значение ...]  вызов своего события (параметры берутся из event <Имя> в этой же пачке)
//   bind|unbind|clear <Класс.Делегат>      Bind Event to / Unbind Event from / Unbind all Events from
//   create-event <Функция>                 Create Event (делегат по имени функции)
//   widget <WBP-путь|none>                 Create Widget (Class = /Game/UI/WBP_X; none — выбрать в движке)
//   ia-event <IA> [bool|float|vector2d|vector]   событие Enhanced Input (IA_Jump → /Game/Input/Actions/IA_Jump)
//   ia-value <IA> [bool|float|vector2d|vector]   pure «Get IA_X» (значение действия)
//   get|set <Класс.Свойство> <тип> [знач]  Get/Set свойства любого класса (напр. set PlayerController.bShowMouseCursor bool true)
//   self-get|self-set <Имя> <тип> [знач]   своя переменная BP (self = класс BP из --bp или --root)
//   local-get|local-set <Функция>.<Имя> <тип> [знач]   локал/параметр функции (MemberScope, без self)
//   fn <id-или-функция-реестра> [Пин=значение ...]   любой узел реестра data/ue-functions.json
//                                          объектный пин = ассет: MappingContext=IMC_Default, Action=IA_Jump, /Game/X/Y
//   call <Класс.Функция> [pure] [static] Пин:тип[=знач] ... [-> Выход:тип ...]
//                                          ЛЮБАЯ UFUNCTION, даже не из реестра (член → видимый self; static → библиотека)
//   row                                    следующий узел — с нового ряда (номер узла не занимает)
//   link <i>.<Пин> <j>.<Пин>               связь выход→вход (Пин может оканчиваться на *: As* → AsBP Enemy)
//
// Классы: Actor | /Script/Module.Class | /Game/Path/BP_X (BP → _C автоматически).
// Типы: bool int int64 byte float string name text vector rotator transform vector2d linearcolor hitresult key timerhandle
//       object:Класс class:Класс enum:EИмя, суффикс [] — массив.
// Неизвестный делегат: bind /Game/BP_Door.OnOpened --sig /Game/BP_Door.OnOpened Who:object:Actor  (сигнатура + параметры).
// --chain: exec по порядку спек (then→execute); КАЖДОЕ событие (event/event-for/ia-event) начинает свою цепочку
//          и (со второго) новый ряд; узлы до первого события подхватывает первое событие;
//          делегаты event-for/create-event → ближайший свободный вход Delegate.
import fs from 'node:fs';
import { generateUEText } from '../src/parser.js';
import { layoutRow, layoutRows, layoutDecorated, fitComment, linkPins, estNodeWidth, decorateExec, snapToGrid } from '../src/generator.js';
import { validateStrict } from '../src/validate.js';
import { createCast, createCustomEvent, createCallCustomEvent, createDelegateNode, createEventFor, createCreateEvent, createFn, createWidget, createMemberVar, createSelfVar, createLocalVarGet, createLocalVarSet, createInputActionEvent, createInputActionValue, createCall } from '../src/modules.js';

process.on('uncaughtException', e => { console.error('make-node: ОШИБКА — ' + e.message); process.exit(1); });
const reg = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const argv = process.argv.slice(2);
let chain = false, title = '', out = '', decorate = false, wrap = 0, width = 0, root = '', bp = '', ctxFile = '', newVars = [];
const specs = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--chain') chain = true;
  else if (argv[i] === '--title') title = argv[++i];
  else if (argv[i] === '--decorate') decorate = true;
  else if (argv[i] === '--wrap') wrap = parseInt(argv[++i]);
  else if (argv[i] === '--width') width = parseInt(argv[++i]);
  else if (argv[i] === '-o') out = argv[++i];
  else if (argv[i] === '--root') root = argv[++i];
  else if (argv[i] === '--bp') bp = argv[++i];
  else if (argv[i] === '--context') ctxFile = argv[++i];
  else if (argv[i] === '--new') newVars = argv[++i].split(',').filter(Boolean);
  else specs.push(argv[i]);
}
if (!specs.length) { console.error(fs.readFileSync(new URL(import.meta.url)).toString().split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); process.exit(1); }

const nodes = [], links = [], kinds = [];
let rowBreakNext = false;
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
    case 'call': n = createCall(w[0], w.slice(1).filter(x => x !== 'pure' && x !== 'static'), { pure: w.includes('pure'), isStatic: w.includes('static') }); break;
    case 'ia-event': n = createInputActionEvent(w[0], w[1] || 'bool'); break;
    case 'ia-value': n = createInputActionValue(w[0], w[1] || 'vector2d'); break;
    case 'get': case 'set': n = createMemberVar(cmd, w[0], w[1], w.slice(2).join(' ')); break;
    case 'self-get': case 'self-set': n = createSelfVar(cmd.slice(5), w[0], w[1], w.slice(2).join(' '), { bp }); break;
    case 'local-get': case 'local-set': {
      const d = w[0].indexOf('.'); if (d < 0) throw new Error(`${cmd} ${w[0]}: формат <Функция>.<Имя>`);
      const [sc, nm] = [w[0].slice(0, d), w[0].slice(d + 1)];
      n = cmd === 'local-get' ? createLocalVarGet(sc, nm, w[1]) : createLocalVarSet(sc, nm, w[1], w.slice(2).join(' '));
      break;
    }
    case 'fn': {
      const e = reg.find(x => x.id === w[0]) || reg.find(x => x.func === w[0]);
      if (!e) throw new Error(`fn ${w[0]}: нет в реестре (id или func)`);
      if (e.hidden) console.error(`! ${e.id}: запись скрыта (FAIL в движке)`);
      n = createFn(e, kv(w.slice(1))); break;
    }
    case 'link': links.push(w); continue;
    case 'row': rowBreakNext = true; continue;
    default: throw new Error(`неизвестная спека «${cmd}» (cast|event|event-for|call-event|bind|unbind|clear|create-event|widget|ia-event|ia-value|call|get|set|self-get|self-set|local-get|local-set|fn|link|row)`);
  }
  if (rowBreakNext) { n.rowBreak = true; rowBreakNext = false; }
  nodes.push(n); kinds.push(cmd);
}


const hasExecIn = n => n.pins.some(p => p.name === 'execute' && p.direction === 'Input');
const findPin = (n, name, dir) => {
  const pr = name.endsWith('*') ? p => p.name.startsWith(name.slice(0, -1)) : p => p.name === name;
  const p = n.pins.find(x => x.direction === dir && pr(x));
  if (!p) throw new Error(`${n.title}: нет ${dir === 'Output' ? 'выхода' : 'входа'} ${name} (есть: ${n.pins.filter(x => x.direction === dir).map(x => x.name).join(', ')})`);
  return p.name;
};
// Событие-источник exec: узел без execute с exec-выходом (event, event-for, ia-event).
const isExecSource = n => !hasExecIn(n) && n.pins.some(p => p.direction === 'Output' && p.category === 'exec');
// Основной exec-выход: then, иначе первый exec-выход (ia-event → Triggered, Sequence → then_0).
const mainOut = n => (n.pins.find(p => p.name === 'then' && p.direction === 'Output') || n.pins.find(p => p.direction === 'Output' && p.category === 'exec' && p.name !== 'Default' && p.name !== 'CastFailed' && p.name !== 'else') || {}).name;
if (chain) {
  // exec по порядку спек. КАЖДОЕ событие-источник начинает свою цепочку (R30: TimerDemo → … → Print «Done»;
  // OnTimerTick → Print «Tick» — отдельно). Исполняемые узлы ДО первого события подхватывает первое событие.
  let prev = null, sources = 0; const head = [];
  for (const n of nodes) {
    if (hasExecIn(n)) {
      if (prev) { const o = mainOut(prev); if (o) linkPins(prev, o, n, 'execute'); } else head.push(n);
      prev = n;
    } else if (isExecSource(n)) {
      const o = mainOut(n);
      if (sources++ && !n.rowBreak) n.rowBreak = true; // каждое следующее событие — с нового ряда (как абзац)
      if (head.length) { if (o) linkPins(n, o, head[0], 'execute'); head.length = 0; } else prev = n;
    }
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

// раскладка: исполняемые узлы — ряд 0 (или ряды с переносом), события/pure — ниже
// (после связей: exec/делегатные связи узлы не двигают) стартовое событие = первый узел без execute,
// чей then ведёт в исполняемый узел; в --decorate оно встаёт в начало ряда 0 (прямая exec).
// --decorate: КАЖДОЕ событие-источник exec (без execute, с подключённым then) встаёт в ряд перед своими узлами
// в порядке спек — связь событие→узел прямая. Спека «row» — принудительный перенос ряда.
const isExecSrc = n => !hasExecIn(n) && n.pins.some(p => p.direction === 'Output' && p.category === 'exec' && p.linkedTo.length);
const inTop = n => hasExecIn(n) || (decorate && isExecSrc(n));
const top = nodes.filter(inTop), bottom = nodes.filter(n => !inTop(n));
if (decorate) {
  layoutDecorated(top, bottom, { perRow: wrap, maxWidth: width });
} else if (wrap || width || nodes.some(n => n.rowBreak)) {
  const { bottom: yb } = layoutRows(top, { perRow: wrap, maxWidth: width });
  layoutRows(bottom, { y0: yb, maxWidth: width || 0, perRow: wrap ? wrap + 1 : 0 });
} else {
  layoutRow(top, 0, 0);
  layoutRow(bottom, 0, 420);
}
if (decorate) snapToGrid(nodes, { xOnly: true }); // сохраняем точное Y-выравнивание подключённых exec-пинов (R28)
if (decorate) nodes.push(...decorateExec(nodes));
const cm = fitComment(title || `Модуль: ${specs.filter(s => !s.startsWith('link') && s.trim() !== 'row').map(s => s.split(/\s+/).slice(0, 2).join(' ')).join(' → ')}`, nodes);
const text = generateUEText([cm, ...nodes], { root });
// контекст-первый: переменная вне инвентаря допустима только явным --new (создаю новую — её надо завести в BP)
const ctx = ctxFile ? JSON.parse(fs.readFileSync(ctxFile, 'utf8')) : null;
const v = validateStrict(text, { context: ctx, newVars });
if (out) fs.writeFileSync(out, text); else process.stdout.write(text + '\n');
console.error(`make-node: nodes=${nodes.length} errors=${v.errors.length} warnings=${v.warnings.length} bytes=${text.length}`);
v.errors.forEach(e => console.error('  ERR ' + e));
if (v.errors.length) process.exit(2);

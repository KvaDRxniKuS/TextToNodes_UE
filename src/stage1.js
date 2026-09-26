// src/stage1.js — Ступень 1: «генератор нод».
//
// Зона ответственности (по трёхступенчатому конвейеру):
//   1) генератор нод  — ЭТА СТУПЕНЬ. Отвечает за КОРРЕКТНОСТЬ нод: класс, количество,
//      входы/выходы (пины), значения по умолчанию и ДВУСТОРОННИЕ связи «выход → вход».
//      Принимает на вход последовательность нод, связи пинов и МАРКИ позиционирования
//      (@row/@col/@…), отдаёт ТОЛЬКО код нод.
//   2) расстановщик    — src/arranger.js: черновая расстановка по шаблонам + knot-переносы.
//   3) декоратор       — src/decorator.js: выравнивание соединённых пинов и knot-ов.
//
// Чего генератор принципиально НЕ делает: не считает ширину нод, не выравнивает пины,
// не создаёт reroute-knot'ы и комментарии, не «догадывается» о порядке — координаты
// только из марок спеки. Если марки не заданы — ошибка, а не молчаливое 0,0.
//
// Формат спеки (одна нода на строку, нумерация с 1 — ею ссылаются связи):
//   # комментарий
//   set colStep 400            — параметры сетки марок (colStep/rowStep/grid/x0/y0)
//   1 bind Actor.OnActorBeginOverlap          @row=0 @col=0
//   2 fn Sequence3                             @row=0 @col=1
//   5 event-for Actor.OnActorBeginOverlap Evt  @row=1 @col=0 @role=delegate-handler
//   link 5.OutputDelegate 1.Delegate           — <источник>.<выход> <приёмник>.<вход>
//   <спека> = любой тип make-node: cast|event|event-for|call-event|bind|unbind|clear|
//             create-event|widget|ia-event|ia-value|get|set|self-get|self-set|
//             local-get|local-set|fn|call
//   @mark=value — марки позиционирования; @row/@col обязательны, row дробный
//             (2.5 = подряд уровнем 2, т.е. данные под исполняемой строкой).
import { generateUEText, parseToGraphs } from './parser.js';
import { validateStrict } from './validate.js';
import { linkPins } from './generator.js';
import * as M from './modules.js';

/** «Пин=значение Пин2=значение2» → объект (как в make-node). */
export const kv = words => Object.fromEntries(words.map(w => {
  const i = w.indexOf('=');
  if (i < 0) throw new Error(`«${w}»: ожидалось Пин=значение`);
  return [w.slice(0, i), w.slice(i + 1)];
}));
/** Вырезает «--sig ЗНАЧЕНИЕ» из слов спеки. */
export const optSig = words => {
  const i = words.indexOf('--sig');
  if (i < 0) return { rest: words };
  return { sig: words[i + 1], rest: words.filter((_, j) => j !== i && j !== i + 1) };
};

/** Пин по имени; суффикс `*` — префиксное совпадение (As* → AsBP_Enemy). */
export function findPin(n, name, dir) {
  const pr = name.endsWith('*') ? p => p.name.startsWith(name.slice(0, -1)) : p => p.name === name;
  const p = n.pins.find(x => x.direction === dir && pr(x));
  if (!p) throw new Error(`${n.title}: нет ${dir === 'Output' ? 'выхода' : 'входа'} ${name} (есть: ${n.pins.filter(x => x.direction === dir).map(x => x.name).join(', ')})`);
  return p.name;
}

export const SPEC_TYPES = 'bool int int64 byte float single string name text vector rotator transform vector2d linearcolor hitresult key timerhandle object:Класс class:Класс enum:EИмя []';

/** Одна спека → запись узла. Возвращает { node, kind } либо { directive, args } для
 *  управляющих строк (link/row/set/comment — их обрабатывает вызывающая сторона).
 *  `notes` — собирает замечания реестра (скрытые/неподтверждённые записи). */
export function buildSpecNode(spec, { registry = [], nodes = [], notes = [], bp = '' } = {}) {
  const [cmd, ...w] = String(spec).trim().split(/\s+/).filter(Boolean);
  const entry = id => {
    const e = registry.find(x => x.id === id) || registry.find(x => x.func === id);
    if (!e) throw new Error(`fn ${id}: нет в реестре (id или func)`);
    if (e.hidden) notes.push(`${e.id}: запись скрыта (FAIL в движке) — вставляй осторожно`);
    return e;
  };
  switch (cmd) {
    case 'cast': return { node: M.createCast(w[0], { kind: w.includes('class') ? 'class' : 'object', pure: w.includes('pure') }), kind: cmd };
    case 'event': return { node: M.createCustomEvent(w[0], w.slice(1)), kind: cmd };
    case 'event-for': { const o = optSig(w); return { node: M.createEventFor(o.rest[0], o.rest[1], { sig: o.sig, params: o.rest.length > 2 ? o.rest.slice(2) : undefined }), kind: cmd }; }
    case 'call-event': { const ev = nodes.find(x => x.eventName === w[0]); return { node: M.createCallCustomEvent(ev || w[0], kv(w.slice(1))), kind: cmd }; }
    case 'bind': case 'unbind': case 'clear': { const o = optSig(w); return { node: M.createDelegateNode(cmd, o.rest[0], { sig: o.sig, params: o.rest.length > 1 ? o.rest.slice(1) : undefined }), kind: cmd }; }
    case 'create-event': return { node: M.createCreateEvent(w[0]), kind: cmd };
    case 'widget': return { node: M.createWidget(w[0] && w[0].toLowerCase() !== 'none' ? w[0] : null), kind: cmd };
    case 'call': return { node: M.createCall(w[0], w.slice(1).filter(x => x !== 'pure' && x !== 'static'), { pure: w.includes('pure'), isStatic: w.includes('static') }), kind: cmd };
    case 'ia-event': return { node: M.createInputActionEvent(w[0], w[1] || 'bool'), kind: cmd };
    case 'ia-value': return { node: M.createInputActionValue(w[0], w[1] || 'vector2d'), kind: cmd };
    case 'get': case 'set': return { node: M.createMemberVar(cmd, w[0], w[1], w.slice(2).join(' ')), kind: cmd };
    // bp — класс «своего» BP для self-пина своих переменных (make-node: --bp/--root).
    case 'self-get': case 'self-set': return { node: M.createSelfVar(cmd.slice(5), w[0], w[1], w.slice(2).join(' '), { bp }), kind: cmd };
    case 'local-get': case 'local-set': {
      const d = w[0].indexOf('.'); if (d < 0) throw new Error(`${cmd} ${w[0]}: формат <Функция>.<Имя>`);
      const [sc, nm] = [w[0].slice(0, d), w[0].slice(d + 1)];
      return { node: cmd === 'local-get' ? M.createLocalVarGet(sc, nm, w[1]) : M.createLocalVarSet(sc, nm, w[1], w.slice(2).join(' ')), kind: cmd };
    }
    case 'fn': { const e = entry(w[0]); return { node: M.createFn(e, kv(w.slice(1))), kind: cmd }; }
    case 'link': case 'set': return { directive: cmd, args: w };
    default: throw new Error(`неизвестная спека «${cmd}» (cast|event|event-for|call-event|bind|unbind|clear|create-event|widget|ia-event|ia-value|call|get|set|self-get|self-set|local-get|local-set|fn|link|set)\n  типы: ${SPEC_TYPES}`);
  }
}

const MARK_RE = /@([a-zA-Z][\w.-]*)=([^\s]+)/g;
const num = v => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);

/** Текст спеки → { nodes:[{idx,spec,marks,kind,line}], links:[[a,b]], settings:{} }.
 *  Разбор строгий: дубль номера/ячейки или нераспознанная строка = ошибка, а не «молчаливый 0». */
export function parseSpec(text) {
  const spec = { nodes: [], links: [], settings: {} };
  const lines = String(text).replace(/^/, '').split(/\r?\n/);
  lines.forEach((raw, li) => {
    let line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('```')) return;
    line = line.replace(/\s#.*$/, '').trim();
    const marks = {};
    line = line.replace(MARK_RE, (_, k, v) => { marks[k] = num(v); return ''; }).replace(/\s+$/, '');
    const [cmd, ...rest] = line.split(/\s+/);
    if (cmd === 'link') {
      if (rest.length !== 2 || !rest.every(x => /^\d+\.\S+$/.test(x)))
        throw new Error(`строка ${li + 1}: link — формат "<номер>.<пин-выход> <номер>.<пин-вход>", получено «${line}»`);
      spec.links.push(rest); return;
    }
    if (cmd === 'set') {
      if (rest.length !== 2) throw new Error(`строка ${li + 1}: set <ключ> <значение>`);
      spec.settings[rest[0]] = num(rest[1]); return;
    }
    if (!/^\d+$/.test(cmd))
      throw new Error(`строка ${li + 1}: «${line}» — ожидается "<номер> <спека> [@mark=…]", "link …", "set …" или "#" (comment)`);
    const idx = Number(cmd);
    if (!rest.length) throw new Error(`строка ${li + 1}: у узла ${idx} нет спеки`);
    if (spec.nodes.some(n => n.idx === idx)) throw new Error(`узел ${idx}: дубль номера`);
    for (const key of ['row', 'col']) {
      if (typeof marks[key] !== 'number') throw new Error(`узел ${idx}: нужна марка @${key}=<число> (позиционирование задаёт генератор, а не угадывает)`);
    }
    spec.nodes.push({ idx, spec: rest.join(' '), marks, line });
  });
  if (!spec.nodes.length) throw new Error('спека пуста: нет ни одной строки узла');
  const seen = new Set();
  for (const n of spec.nodes) {
    const key = `${n.marks.row}:${n.marks.col}`;
    if (seen.has(key)) throw new Error(`узел ${n.idx}: @row=${n.marks.row} @col=${n.marks.col} уже занят — две ноды не могут стоять в одной ячейке`);
    seen.add(key);
  }
  spec.nodes.sort((a, b) => a.idx - b.idx);
  return spec;
}

/** Марки → координаты грубой сетки. Никакой геометрии нод: только ряд/столбец. */
export function placeByMarks(nodes, { colStep = 400, rowStep = 320, x0 = 0, y0 = 0, grid = 16 } = {}) {
  const snap = v => Math.round(v / grid) * grid;
  for (const n of nodes) {
    const { row = 0, col = 0 } = n.mark || {};
    n.pos = { x: snap(x0 + col * colStep), y: snap(y0 + row * rowStep) };
  }
  return nodes;
}

/** Уровень строки: целая часть @row (2.5 → 2, «подстрока данных» того же уровня). */
export const levelOf = row => Math.floor(row);

/** Ряды расстановки из марок: [{ row, level, nodes: [...] }] слева направо по @col.
 *  `level` — целый уровень строки (2.5 → 2); ступень 2 пока кладёт каждый @row в отдельный
 *  ряд, это зафиксированное расхождение (tests/three-stage-01.sequence.md §4). */
export function rowsFromMarks(nodes) {
  const byRow = new Map();
  for (const n of nodes) {
    const row = n.mark?.row ?? 0;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(n);
  }
  return [...byRow.entries()].sort((a, b) => a[0] - b[0])
    .map(([row, list]) => ({ row, level: levelOf(row), nodes: list.slice().sort((a, b) => (a.mark?.col ?? 0) - (b.mark?.col ?? 0)) }));
}

/** Модель ↔ текст: сериализованный код должен содержать все ноды/пины/связи модели.
 *  Дополнительные пины допускаются только «достроенные движком» (self/NotEqual_*). */
export function verifyStage1(nodes, text) {
  const problems = [];
  const graphs = parseToGraphs(text);
  const parsed = graphs.EventGraph.nodes;
  if (parsed.length !== nodes.length) problems.push(`round-trip: нод в тексте ${parsed.length}, в модели ${nodes.length}`);
  const byName = new Map(parsed.map(n => [n.id, n]));
  for (const n of nodes) {
    const p = byName.get(n.id);
    if (!p) { problems.push(`round-trip: нода ${n.id} потеряна при сериализации`); continue; }
    if (p.pos.x !== Math.round(n.pos.x) || p.pos.y !== Math.round(n.pos.y))
      problems.push(`round-trip: ${n.id}: позиция в тексте (${p.pos.x},${p.pos.y}) ≠ марок (${Math.round(n.pos.x)},${Math.round(n.pos.y)})`);
    const extras = p.pins.filter(pp => !n.pins.some(x => x.id === pp.id));
    for (const pp of extras) if (pp.name !== 'self' && !/^NotEqual_/.test(pp.name)) problems.push(`round-trip: ${n.id}: лишний пин ${pp.name}`);
    for (const pp of n.pins) {
      const q = p.pins.find(x => x.id === pp.id);
      if (!q) { problems.push(`round-trip: ${n.id}: пин ${pp.name} потерян`); continue; }
      if (q.category !== pp.category || q.direction !== pp.direction)
        problems.push(`round-trip: ${n.id}.${pp.name}: тип/направление распались (${q.direction} ${q.category} ≠ ${pp.direction} ${pp.category})`);
      if (q.linkedTo.length !== pp.linkedTo.length)
        problems.push(`round-trip: ${n.id}.${pp.name}: связей ${q.linkedTo.length}, в модели ${pp.linkedTo.length}`);
    }
  }
  // Симметрия связей в модели (движок принимает связь только при двусторонней записи).
  for (const n of nodes) for (const p of n.pins) for (const l of p.linkedTo) {
    const other = nodes.find(x => x.id === l.nodeName);
    const op = other?.pins.find(x => x.id === l.pinId);
    if (!op) { problems.push(`связь ${n.id}.${p.name} → ${l.nodeName}/${l.pinId}: конец не найден`); continue; }
    if (!op.linkedTo.some(x => x.nodeName === n.id && x.pinId === p.id))
      problems.push(`связь ${n.id}.${p.name} → ${other.id}.${op.name}: односторонняя`);
  }
  return problems;
}

/** Полный проход ступени 1: спека → коды нод + самопроверка.
 *  Возвращает { nodes, byIndex, spec, links, text, validation, problems }. */
export function createStage1Graph(specText, { registry = [], colStep, rowStep, grid, x0, y0, root } = {}) {
  const spec = parseSpec(specText);
  const settings = { colStep: 400, rowStep: 320, grid: 16, x0: 0, y0: 0, nameBase: 0, ...spec.settings };
  for (const [k, v] of Object.entries({ colStep, rowStep, grid, x0, y0 })) if (v !== undefined) settings[k] = v;

  const nodes = [], byIndex = new Map(), notes = [];
  for (const s of spec.nodes) {
    let built;
    try { built = buildSpecNode(s.spec, { registry, nodes, notes }); }
    catch (e) { throw new Error(`узел ${s.idx} («${s.spec}»): ${e.message}`); }
    if (built.directive) throw new Error(`узел ${s.idx}: директива ${built.directive} не ожидается здесь`);
    const n = built.node;
    // nameBase: имя узла = <Класс>_<nameBase + номер узла> — чтобы «узел 7» из спеки,
    // «K2Node_CallFunction_1007» в тексте и «#7» в отчёте были одним и тем же узлом.
    if (settings.nameBase) n.id = `${(n.rawClass || n.className).split('.').pop()}_${settings.nameBase + s.idx}`;
    n.mark = { ...s.marks, index: s.idx, kind: built.kind };
    n.specLine = s.line;
    nodes.push(n); byIndex.set(s.idx, n);
  }

  const links = [];
  for (const [a, b] of spec.links) {
    const [ia, pa] = [Number(a.slice(0, a.indexOf('.'))), a.slice(a.indexOf('.') + 1)];
    const [ib, pb] = [Number(b.slice(0, b.indexOf('.'))), b.slice(b.indexOf('.') + 1)];
    const A = byIndex.get(ia), B = byIndex.get(ib);
    if (!A || !B) throw new Error(`link ${a} ${b}: нет узла ${!A ? ia : ib}`);
    if (A === B) throw new Error(`link ${a} ${b}: выход и вход на одной ноде`);
    const pinA = findPin(A, pa, 'Output'), pinB = findPin(B, pb, 'Input');
    linkPins(A, pinA, B, pinB);
    links.push({ source: A, out: pinA, target: B, input: pinB, from: a, to: b });
  }

  placeByMarks(nodes, settings);
  const text = generateUEText(nodes, root ? { root } : {});
  const validation = validateStrict(text);
  const problems = verifyStage1(nodes, text);
  // «Висячие» пины — частый симптом незаполненной спеки. Предупреждения, не ошибки:
  // terminal-узел без потребителя — норма, а вот невключённая ветка Sequence/Branch — нет.
  const warnings = [];
  for (const n of nodes) {
    const execIn = n.pins.filter(p => p.direction === 'Input' && p.category === 'exec' && !p.hidden);
    const execOut = n.pins.filter(p => p.direction === 'Output' && p.category === 'exec' && !p.hidden);
    if (execIn.length && execIn.every(p => !p.linkedTo.length)) warnings.push(`${n.title} (${n.id}): ни один exec-вход не подключён`);
    if (execOut.length > 1) for (const p of execOut) if (!p.linkedTo.length) warnings.push(`${n.title} (${n.id}): ветка ${p.name} не подключена`);
    for (const p of n.pins) if (p.direction === 'Input' && p.category !== 'exec' && !p.hidden && !p.linkedTo.length && !(p.defaultValue || '').length && p.name !== 'self' && p.name !== 'WorldContextObject')
      warnings.push(`${n.title} (${n.id}): вход ${p.name} пуст и не подключён`);
  }
  return { nodes, byIndex, spec, links, text, validation, problems, warnings: [...notes, ...warnings], settings };
}

/** Человекочитаемая сводка ступени 1 (для отчёта в тесте/CLI). */
export function describeStage1({ nodes }) {
  return nodes.map(n => ({
    index: n.mark?.index, id: n.id, title: n.title, className: n.className,
    row: n.mark?.row, col: n.mark?.col, pos: { ...n.pos },
    // →/← направление; =значение — незаполненный вход с литералом; * — пин без связи и без значения
    pins: n.pins.filter(p => !p.hidden).map(p => `${p.direction === 'Output' ? '→' : '←'}${p.name}${p.linkedTo.length ? '' : (p.defaultValue ? `=${p.defaultValue}` : '*')}`),
    links: n.pins.flatMap(p => p.linkedTo.map(l => `${p.name} → ${l.nodeName}`)),
  }));
}

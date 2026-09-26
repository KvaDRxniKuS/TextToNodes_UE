// src/stage1.js — Ступень 1: «генератор нод».
//
// Зона ответственности (по трёхступенчатому конвейеру):
//   1) генератор нод — ЭТА СТУПЕНЬ. Отвечает за КОРРЕКТНОСТЬ нод: класс, количество,
//      входы/выходы (пины), значения по умолчанию. Принимает на вход последовательность
//      нод, соединения пинов и марки позиционирования, а отдаёт ТОЛЬКО КОД НОД.
//      Генератор НИКАК НЕ ДВИГАЕТ ноды (все NodePosX/NodePosY = 0) и НЕ СОЕДИНЯЕТ их
//      (ни одного LinkedTo в коде): он только ЗАКЛАДЫВАЕТ расположение и соединения —
//      разрешает спеку, проверяет, что пины под эти намерения существуют, и передаёт
//      намерения дальше как данные (marks + connections), а не как геометрию.
//   2) расстановщик   — src/arranger.js: материализует соединения (пины ↔ пины), ставит
//      черновые координаты по шаблонам и создаёт knot-переносы между уровнями.
//   3) декоратор      — src/decorator.js: выравнивает соединённые пины, зазор, knot'ы.
//
// Форма спеки (одна нода на строку, нумерация с 1 — ею ссылаются соединения):
//   # комментарий
//   set nameBase 1000        — имя узла = <Класс>_(nameBase + номер): «узел 7» видно в тексте
//   1 bind Actor.OnActorBeginOverlap          @row=0 @col=0
//   2 fn Sequence                              @row=0 @col=1
//   5 event-for Actor.OnActorBeginOverlap Evt  @row=1 @col=-1 @role=delegate-handler
//   link 5.OutputDelegate 1.Delegate           — <источник>.<выход> <приёмник>.<вход>
//   <спека> = любой тип make-node: cast|event|event-for|call-event|bind|unbind|clear|
//             create-event|widget|ia-event|ia-value|get|set|self-get|self-set|
//             local-get|local-set|fn|call
//   @mark=value — марки позиционирования; @row/@col обязательны, @row дробный
//             (2.5 = подряд уровнем 2, т.е. данные под исполняемой строкой уровня).
import { generateUEText, parseToGraphs } from './parser.js';
import { validateStrict } from './validate.js';
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
 *  управляющих строк (link/set — их обрабатывает вызывающая сторона).
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
 *  Разбор строгий: дубль номера/ячейки или нераспознанная строка = ошибка. */
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
      if (typeof marks[key] !== 'number') throw new Error(`узел ${idx}: нужна марка @${key}=<число> (генератор закладывает позиционирование, а не угадывает его)`);
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

/** Уровень строки: целая часть @row (2.5 → 2, «подстрока данных» того же уровня). */
export const levelOf = row => Math.floor(row);

/** Ряды расстановки из заложенных марок: [{ row, level, nodes:[…] }] слева направо по @col.
 *  Пригодны ступени 2: генератор по ним координаты НЕ считает. */
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

/** Модель ↔ текст: код обязан содержать ровно те ноды и пины, что заданы спекой,
 *  БЕЗ координат и БЕЗ проводов (их дело ступени 2). Лишние пины допускаются только
 *  «достроенные движком» (self/NotEqual_*). */
export function verifyStage1(nodes, text) {
  const problems = [];
  const parsed = parseToGraphs(text).EventGraph.nodes;
  if (parsed.length !== nodes.length) problems.push(`round-trip: нод в тексте ${parsed.length}, в модели ${nodes.length}`);
  const linkedInText = (text.match(/LinkedTo=\([^)]*\)/g) || []).filter(s => !/\(\s*\)/.test(s)).length;
  if (linkedInText) problems.push(`ступень 1 не соединяет ноды: в тексте ${linkedInText} непустых LinkedTo`);
  const byName = new Map(parsed.map(n => [n.id, n]));
  for (const n of nodes) {
    const p = byName.get(n.id);
    if (!p) { problems.push(`round-trip: нода ${n.id} потеряна при сериализации`); continue; }
    if (n.pos.x || n.pos.y || p.pos.x || p.pos.y)
      problems.push(`ступень 1 не двигает ноды: ${n.id} имеет координаты (текст: ${p.pos.x},${p.pos.y}; модель: ${n.pos.x},${n.pos.y})`);
    if (/Knot|EdGraphNode_Comment/.test(p.className)) problems.push(`ступень 1 не создаёт knot'ы/комменты: ${n.id} (${p.className})`);
    const extras = p.pins.filter(pp => !n.pins.some(x => x.id === pp.id));
    for (const pp of extras) if (pp.name !== 'self' && !/^NotEqual_/.test(pp.name)) problems.push(`round-trip: ${n.id}: лишний пин ${pp.name}`);
    for (const pp of n.pins) {
      const q = p.pins.find(x => x.id === pp.id);
      if (!q) { problems.push(`round-trip: ${n.id}: пин ${pp.name} потерян`); continue; }
      if (q.name !== pp.name || q.category !== pp.category || q.direction !== pp.direction)
        problems.push(`round-trip: ${n.id}.${pp.name}: пин распался (${q.direction} ${q.category} ≠ ${pp.direction} ${pp.category})`);
      if (q.linkedTo.length) problems.push(`ступень 1 не соединяет ноды: ${n.id}.${pp.name} уже имеет связь`);
    }
  }
  return problems;
}

/** Полный проход ступени 1: спека → КОД НОД + заложенные марки/соединения + самопроверки.
 *  Возвращает { nodes, byIndex, spec, marks, connections, text, validation, problems, warnings }. */
export function createStage1Graph(specText, { registry = [], nameBase, root } = {}) {
  const spec = parseSpec(specText);
  const settings = { nameBase: 0, ...spec.settings };
  if (nameBase !== undefined) settings.nameBase = nameBase;

  const nodes = [], byIndex = new Map(), notes = [];
  for (const s of spec.nodes) {
    let built;
    try { built = buildSpecNode(s.spec, { registry, nodes, notes }); }
    catch (e) { throw new Error(`узел ${s.idx} («${s.spec}»): ${e.message}`); }
    if (built.directive) throw new Error(`узел ${s.idx}: директива ${built.directive} не ожидается здесь`);
    const n = built.node;
    // nameBase: имя узла = <Класс>_(nameBase + номер узла) — чтобы «узел 7» из спеки,
    // «K2Node_CallFunction_1007» в тексте и «#7» в отчёте были одним и тем же узлом.
    if (settings.nameBase) n.id = `${(n.rawClass || n.className).split('.').pop()}_${settings.nameBase + s.idx}`;
    n.pos = { x: 0, y: 0 };        // генератор НЕ двигает: геометрия — дело ступени 2
    n.mark = { ...s.marks, index: s.idx, kind: built.kind };
    n.specLine = s.line;
    nodes.push(n); byIndex.set(s.idx, n);
  }

  // Соединения РАЗРЕШАЮТСЯ (проверяется, что пины под намерение существуют — это и есть
  // компетенция генератора «входы/выходы»), но В ПИНЫ НЕ ЗАПИСЫВАЮТСЯ: расстановщик
  // материализует их своим проходом вместе с координатами.
  const connections = [];
  spec.links.forEach(([a, b], i) => {
    const [ia, pa] = [Number(a.slice(0, a.indexOf('.'))), a.slice(a.indexOf('.') + 1)];
    const [ib, pb] = [Number(b.slice(0, b.indexOf('.'))), b.slice(b.indexOf('.') + 1)];
    const A = byIndex.get(ia), B = byIndex.get(ib);
    if (!A || !B) throw new Error(`link ${a} ${b}: нет узла ${!A ? ia : ib}`);
    if (A === B) throw new Error(`link ${a} ${b}: выход и вход на одной ноде`);
    const outName = findPin(A, pa, 'Output'), inName = findPin(B, pb, 'Input');
    const out = A.pins.find(p => p.name === outName && p.direction === 'Output');
    const input = B.pins.find(p => p.name === inName && p.direction === 'Input');
    if (out.linkedTo.some(l => l.pinId === input.id) || input.linkedTo.some(l => l.pinId === out.id))
      throw new Error(`link ${a} ${b}: связь уже есть в модели — ступень 1 их не создаёт, проверь спеку`);
    connections.push({
      n: i + 1, from: { index: ia, node: A.id, pin: out.name, pinId: out.id },
      to: { index: ib, node: B.id, pin: input.name, pinId: input.id },
      category: out.category, exec: out.category === 'exec', spec: `link ${a} ${b}`,
    });
  });

  const text = generateUEText(nodes, root ? { root } : {});
  const validation = validateStrict(text);
  const problems = verifyStage1(nodes, text);

  // Предупреждения по ЗАЛОЖЕННЫМ соединениям (в пинах их ещё нет намеренно).
  const warnings = [...notes];
  const linked = new Map();   // nodeId|pinName → число соединений
  for (const c of connections) {
    linked.set(`${c.from.node}|${c.from.pin}`, (linked.get(`${c.from.node}|${c.from.pin}`) || 0) + 1);
    linked.set(`${c.to.node}|${c.to.pin}`, (linked.get(`${c.to.node}|${c.to.pin}`) || 0) + 1);
  }
  for (const n of nodes) {
    const execIn = n.pins.filter(p => p.direction === 'Input' && p.category === 'exec' && !p.hidden);
    const execOut = n.pins.filter(p => p.direction === 'Output' && p.category === 'exec' && !p.hidden);
    if (execIn.length && execIn.every(p => !linked.get(`${n.id}|${p.name}`))) warnings.push(`${n.title} (${n.id}): ни один exec-вход не заявлен в link`);
    if (execOut.length > 1) for (const p of execOut) if (!linked.get(`${n.id}|${p.name}`)) warnings.push(`${n.title} (${n.id}): ветка ${p.name} не заявлена в link`);
    for (const p of n.pins) if (p.direction === 'Input' && p.category !== 'exec' && !p.hidden && !linked.get(`${n.id}|${p.name}`) && !(p.defaultValue || '').length && p.name !== 'self' && p.name !== 'WorldContextObject')
      warnings.push(`${n.title} (${n.id}): вход ${p.name} пуст и не заявлен в link`);
  }
  // Двойное соединение в один exec-вход — законно (слияние веток), но стоит показать.
  for (const c of connections) {
    const dup = connections.filter(x => x.to.node === c.to.node && x.to.pin === c.to.pin);
    if (dup.length > 1 && c === dup[0]) warnings.push(`${c.to.node}.${c.to.pin}: вход принимает ${dup.length} соединения (${dup.map(d => `${d.from.node}.${d.from.pin}`).join(', ')})`);
  }
  return { nodes, byIndex, spec, marks: nodes.map(n => ({ index: n.mark.index, id: n.id, row: n.mark.row, col: n.mark.col })), connections, text, validation, problems, warnings, settings };
}

/** Человекочитаемая сводка ступени 1 (отчёт теста/CLI): ноды, пины, заложенные связи. */
export function describeStage1({ nodes, connections = [] }) {
  return nodes.map(n => ({
    index: n.mark?.index, id: n.id, title: n.title, className: n.className,
    row: n.mark?.row, col: n.mark?.col, pos: { ...n.pos },
    // →/← направление; =значение — литерал на входе; ⚬ — пин без заложенного соединения
    pins: n.pins.filter(p => !p.hidden).map(p => {
      const used = connections.some(c => c.from.node === n.id && c.from.pin === p.name)
        || connections.some(c => c.to.node === n.id && c.to.pin === p.name);
      return `${p.direction === 'Output' ? '→' : '←'}${p.name}${used ? '' : (p.defaultValue ? `=${p.defaultValue}` : '⚬')}`;
    }),
    lays: connections.filter(c => c.from.node === n.id).map(c => `${c.from.pin} ⇢ ${c.to.node}.${c.to.pin}`),
  }));
}

// Generator helpers for AI — строит ноды по реестру data/ue-functions.json,
// совместимые с generateUEText() из parser.js и строгим src/validate.js.
import { guid32 } from './parser.js';
import { UE_LIBS, UE_STRUCTS, UE_ENUMS, UE_MACROS, classRef, classDisplayName } from './ue-types.js';

let seq = 100;
const nextId = prefix => `${prefix}_${seq++}`;

export function mkPin(name, direction, category, opts = {}) {
  return {
    id: guid32(), name, friendly: opts.friendly || name, direction, category,
    subCategory: opts.sub || '', subCategoryObject: opts.subObj || '', isConst: !!opts.const,
    isRef: !!opts.ref, container: opts.container || 'None', ignored: !!opts.ignored, advanced: !!opts.advanced,
    defaultValue: opts.dv || '', hidden: !!opts.hidden, linkedTo: [],
    memberRef: opts.memberRef || '', defaultObject: opts.defObj || '',
    autoDefault: opts.auto || '',
  };
}

function baseNode(prefix, classShort, pos = { x: 0, y: 0 }) {
  return {
    id: nextId(prefix), className: `BlueprintGraph.${classShort}`,
    rawClass: `/Script/BlueprintGraph.${classShort}`,
    guid: guid32(), pos, pins: [], title: classShort,
  };
}

/** Нода вызова функции из записи реестра (CallFunction / CallArrayFunction). */
export function createCallFunction(regEntry, pos = { x: 0, y: 0 }) {
  const short = regEntry.className.split('.').pop();
  // Имя узла = класс узла (как в живых копиях UE); раньше все получали префикс K2Node_CallFunction (round8).
  const n = baseNode(short, short, pos);
  n.funcName = regEntry.func;
  n.title = regEntry.title || regEntry.func;
  if (regEntry.pure) n.pure = true;
  if (regEntry.lib) {
    if (!UE_LIBS[regEntry.lib]) throw new Error(`Unknown lib in registry: ${regEntry.lib} (${regEntry.id})`);
    n.memberParent = UE_LIBS[regEntry.lib];
  }
  for (const p of regEntry.pins || []) {
    const o = { sub: p.sub || '' };
    if (p.cat === 'real') o.sub = p.sub || 'double';
    if (p.cat === 'struct' && p.sub) {
      if (!UE_STRUCTS[p.sub]) throw new Error(`Unknown struct in registry: ${p.sub} (${regEntry.id}.${p.name})`);
      o.subObj = UE_STRUCTS[p.sub];
    }
    if ((p.cat === 'object' || p.cat === 'class') && p.object) o.subObj = classRef(p.object);
    if (p.enum) o.subObj = UE_ENUMS[p.enum] || p.enum;
    if (p.const) o.const = true;
    if (p.ref) o.ref = true;
    if (p.container) o.container = p.container;
    if (p.ignored) o.ignored = true;
    if (p.advanced) o.advanced = true;
    if (p.dv) o.dv = p.dv;
    o.auto = p.autoDv !== undefined ? p.autoDv : (p.dv || ''); // автоген = объявленный дефолт реестра (не пользовательский)
    if (p.hidden) o.hidden = true;
    if (p.memberRef) o.memberRef = p.memberRef;
    if (p.defObj) o.defObj = p.defObj;
    n.pins.push(mkPin(p.name, p.dir, p.cat, o));
  }
  return n;
}

/** PromotableOperator из записи реестра (Greater_Float и т.п.). */
export function createOperator(regEntry, pos = { x: 0, y: 0 }) {
  const n = baseNode('K2Node_PromotableOperator', 'K2Node_PromotableOperator', pos);
  const func = regEntry.func || '';
  // func вида Add_IntInt / EqualEqual_StrStr: OperationName — часть до '_', MemberName — целиком.
  // BooleanAND и т.п.: MemberName — как есть (форма не проверена движком, см. реестр note).
  n.operationName = func.includes('_') ? func.split('_')[0] : func;
  n.opMemberName = func.includes('_') || /^Boolean/.test(func) ? func : `${func}_DoubleDouble`;
  n.title = regEntry.title || func;
  for (const p of regEntry.pins || []) {
    const o = { sub: p.sub || '' };
    if (p.cat === 'real') o.sub = p.sub || 'double';
    n.pins.push(mkPin(p.name, p.dir, p.cat, o));
  }
  return n;
}

/** K2Node_MacroInstance из записи реестра (ForLoop, Gate, ...). */
export function createMacroInstance(regEntry, pos = { x: 0, y: 0 }) {
  const m = regEntry.macro || UE_MACROS[regEntry.id] || {};
  if (!m.graph) throw new Error(`No macro graph for ${regEntry.id}`);
  const n = baseNode('K2Node_MacroInstance', 'K2Node_MacroInstance', pos);
  n.macroGraph = m.graph;
  n.macroGuid = m.guid || null;
  n.title = regEntry.title || m.graph;
  for (const p of regEntry.pins || []) {
    const o = { sub: p.sub || '' };
    if (p.cat === 'real') o.sub = p.sub || 'double';
    if (p.container) o.container = p.container;
    if (p.dv) o.dv = p.dv;
    o.auto = p.autoDv !== undefined ? p.autoDv : (p.dv || ''); // автоген = объявленный дефолт реестра (не пользовательский)
    n.pins.push(mkPin(p.name, p.dir, p.cat, o));
  }
  return n;
}

/** K2Node_MakeStruct / K2Node_BreakStruct из записи реестра. */
export function createStructNode(regEntry, pos = { x: 0, y: 0 }) {
  const short = regEntry.className.split('.').pop();
  const st = regEntry.struct || {};
  const structPath = st.path || UE_STRUCTS[st.name];
  if (!structPath) throw new Error(`No struct path for ${regEntry.id}`);
  const n = baseNode(short, short, pos);
  n.structType = structPath;
  n.title = regEntry.title || short;
  for (const p of regEntry.pins || []) {
    const o = { sub: p.sub || '' };
    if (p.cat === 'real') o.sub = p.sub || 'double';
    if (p.cat === 'struct' && p.sub) {
      if (!UE_STRUCTS[p.sub]) throw new Error(`Unknown struct: ${p.sub} (${regEntry.id}.${p.name})`);
      o.subObj = UE_STRUCTS[p.sub];
    }
    if ((p.cat === 'object' || p.cat === 'class') && p.object) o.subObj = classRef(p.object);
    if (p.const) o.const = true;
    if (p.ref) o.ref = true;
    if (p.container) o.container = p.container;
    if (p.ignored) o.ignored = true;
    if (p.advanced) o.advanced = true;
    if (p.dv) o.dv = p.dv;
    o.auto = p.autoDv !== undefined ? p.autoDv : (p.dv || ''); // автоген = объявленный дефолт реестра (не пользовательский)
    if (p.hidden) o.hidden = true;
    n.pins.push(mkPin(p.name, p.dir, p.cat, o));
  }
  return n;
}

/** K2Node_ExecutionSequence с n выходами. */
export function createSequence(nThen = 2, pos = { x: 0, y: 0 }) {
  const n = baseNode('K2Node_ExecutionSequence', 'K2Node_ExecutionSequence', pos);
  n.title = 'Sequence';
  n.pins.push(mkPin('execute', 'Input', 'exec'));
  for (let i = 0; i < nThen; i++) n.pins.push(mkPin(`then_${i}`, 'Output', 'exec'));
  return n;
}

/** Switch: kind 'int' | 'string' | 'enum', cases — массив имён case-пинов. */
export function createSwitch(kind, cases = [], pos = { x: 0, y: 0 }) {
  const map = {
    int: { cls: 'K2Node_SwitchInteger', sel: 'int', selSub: '' },
    string: { cls: 'K2Node_SwitchString', sel: 'string', selSub: '' },
    enum: { cls: 'K2Node_SwitchEnum', sel: 'byte', selSub: '' },
  };
  const k = map[kind];
  if (!k) throw new Error(`Unknown switch kind: ${kind}`);
  const n = baseNode('K2Node_Switch', k.cls, pos);
  n.title = `Switch (${kind})`;
  // round1: порядок движка — Default первый; Selection dv "0" только у int.
  n.pins.push(mkPin('Default', 'Output', 'exec'));
  n.pins.push(mkPin('execute', 'Input', 'exec'));
  n.pins.push(mkPin('Selection', 'Input', k.sel, { sub: k.selSub, ...(kind === 'int' ? { dv: '0' } : {}) }));
  for (const c of cases) n.pins.push(mkPin(String(c), 'Output', 'exec'));
  return n;
}

export function createVariableGet(varName, pos = { x: 0, y: 0 }) {
  return {
    id: nextId('K2Node_VariableGet'),
    className: 'BlueprintGraph.K2Node_VariableGet',
    rawClass: '/Script/BlueprintGraph.K2Node_VariableGet',
    guid: guid32(), pos, varName, title: `Get ${varName}`,
    pins: [
      { id: guid32(), name: varName, friendly: varName, direction: 'Output', category: 'real', subCategory: 'double', subCategoryObject: '', defaultValue: '', hidden: false, linkedTo: [] },
      { id: guid32(), name: 'self', friendly: 'self', direction: 'Input', category: 'object', subCategory: '', subCategoryObject: '', defaultValue: '', hidden: true, linkedTo: [] }
    ]
  };
}

export function createBranch(pos) {
  return {
    id: nextId('K2Node_IfThenElse'),
    className: 'BlueprintGraph.K2Node_IfThenElse',
    rawClass: '/Script/BlueprintGraph.K2Node_IfThenElse',
    guid: guid32(), pos, title: 'Branch',
    pins: [
      mkPin('execute', 'Input', 'exec'),
      mkPin('Condition', 'Input', 'bool', { dv: 'true' }),
      mkPin('then', 'Output', 'exec'),
      mkPin('else', 'Output', 'exec')
    ]
  };
}

/** K2Node_Knot (reroute) — форма из copy-back UE 5.8: wildcard + InputPin ignored. */
export function createKnot(pos = { x: 0, y: 0 }, category = 'wildcard') {
  return {
    id: nextId('K2Node_Knot'),
    className: 'BlueprintGraph.K2Node_Knot',
    rawClass: '/Script/BlueprintGraph.K2Node_Knot',
    guid: guid32(), pos, title: 'Reroute',
    pins: [
      mkPin('InputPin', 'Input', category, { ignored: true }),
      mkPin('OutputPin', 'Output', category),
    ]
  };
}

/** Узел произвольного класса из записи реестра (Switch, Variable, Make-узлы, Select).
 *  Механическое отображение без инференса: sub 'Array'/'Set'/'Map' → ContainerType
 *  (см. note MakeArray в реестре); переменным — varName-заглушка из имени пина
 *  (движок потребует настоящую переменную — это ожидаемо, см. sweep-манифест). */
export function createGeneric(regEntry, pos = { x: 0, y: 0 }) {
  const short = regEntry.className.split('.').pop();
  const n = baseNode(short, short, pos);
  n.title = regEntry.title || short;
  // round21c-pre: узлы вне модуля BlueprintGraph (InputBlueprintNodes и т.п.) — класс из реестра как есть.
  if (/^\/Script\/(?!BlueprintGraph\.)/.test(regEntry.className || '')) { n.rawClass = regEntry.className; n.className = regEntry.className.replace(/^\/Script\//, ''); }
  // round15-pre: произвольные свойства узла (напр. bReturnByRefDesired у GetArrayItem).
  if (regEntry.props) n.rawProps = Object.entries(regEntry.props).map(([k, v]) => `${k}=${v}`);
  if (short === 'K2Node_VariableGet' || short === 'K2Node_VariableSet') {
    const v = (regEntry.pins || []).find(p => !['execute', 'then', 'self'].includes(p.name));
    n.varName = v ? v.name : 'Var';
  }
  // round1b: SwitchEnum несёт Enum=/EnumEntries (live-реф SwitchEnum_0).
  if (short === 'K2Node_SwitchEnum' && regEntry.enum) {
    if (!UE_ENUMS[regEntry.enum]) throw new Error(`Unknown enum in registry: ${regEntry.enum} (${regEntry.id})`);
    n.enumRef = UE_ENUMS[regEntry.enum];
    n.enumEntries = regEntry.enumEntries || [];
  }
  for (const p of regEntry.pins || []) {
    const o = {};
    if (p.sub === 'Array' || p.sub === 'Set' || p.sub === 'Map') o.container = p.sub;
    else o.sub = p.sub || '';
    if (p.cat === 'real' && !o.container) o.sub = p.sub || 'double';
    if (p.cat === 'struct' && p.sub) {
      if (!UE_STRUCTS[p.sub]) throw new Error(`Unknown struct in registry: ${p.sub} (${regEntry.id}.${p.name})`);
      o.subObj = UE_STRUCTS[p.sub];
    }
    if ((p.cat === 'object' || p.cat === 'class') && p.object) o.subObj = classRef(p.object);
    if (p.enum) o.subObj = UE_ENUMS[p.enum] || p.enum;
    if (p.const) o.const = true;
    if (p.ref) o.ref = true;
    if (p.container) o.container = p.container;
    if (p.ignored) o.ignored = true;
    if (p.advanced) o.advanced = true;
    if (p.dv) o.dv = p.dv;
    o.auto = p.autoDv !== undefined ? p.autoDv : (p.dv || ''); // автоген = объявленный дефолт реестра (не пользовательский)
    if (p.hidden) o.hidden = true;
    if (p.memberRef) o.memberRef = p.memberRef;
    if (p.defObj) o.defObj = p.defObj;
    n.pins.push(mkPin(p.name, p.dir, p.cat, o));
  }
  // round25-pre: CustomEvent — параметры события = UserDefinedPin (строки после пинов, как в копиях UE).
  if (regEntry.userPins) n.tailProps = regEntry.userPins.map(u => {
    const obj = u.object ? `,PinSubCategoryObject=${classRef(u.object)}` : '';
    const sub = u.cat === 'real' ? (u.sub || 'double') : (u.sub || '');
    return `CustomProperties UserDefinedPin (PinName="${u.name}",PinType=(PinCategory="${u.cat}"${sub ? `,PinSubCategory="${sub}"` : ''}${obj}),DesiredPinDirection=EGPD_Output)`;
  });
  // round8-fix3: K2Node_Select — IndexPinType из пина Index (live-рефы round8-fix3; wildcard = пустой Select без IndexPinType).
  if (short === 'K2Node_Select') {
    const ix = n.pins.find(p => p.name === 'Index');
    if (ix && ix.category !== 'wildcard') n.selectIndex = { cat: ix.category, sub: ix.subCategory || '', subObj: ix.subCategoryObject || '' };
  }
  return n;
}

/** round22: каст к ЛЮБОМУ классу (нативному или BP).
 *  kind 'object' → K2Node_DynamicCast (Object → As<Name>), verified R21b/R22;
 *  kind 'class'  → K2Node_ClassDynamicCast (Class → As<Name> типа class), форма из копии пользователя R22.
 *  pure → PureState=Pure без exec (не подтверждено). */
export function createCast(target, { kind = 'object', pure = false } = {}, pos = { x: 0, y: 0 }) {
  const short = kind === 'class' ? 'K2Node_ClassDynamicCast' : 'K2Node_DynamicCast';
  const n = baseNode(short, short, pos);
  const cref = classRef(target);
  const disp = classDisplayName(target);
  n.title = `Cast To ${disp}${kind === 'class' ? ' Class' : ''}`;
  n.rawProps = [`TargetType=${cref}`];
  if (kind === 'class' || pure) n.rawProps.push(`PureState=${pure ? 'Pure' : 'Impure'}`);
  if (!pure) n.pins.push(mkPin('execute', 'Input', 'exec'), mkPin('then', 'Output', 'exec'), mkPin('CastFailed', 'Output', 'exec'));
  const cat = kind === 'class' ? 'class' : 'object';
  n.pins.push(mkPin(kind === 'class' ? 'Class' : 'Object', 'Input', cat, { subObj: classRef('/Script/CoreUObject.Object') }));
  n.pins.push(mkPin('As' + disp, 'Output', cat, { subObj: cref }));
  n.pins.push(mkPin('bSuccess', 'Output', 'bool', { hidden: !pure }));
  return n;
}

/** Диспетчер sweep-прогона: любая запись реестра → узел.
 *  Бросает только на неизвестных путях (struct/enum/lib) — это сигнал «нужен референс». */
export function createFromEntry(e, pos = { x: 0, y: 0 }) {
  const short = (e.className || '').split('.').pop();
  if (short === 'K2Node_CallFunction' || short === 'K2Node_CallArrayFunction' || short === 'K2Node_CommutativeAssociativeBinaryOperator') return createCallFunction(e, pos);
  if (short === 'K2Node_PromotableOperator') return createOperator(e, pos);
  if (short === 'K2Node_MacroInstance') return createMacroInstance(e, pos);
  if (short === 'K2Node_MakeStruct' || short === 'K2Node_BreakStruct') return createStructNode(e, pos);
  if (short === 'K2Node_IfThenElse') return createBranch(pos);
  if (short === 'K2Node_ExecutionSequence') return createSequence((e.pins || []).filter(p => /^then_\d+$/.test(p.name)).length || 2, pos);
  if (short === 'K2Node_Knot') return createKnot(pos);
  if (short === 'EdGraphNode_Comment') return createComment('SWEEP: ' + (e.title || e.id), pos);
  return createGeneric(e, pos);
}

export function createComment(text, pos = { x: 0, y: 0 }, w = 400, h = 180) {
  return {
    id: nextId('EdGraphNode_Comment'), className: 'UnrealEd.EdGraphNode_Comment',
    rawClass: '/Script/UnrealEd.EdGraphNode_Comment',
    guid: guid32(), pos, title: 'Comment', commentText: text,
    isComment: true, width: w, height: h, pins: [],
  };
}

/** Комментарий, накрывающий ноды: бокс по граням + отступы (L-фидбек: 400x180 не накрывает). */
/** Шаг строки пинов (px). Единая оценка для fitComment и alignPinRow. */
export const PIN_ROW_H = 22;
// Engine copy-back (R28): an extra title/subtitle header line shifts node pins by ~32 px.
export const HEADER_LINE_H = 32;

/** Оценка ширины ноды (px) — по геометрии Slate-ноды, а не по фиксированной базе класса.
 *  R30-фидбек: база 340 у CallFunction завышала (Pause Timer by Handle в движке ≈ 288) — knot переноса
 *  вставал не соосно выходу. Модель: max(шапка, тело пинов), где
 *  • шапка = отступы 64 (10 слева + иконка + 30 справа) + max(заголовок ×7.6, подзаголовок ×7.0);
 *    подзаголовок CallFunction — «Target is <Класс>» (кроме self-контекста), CustomEvent — «Custom Event»;
 *  • тело = 12 + макс. входная строка (иконка 18 + подпись ×6.2 + виджет дефолта) + 24 + макс. выходная (подпись + 18) + 12;
 *    скрытые и свёрнутые advanced-пины места не занимают; execute/then без подписи; self → «Target».
 *  Компактные узлы (Get переменной, операторы) — без шапки. Числа — оценка (±1 клетка сетки), не измерение. */
const CH = { title: 7.6, sub: 7.0, pin: 6.2 };
/** FName::NameToDisplayString (упрощённо): InString → In String, Axis2D → Axis 2D, '_' → пробел. */
export const displayName = s => String(s || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/\s+/g, ' ').trim();
/** Подпись пина в редакторе ('' — без подписи). */
export function pinLabel(p) {
  if (!p) return '';
  if (p.category === 'exec' && (p.name === 'execute' || p.name === 'then')) return '';
  if (p.name === 'self') return 'Target';
  if (p.name === 'OutputDelegate' || p.name === 'Output_Get') return '';
  let s = p.friendly && p.friendly !== p.name ? p.friendly : p.name;
  if (p.category === 'bool' && /^b[A-Z]/.test(s)) s = s.slice(1);
  return displayName(s);
}
/** Ширина встроенного редактора дефолта у неподключённого входа (checkbox, число, текст, вектор, комбо, пикер). */
function pinWidgetWidth(p) {
  if (p.direction !== 'Input' || (p.linkedTo || []).length || p.ignored) return 0;
  if ((p.container || 'None') !== 'None') return 0;
  const dv = p.defaultValue || '';
  const sub = String(p.subCategoryObject || '').split('.').pop().replace(/['"]/g, '');
  switch (p.category) {
    case 'bool': return 18;
    case 'int': case 'int64': case 'real': return 40;
    case 'string': case 'name': case 'text': return Math.min(160, Math.max(44, CH.pin * dv.length + 20));
    case 'byte': return p.subCategoryObject ? Math.max(80, CH.pin * dv.length + 40) : 40;
    case 'class': return 120;
    case 'object': return p.defaultObject ? 140 : 0;
    case 'struct': return /^(Vector|Rotator)$/.test(sub) ? 120 : sub === 'Vector2D' ? 80 : sub === 'LinearColor' ? 40 : 0;
    default: return 0;
  }
}
/** Заголовок/подзаголовок ноды как в редакторе; compact — без шапки (Get переменной, операторы, Knot). */
function nodeTitleParts(n) {
  const cls = n.className || '';
  const parentName = ref => { const m = String(ref || '').match(/'([^']+)'/); return m ? classDisplayName(m[1]) : ''; };
  if (cls.includes('Knot') || cls.includes('VariableGet') || cls.includes('PromotableOperator') || cls.includes('CommutativeAssociativeBinaryOperator')) return { title: '', sub: '', compact: true };
  if (cls.includes('CustomEvent')) {
    const raw = (n.rawProps || []).find(l => l.startsWith('CustomFunctionName=')) || '';
    const name = n.eventName || (raw.match(/"([^"]*)"/) || [])[1] || (n.props && String(n.props.CustomFunctionName || '').replace(/"/g, '')) || n.title || '';
    return { title: name, sub: 'Custom Event' };
  }
  if (cls.includes('VariableSet')) return { title: 'SET', sub: '' };
  if (cls.includes('CallFunction') || cls.includes('CallArrayFunction')) {
    const t = n.title || n.funcName || '';
    const title = /\s/.test(t) ? t : displayName(t.replace(/^K2_/, '')); // K2_DestroyComponent → Destroy Component (DisplayName движка)
    const owner = parentName(n.memberParent);
    return { title, sub: owner ? `Target is ${owner}` : '' };
  }
  const t = n.title || cls.split('.').pop();
  return { title: /\s/.test(t) ? t : displayName(t.replace(/^K2Node_/, '')), sub: '' };
}
const MIN_W = [['Knot', 16], ['ExecutionSequence', 150], ['IfThenElse', 140], ['MakeStruct', 180], ['BreakStruct', 180], ['MacroInstance', 180], ['PromotableOperator', 120], ['CommutativeAssociativeBinaryOperator', 120], ['Switch', 160], ['Select', 150], ['CallFunction', 120]];
export function estNodeWidth(n) {
  if (!n) return 100;
  const cls = n.className || '';
  if (cls.includes('Comment')) return n.width || 400;
  if (cls.includes('Knot')) return 16;
  // Engine copy-back calibration: PrintString's actual right edge is ~176 px
  // from NodePosX, despite the generic title/subtitle estimate being wider.
  if (cls.includes('CallFunction') && (n.funcName || '').replace(/^K2_/, '') === 'PrintString') return 176;
  const vis = (n.pins || []).filter(p => !p.hidden && !(p.advanced && !n.advancedShown));
  const ins = vis.filter(p => p.direction === 'Input'), outs = vis.filter(p => p.direction === 'Output');
  const inW = Math.max(0, ...ins.map(p => { const l = pinLabel(p), w = pinWidgetWidth(p); return 18 + (l ? CH.pin * l.length + 4 : 0) + (w ? 6 + w : 0); }));
  const outW = Math.max(0, ...outs.map(p => { const l = pinLabel(p); return (l ? CH.pin * l.length + 4 : 0) + 18; }));
  const bodyW = 12 + inW + (ins.length && outs.length ? 24 : 0) + outW + 12;
  const { title, sub, compact } = nodeTitleParts(n);
  const delegateBox = (n.pins || []).some(p => p.name === 'OutputDelegate' && p.direction === 'Output') ? 24 : 0;
  const titleW = compact ? 0 : 64 + Math.max(CH.title * title.length, CH.sub * sub.length) + delegateBox;
  const minW = (MIN_W.find(([k]) => cls.includes(k)) || [0, 100])[1];
  return Math.ceil(Math.max(titleW, bodyW, minW));
}

/** Зазор между нодами в ряду (px). */
export const ROW_GAP = 120;

/** Ряд без наложений: каждая следующая нода встаёт за правым краем предыдущей + зазор.
 *  Вызывать ДО linkPins (выравнивание двигает только Y) и fitComment. */
export function layoutRow(nodes, x0 = 0, y = 0, gap = ROW_GAP) {
  let x = x0;
  for (const n of nodes) { n.pos.x = x; n.pos.y = y; x += estNodeWidth(n) + gap; }
  return nodes;
}

export function fitComment(text, nodes, pad = 60, topPad = 110, botPad = 110) {
  const minX = Math.min(...nodes.map(n => n.pos.x));
  const minY = Math.min(...nodes.map(n => n.pos.y));
  const maxRight = Math.max(...nodes.map(n => n.pos.x + estNodeWidth(n)));
  const estH = n => 110 + PIN_ROW_H * ((n.pins && n.pins.length) || 0);
  const maxBottom = Math.max(...nodes.map(n => n.pos.y + estH(n)));
  // round1: нижний отступ = topPad (было pad=60 — Sequence-3 визуально вышел за коммент).
  return createComment(text, { x: minX - pad, y: minY - topPad }, (maxRight - minX) + pad * 2, (maxBottom - minY) + topPad + botPad);
}

export function linkPins(fromNode, fromPinName, toNode, toPinName, opts = {}) {
  const fp = fromNode.pins.find(p => p.name === fromPinName && p.direction === 'Output');
  const tp = toNode.pins.find(p => p.name === toPinName && p.direction === 'Input');
  if (!fp || !tp) throw new Error(`Pin not found: ${fromNode.id}.${fromPinName} -> ${toNode.id}.${toPinName}`);
  fp.linkedTo.push({ nodeName: toNode.id, pinId: tp.id });
  tp.linkedTo.push({ nodeName: fromNode.id, pinId: fp.id });
  // Раскладка (N1+): целевой узел сдвигается по Y так, чтобы строки соединённых
  // пинов совпали (скрытые пины места не занимают). Несколько линков в один узел:
  // побеждает последний. Exec-цепочки не трогаем (остаются в ряд). Отказ: { align: false }.
  const isExecLink = fp.category === 'exec' && tp.category === 'exec';
  if (opts.align !== false && !isExecLink) alignPinRow(fromNode, fromPinName, toNode, toPinName);
}

/** Сдвинуть toNode по Y: строка toPinName встанет напротив fromPinName. */
export function alignPinRow(fromNode, fromPinName, toNode, toPinName) {
  const vis = n => (n.pins || []).filter(p => !p.hidden);
  const ia = vis(fromNode).findIndex(p => p.name === fromPinName);
  const ib = vis(toNode).findIndex(p => p.name === toPinName);
  if (ia < 0 || ib < 0) return;
  toNode.pos.y = fromNode.pos.y + (ia - ib) * PIN_ROW_H;
}

// ─── Декор (опционально): перенос рядов, exec-knot'ы, сетка 16 ───────────────
// Форма exec-knot'а — copy-back UE (BP_AISupportTester, 2026-09-26): K2Node_Knot, InputPin/OutputPin
// PinCategory="exec", InputPin bDefaultValueIsIgnored=True.

export const GRID = 16;
const snap = v => Math.round(v / GRID) * GRID;
export const estNodeHeight = n => (n.className || '').includes('Knot') ? 16 : 70 + PIN_ROW_H * Math.max(
  (n.pins || []).filter(p => !p.hidden && p.direction === 'Input').length,
  (n.pins || []).filter(p => !p.hidden && p.direction === 'Output').length);

/** Ряды с переносом: не больше perRow узлов или maxWidth px в ряду; каждый ряд с x0 (как строки текста).
 *  Возвращает массив рядов и Y под последним рядом. */
export function layoutRows(nodes, { x0 = 0, y0 = 0, perRow = 0, maxWidth = 0, gap = ROW_GAP, rowGap = 240 } = {}) {
  const rows = [[]]; let w = 0;
  for (const n of nodes) {
    const nw = estNodeWidth(n);
    const cur = rows[rows.length - 1];
    if (cur.length && (n.rowBreak || (perRow && cur.length >= perRow) || (maxWidth && w + nw > maxWidth))) { rows.push([]); w = 0; }
    rows[rows.length - 1].push(n); w += nw + gap;
  }
  let y = y0;
  for (const r of rows) {
    layoutRow(r, x0, y, gap);
    // Align connected exec pins pair-by-pair. A node can have several exec pins
    // at distinct rows (Branch.then / Branch.else); choosing one representative pin
    // per node is incorrect. Walk the row left-to-right and place each target from
    // the exact linked source/target pin centers.
    const inRow = new Set(r.map(n => n.id));
    const ordered = [...r].sort((a, b) => a.pos.x - b.pos.x);
    for (const a of ordered) {
      for (const fp of a.pins.filter(p => p.category === 'exec' && p.direction === 'Output')) {
        for (const l of fp.linkedTo || []) {
          if (!inRow.has(l.nodeName)) continue;
          const b = ordered.find(n => n.id === l.nodeName);
          const tp = b?.pins.find(p => p.id === l.pinId && p.category === 'exec' && p.direction === 'Input');
          if (!b || !tp) continue;
          const sourceY = pinCenterY(a, fp);
          const targetOffset = pinCenterY({ ...b, pos: { x: b.pos.x, y: 0 } }, tp);
          b.pos.y = sourceY - targetOffset;
        }
      }
    }
    const bottom = Math.max(...r.map(n => n.pos.y + estNodeHeight(n)));
    y = bottom + rowGap;
  }
  return { rows, bottom: y };
}

/** Y центра пина (приближённо): шапка ~34px, строка 22px; knot — центр ~8px. */
export function pinCenterY(n, pin) {
  if ((n.className || '').includes('Knot')) return n.pos.y + 8;
  const vis = n.pins.filter(p => !p.hidden && p.direction === pin.direction && p.name !== 'OutputDelegate'); // делегат — в шапке
  const { sub, compact } = nodeTitleParts(n);
  // CallFunction's Target subtitle affects pin Y even when its synthetic self pin is hidden.
  // Engine copy-back also shows Branch.then below the input exec row; Branch outputs are
  // not vertically equivalent to execute. Keep each output's own row offset.
  const header = compact ? 18 : 34 + (sub ? HEADER_LINE_H : 0);
  let rowOffset = Math.max(0, vis.indexOf(pin)) * PIN_ROW_H;
  if ((n.className || '').includes('IfThenElse') && pin.direction === 'Output') {
    rowOffset = pin.name === 'then' ? 16 : pin.name === 'else' ? 38 : rowOffset;
  }
  return n.pos.y + header + rowOffset + PIN_ROW_H / 2;
}

/** Все координаты на сетку 16 (как «Straighten/Align» в редакторе). */
export function snapToGrid(nodes, { xOnly = false } = {}) { for (const n of nodes) { n.pos.x = snap(n.pos.x); if (!xOnly) n.pos.y = snap(n.pos.y); } return nodes; }

/** Exec-связи с перепадом → knot'ы. Возвращает НОВЫЕ узлы (добавить в вывод).
 *  • назад (вход левее выхода — перенос на ряд ниже/позади): 2 knot'а на «коридоре» между рядами —
 *    первый соосно выходу последней ноды ряда (правый край + KNOT_DX, R30-вердикт), второй над входом
 *    первой ноды следующего ряда (его левый край);
 *  • вперёд с перепадом высоты ≥ minDy: «ступенька» — 2 knot'а на одной X посередине, на высотах пинов.
 *  Прямые связи (одна высота, вперёд) не трогаются. */
export const KNOT_DX = 16;
export function decorateExec(nodes, { minDy = 48, pad = 48, knotDx = KNOT_DX } = {}) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const knots = [];
  const relink = (A, fp, B, tp, pts) => {
    fp.linkedTo = fp.linkedTo.filter(l => l.pinId !== tp.id);
    tp.linkedTo = tp.linkedTo.filter(l => l.pinId !== fp.id);
    let prevN = A, prevP = fp;
    for (const [x, y] of pts) {
      const k = createKnot({ x: snap(x), y: snap(y) }, 'exec');
      const [ki, ko] = k.pins;
      prevP.linkedTo.push({ nodeName: k.id, pinId: ki.id }); ki.linkedTo.push({ nodeName: prevN.id, pinId: prevP.id });
      knots.push(k); prevN = k; prevP = ko;
    }
    prevP.linkedTo.push({ nodeName: B.id, pinId: tp.id }); tp.linkedTo.push({ nodeName: prevN.id, pinId: prevP.id });
  };
  const jobs = [];
  for (const A of nodes) {
    if ((A.className || '').includes('Knot')) continue;
    for (const fp of A.pins.filter(p => p.direction === 'Output' && p.category === 'exec'))
      for (const l of fp.linkedTo) {
        const B = byId.get(l.nodeName);
        if (!B || (B.className || '').includes('Knot')) continue;
        const tp = B.pins.find(p => p.id === l.pinId);
        if (tp) jobs.push([A, fp, B, tp]);
      }
  }
  for (const [A, fp, B, tp] of jobs) {
    const outX = A.pos.x + estNodeWidth(A), inX = B.pos.x;
    const yA = pinCenterY(A, fp) - 8, yB = pinCenterY(B, tp) - 8;
    if (inX < outX + pad) {
      // коридор: между низом верхнего узла и верхом нижнего (если ряд ниже), иначе под обоими
      // низ ВСЕГО ряда A (самый высокий узел ряда), чтобы коридор не резал соседей
      // низ всего, что стоит между рядом A и рядом B (ряд A + его подряд данных), чтобы коридор никого не резал
      const lowA = Math.max(...nodes.filter(n => !(n.className || '').includes('Knot') && n.pos.y >= A.pos.y - 1 && (B.pos.y <= A.pos.y || n.pos.y < B.pos.y))
        .map(n => n.pos.y + estNodeHeight(n)));
      const corridor = B.pos.y > lowA ? (lowA + B.pos.y) / 2 : Math.max(lowA, B.pos.y + estNodeHeight(B)) + 80;
      relink(A, fp, B, tp, [[outX + knotDx, corridor], [inX, corridor]]);
    } else if (Math.abs(yA - yB) >= minDy) {
      const mx = (outX + inX) / 2;
      relink(A, fp, B, tp, [[mx, yA], [mx, yB]]);
    }
  }
  return knots;
}

/** --decorate: раскладка с «подрядами» данных (R27-фидбек: не было горизонтального выравнивания).
 *  Исполняемые ряды как в layoutRows; каждый pure/данные-узел (и событие, отдающее только делегат)
 *  получает «якорь» — первый (левый) исполняемый узел, куда в итоге идёт его выход (через цепочку pure —
 *  глубина+1), и встаёт в подряд ПОД рядом якоря, выходом левее входа якоря; более глубокие — левее.
 *  Неподключённые данные — последним рядом. */
export function layoutDecorated(top, data, { perRow = 0, maxWidth = 0, gap = ROW_GAP, rowGap = 200, subGap = 60, dataGap = 48 } = {}) {
  const { rows } = layoutRows(top, { perRow, maxWidth, gap });
  const all = [...top, ...data];
  const byId = new Map(all.map(n => [n.id, n]));
  const topSet = new Set(top);
  const memo = new Map();
  const rowOf = new Map(); rows.forEach((r, i) => r.forEach(n => rowOf.set(n, i)));
  const anchorOf = (n, seen = new Set()) => {
    if (memo.has(n)) return memo.get(n);
    if (seen.has(n)) return null; seen.add(n);
    let best = null;
    for (const p of n.pins) if (p.direction === 'Output') for (const l of p.linkedTo) {
      const c = byId.get(l.nodeName); if (!c) continue;
      const cand = topSet.has(c) ? { a: c, d: 1 } : (() => { const r = anchorOf(c, seen); return r && { a: r.a, d: r.d + 1 }; })();
      const key = c2 => [rowOf.get(c2.a), c2.a.pos.x];
      if (cand && (!best || key(cand)[0] < key(best)[0] || (key(cand)[0] === key(best)[0] && key(cand)[1] < key(best)[1]) || (cand.a === best.a && cand.d > best.d))) best = cand;
    }
    memo.set(n, best); return best;
  };
  const buckets = rows.map(() => []), loose = [];
  for (const n of data) { const a = anchorOf(n); if (a) buckets[rowOf.get(a.a)].push({ n, ...a }); else loose.push(n); }
  let y = 0;
  rows.forEach((r, i) => {
    // Keep layoutRows' per-node Y offsets (exec-pin alignment) while shifting the
    // whole row below prior data subrows.
    const rowTop = Math.min(...r.map(n => n.pos.y));
    const shift = y - rowTop;
    r.forEach(n => { n.pos.y += shift; });
    let bottom = Math.max(...r.map(n => n.pos.y + estNodeHeight(n)));
    const b = buckets[i].sort((p, q) => p.a.pos.x - q.a.pos.x || q.d - p.d);
    if (b.length) {
      const sy = bottom + subGap; let cursor = -Infinity;
      for (const { n, a, d } of b) {
        const w = estNodeWidth(n);
        // правый край (выход) — левее входа якоря: провод идёт вперёд-вверх, не петлёй; глубже — ещё левее
        const x = Math.max(cursor, a.pos.x - (w + dataGap) * d);
        n.pos.x = x; n.pos.y = sy; cursor = x + w + dataGap;
      }
      bottom = sy + Math.max(...b.map(e => estNodeHeight(e.n)));
    }
    y = bottom + rowGap;
  });
  if (loose.length) layoutRow(loose, 0, y, gap);
  return rows;
}

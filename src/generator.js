// Generator helpers for AI — строит ноды по реестру data/ue-functions.json,
// совместимые с generateUEText() из parser.js и строгим src/validate.js.
import { guid32 } from './parser.js';
import { UE_LIBS, UE_STRUCTS, UE_ENUMS, UE_MACROS, classRef } from './ue-types.js';

let seq = 100;
const nextId = prefix => `${prefix}_${seq++}`;

export function mkPin(name, direction, category, opts = {}) {
  return {
    id: guid32(), name, friendly: opts.friendly || name, direction, category,
    subCategory: opts.sub || '', subCategoryObject: opts.subObj || '', isConst: !!opts.const,
    isRef: !!opts.ref, container: opts.container || 'None', ignored: !!opts.ignored, advanced: !!opts.advanced,
    defaultValue: opts.dv || '', hidden: !!opts.hidden, linkedTo: [],
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
  const n = baseNode('K2Node_CallFunction', short, pos);
  n.funcName = regEntry.func;
  n.title = regEntry.title || regEntry.func;
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
    if (p.cat === 'object' && p.object) o.subObj = classRef(p.object);
    if (p.enum) o.subObj = UE_ENUMS[p.enum] || p.enum;
    if (p.const) o.const = true;
    if (p.ref) o.ref = true;
    if (p.container) o.container = p.container;
    if (p.ignored) o.ignored = true;
    if (p.advanced) o.advanced = true;
    if (p.dv) o.dv = p.dv;
    if (p.hidden) o.hidden = true;
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
    if (p.cat === 'object' && p.object) o.subObj = classRef(p.object);
    if (p.const) o.const = true;
    if (p.ref) o.ref = true;
    if (p.container) o.container = p.container;
    if (p.ignored) o.ignored = true;
    if (p.advanced) o.advanced = true;
    if (p.dv) o.dv = p.dv;
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
  n.pins.push(mkPin('execute', 'Input', 'exec'));
  n.pins.push(mkPin('Selection', 'Input', k.sel, { sub: k.selSub }));
  for (const c of cases) n.pins.push(mkPin(String(c), 'Output', 'exec'));
  n.pins.push(mkPin('Default', 'Output', 'exec'));
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
export function createKnot(pos = { x: 0, y: 0 }) {
  return {
    id: nextId('K2Node_Knot'),
    className: 'BlueprintGraph.K2Node_Knot',
    rawClass: '/Script/BlueprintGraph.K2Node_Knot',
    guid: guid32(), pos, title: 'Reroute',
    pins: [
      mkPin('InputPin', 'Input', 'wildcard', { ignored: true }),
      mkPin('OutputPin', 'Output', 'wildcard'),
    ]
  };
}

export function createComment(text, pos = { x: 0, y: 0 }, w = 400, h = 180) {
  return {
    id: nextId('EdGraphNode_Comment'), className: 'UnrealEd.EdGraphNode_Comment',
    rawClass: '/Script/UnrealEd.EdGraphNode_Comment',
    guid: guid32(), pos, title: 'Comment', commentText: text,
    isComment: true, width: w, height: h, pins: [],
  };
}

export function linkPins(fromNode, fromPinName, toNode, toPinName) {
  const fp = fromNode.pins.find(p => p.name === fromPinName && p.direction === 'Output');
  const tp = toNode.pins.find(p => p.name === toPinName && p.direction === 'Input');
  if (!fp || !tp) throw new Error(`Pin not found: ${fromNode.id}.${fromPinName} -> ${toNode.id}.${toPinName}`);
  fp.linkedTo.push({ nodeName: toNode.id, pinId: tp.id });
  tp.linkedTo.push({ nodeName: fromNode.id, pinId: fp.id });
}

import { formatValue } from './values.js';
// src/modules.js — параметрические конструкторы узлов (не фиксированные примеры).
// Любое имя события, любые параметры, любой класс/делегат/функция реестра.
// Формы узлов — из прогонов движка (см. docs/ENGINE_VERIFIED.md, R21b–R26).
import { mkPin, createCast, createFromEntry } from './generator.js';
import { guid32 } from './parser.js';
import { UE_STRUCTS, UE_ENUMS, classRef, normalizeClassPath } from './ue-types.js';

let seq = 5000;
const nid = p => `${p}_${seq++}`;
function node(short, pos = { x: 0, y: 0 }) {
  return { id: nid(short), className: `BlueprintGraph.${short}`, rawClass: `/Script/BlueprintGraph.${short}`, guid: guid32(), pos, pins: [], title: short };
}

/* ---------------- типы ----------------
 * bool int int64 byte float(=double) single(=C++ float, sub float) string name text
 * vector rotator transform vector2d linearcolor hitresult key timerhandle … (любой ключ UE_STRUCTS, без учёта регистра)
 * object:Класс  class:Класс  enum:EИмя   суффикс [] → массив
 * Класс: Actor | /Script/Module.Class | /Game/Path/BP_X            */
const SCALAR = { bool: ['bool'], int: ['int'], int64: ['int64'], byte: ['byte'], float: ['real', 'double'], single: ['real', 'float'], double: ['real', 'double'], real: ['real', 'double'], string: ['string'], name: ['name'], text: ['text'] };
export function parseType(t) {
  let s = String(t).trim(), container = 'None';
  // R60: set<T>, map<K,V> (V — PinValueType)
  let m = /^set<(.+)>$/i.exec(s);
  if (m) return { ...parseType(m[1]), container: 'Set' };
  m = /^map<(.+)>$/i.exec(s);
  if (m) {
    let depth = 0, cut = -1;
    for (let i = 0; i < m[1].length; i++) { const ch = m[1][i]; if (ch === '<') depth++; else if (ch === '>') depth--; else if (ch === ',' && !depth) { cut = i; break; } }
    if (cut < 0) throw new Error(`тип ${t}: map<Ключ,Значение>`);
    const k = parseType(m[1].slice(0, cut)), v = parseType(m[1].slice(cut + 1));
    return { ...k, container: 'Map', valueType: { cat: v.cat, sub: v.sub, subObj: v.subObj ? (v.subObj.startsWith('"') ? v.subObj : `"${v.subObj}"`) : '' } };
  }
  if (s.endsWith('[]')) { container = 'Array'; s = s.slice(0, -2); }
  const [head, ...rest] = s.split(':'); const arg = rest.join(':');
  const k = head.toLowerCase();
  if (SCALAR[k]) return { cat: SCALAR[k][0], sub: SCALAR[k][1] || '', subObj: '', container };
  // R55: мягкие ссылки TSoftObjectPtr/TSoftClassPtr — категории softobject/softclass, класс в SubCategoryObject
  if (k === 'softobject' || k === 'softclass') {
    if (!arg) throw new Error(`тип ${t}: нужен класс, напр. ${k}:/Script/Engine.World`);
    return { cat: k, sub: '', subObj: classRef(arg), classPath: normalizeClassPath(arg), container };
  }
  if (k === 'object' || k === 'class') {
    if (!arg) throw new Error(`тип ${t}: нужен класс, напр. ${k}:Actor`);
    return { cat: k, sub: '', subObj: classRef(arg), classPath: normalizeClassPath(arg), container };
  }
  if (k === 'enum') {
    if (!UE_ENUMS[arg]) throw new Error(`enum ${arg} не в UE_ENUMS (src/ue-types.js) — нужен референс`);
    return { cat: 'byte', sub: '', subObj: UE_ENUMS[arg], container };
  }
  const sk = Object.keys(UE_STRUCTS).find(x => x.toLowerCase() === k);
  if (sk) return { cat: 'struct', sub: '', subObj: UE_STRUCTS[sk], container };
  throw new Error(`неизвестный тип «${t}». Допустимо: ${Object.keys(SCALAR).join(' ')} ${Object.keys(UE_STRUCTS).map(x => x.toLowerCase()).join(' ')} object:X class:X softobject:X softclass:X enum:X, суффикс []`);
}
/** "Имя:тип" или "Имя:тип=значение" */
export function parseParam(spec) {
  const eq = spec.indexOf('=');
  const body = eq < 0 ? spec : spec.slice(0, eq), dv = eq < 0 ? '' : spec.slice(eq + 1);
  const c = body.indexOf(':');
  if (c < 0) throw new Error(`параметр «${spec}»: формат Имя:тип[=значение]`);
  return { name: body.slice(0, c), type: parseType(body.slice(c + 1)), dv };
}
const pin = (name, dir, ty, extra = {}) => mkPin(name, dir, ty.cat, { sub: ty.sub, subObj: ty.subObj, container: ty.container, ...(ty.valueType ? { valueType: ty.valueType } : {}), ...extra });

/* ---------------- делегаты ----------------
 * Сигнатуры мультикаст-делегатов движка: /Script/Engine.<Sig>__DelegateSignature.
 * Для неизвестного делегата — передать sig и params явно (createDelegateNode/createEventFor). */
export const DELEGATES = {
  'Actor.OnActorBeginOverlap': { sig: 'ActorBeginOverlapSignature', params: ['OverlappedActor:object:Actor', 'OtherActor:object:Actor'] },
  'Actor.OnActorEndOverlap': { sig: 'ActorEndOverlapSignature', params: ['OverlappedActor:object:Actor', 'OtherActor:object:Actor'] },
  'Actor.OnDestroyed': { sig: 'ActorDestroyedSignature', params: ['DestroyedActor:object:Actor'] },
  'Actor.OnActorHit': { sig: 'ActorHitSignature', params: ['SelfActor:object:Actor', 'OtherActor:object:Actor', 'NormalImpulse:vector', 'Hit:hitresult'] },
  'Actor.OnTakeAnyDamage': { sig: 'TakeAnyDamageSignature', params: ['DamagedActor:object:Actor', 'Damage:float', 'DamageType:object:DamageType', 'InstigatedBy:object:Controller', 'DamageCauser:object:Actor'] },
  'PrimitiveComponent.OnComponentBeginOverlap': { sig: 'ComponentBeginOverlapSignature', params: ['OverlappedComponent:object:PrimitiveComponent', 'OtherActor:object:Actor', 'OtherComp:object:PrimitiveComponent', 'OtherBodyIndex:int', 'bFromSweep:bool', 'SweepResult:hitresult'] },
  'PrimitiveComponent.OnComponentEndOverlap': { sig: 'ComponentEndOverlapSignature', params: ['OverlappedComponent:object:PrimitiveComponent', 'OtherActor:object:Actor', 'OtherComp:object:PrimitiveComponent', 'OtherBodyIndex:int'] },
  'PrimitiveComponent.OnComponentHit': { sig: 'ComponentHitSignature', params: ['HitComponent:object:PrimitiveComponent', 'OtherActor:object:Actor', 'OtherComp:object:PrimitiveComponent', 'NormalImpulse:vector', 'Hit:hitresult'] },
};
function resolveDelegate(key, sig, params) {
  const d = DELEGATES[key];
  // BP-диспетчер: /Game/Path/BP_X.OnSomething — сигнатура выводится из владельца, параметры задаются явно.
  if (!d && !sig && key.startsWith('/Game/')) sig = key;
  if (!d && !sig) throw new Error(`делегат ${key} не в DELEGATES — укажи сигнатуру (--sig Имя) и параметры`);
  const sigName = sig || d.sig;
  const sigRef = sigName.includes('.') ? sigName : `/Script/Engine.${sigName}`;
  const dot = sigRef.lastIndexOf('.');
  const pkg = sigRef.slice(0, dot), fn = sigRef.slice(dot + 1);
  const fname = fn.endsWith('__DelegateSignature') ? fn : fn + '__DelegateSignature';
  // нативные делегаты: сигнатура в пакете модуля; BP-диспетчеры (/Game/...): сигнатура — функция BP-класса.
  const parent = pkg.startsWith('/Script/') ? `"/Script/CoreUObject.Package'${pkg}'"` : classRef(pkg);
  return {
    memberRef: `MemberParent=${parent},MemberName="${fname}"`,
    params: (params || (d && d.params) || []).map(p => typeof p === 'string' ? parseParam(p) : p),
  };
}

/* ---------------- узлы ---------------- */

/** Custom Event с любыми параметрами. params: ["Damage:float", "Who:object:Actor", ...] или parseParam-объекты. */
/** RPC-флаги Custom Event (R42 VERIFIED: Details совпали): база 0x0C020000 | FUNC_Net 0x40 [| Reliable 0x80]
 *  | Server 0x200000 | Multicast 0x4000 | Client 0x1000000. opts.rpc: 'server'|'multicast'|'client', opts.reliable. */
export function rpcFunctionFlags(rpc, reliable = false) {
  const k = { server: 0x200000, multicast: 0x4000, client: 0x1000000 }[rpc];
  if (!k) throw new Error(`rpc ${rpc}: server | multicast | client`);
  return (0x0C020000 | 0x40 | (reliable ? 0x80 : 0) | k) >>> 0;
}
export function createCustomEvent(name, params = [], pos, opts = {}) {
  const n = node('K2Node_CustomEvent', pos);
  n.title = `Custom Event ${name}`;
  n.eventName = name;
  n.rawProps = [`CustomFunctionName="${name}"`];
  if (opts.rpc) n.rawProps.push(`FunctionFlags=${rpcFunctionFlags(opts.rpc, opts.reliable)}`);
  n.pins.push(mkPin('OutputDelegate', 'Output', 'delegate', { memberRef: `MemberName="${name}"` }), mkPin('then', 'Output', 'exec'));
  const ps = params.map(p => typeof p === 'string' ? parseParam(p) : p);
  for (const p of ps) n.pins.push(pin(p.name, 'Output', p.type));
  n.tailProps = ps.map(p => {
    const t = p.type;
    const parts = [`PinCategory="${t.cat}"`];
    if (t.sub) parts.push(`PinSubCategory="${t.sub}"`);
    if (t.subObj) parts.push(`PinSubCategoryObject=${t.subObj}`);
    if (t.container !== 'None') parts.push(`ContainerType=${t.container}`);
    return `CustomProperties UserDefinedPin (PinName="${p.name}",PinType=(${parts.join(',')}),DesiredPinDirection=EGPD_Output)`;
  });
  n.params = ps;
  return n;
}

/** Вызов своего Custom Event / BP-функции (bSelfContext). event — узел события (params и GUID берутся из него) или имя. */
export function createCallCustomEvent(event, values = {}, pos) {
  const name = typeof event === 'string' ? event : event.eventName;
  const params = typeof event === 'string' ? [] : event.params;
  const n = node('K2Node_CallFunction', pos);
  n.title = name; n.funcName = name;
  if (typeof event !== 'string') n.memberGuid = event.guid;
  n.pins.push(mkPin('execute', 'Input', 'exec'), mkPin('then', 'Output', 'exec'), mkPin('self', 'Input', 'object', { sub: 'self' }));
  for (const p of params) n.pins.push(pin(p.name, 'Input', p.type, { dv: values[p.name] ?? p.dv ?? '' }));
  return n;
}

/** Диспетчеры BP нельзя создать вставкой текста (подтверждено пользователем 2026-09-30):
 *  ноды, ссылающиеся на диспетчер BP, несут пузырь с тем, что надо создать вручную.
 *  params: [{name, type}] — входы диспетчера (они же выходы у привязанного события). */
export function dispatcherBubble(name, params = []) {
  const tn = (t) => typeof t === 'string' ? t : (t.classPath ? t.classPath.split('.').pop() : t.cat === 'real' ? 'float' : t.sub || (t.subObj ? t.subObj.replace(/['"]/g, '').split('.').pop() : t.cat)) + (t.container === 'Array' ? '[]' : '');
  const sig = params.length ? params.map(p => `${p.name}: ${tn(p.type)}`).join(', ') : 'без параметров';
  return `Создайте в BP диспетчер ${name} (${sig}), иначе нода с ошибкой`;
}

/** Bind / Unbind / Unbind all для мультикаст-делегата класса. key "Класс.Делегат" (Класс: Actor | /Script/Mod.Cls | /Game/BP). */
export function createDelegateNode(kind, key, { sig, params } = {}, pos) {
  const short = { bind: 'K2Node_AddDelegate', unbind: 'K2Node_RemoveDelegate', clear: 'K2Node_ClearDelegate' }[kind];
  if (!short) throw new Error(`kind ${kind}: bind | unbind | clear`);
  const dot = key.lastIndexOf('.');
  const owner = key.slice(0, dot), dname = key.slice(dot + 1);
  const ownerKey = `${normalizeClassPath(owner).split('.').pop()}.${dname}`;
  const d = resolveDelegate(DELEGATES[key] || key.startsWith('/Game/') ? key : ownerKey, sig, params);
  const n = node(short, pos);
  n.title = `${{ bind: 'Bind Event to', unbind: 'Unbind Event from', clear: 'Unbind all Events from' }[kind]} ${dname}`;
  n.rawProps = [`DelegateReference=(MemberParent=${classRef(owner)},MemberName="${dname}")`];
  n.pins.push(mkPin('execute', 'Input', 'exec'), mkPin('then', 'Output', 'exec'), mkPin('self', 'Input', 'object', { subObj: classRef(owner) }));
  if (kind !== 'clear') n.pins.push(mkPin('Delegate', 'Input', 'delegate', { memberRef: d.memberRef }));
  if (owner.startsWith('/Game/')) n.bubble = dispatcherBubble(dname, d.params || []);
  return n;
}

/** Custom Event с сигнатурой делегата (как «Create matching event»). */
export function createEventFor(key, name, opts = {}, pos) {
  const dot = key.lastIndexOf('.');
  const ownerKey = `${normalizeClassPath(key.slice(0, dot)).split('.').pop()}.${key.slice(dot + 1)}`;
  const d = resolveDelegate(DELEGATES[key] || key.startsWith('/Game/') ? key : ownerKey, opts.sig, opts.params);
  return createCustomEvent(name, d.params, pos);
}

/** Create Event (делегат из функции/события по имени). */
export function createCreateEvent(fnName, pos) {
  const n = node('K2Node_CreateDelegate', pos);
  n.title = `Create Event ${fnName}`;
  n.rawProps = [`SelectedFunctionName="${fnName}"`];
  n.pins.push(mkPin('self', 'Input', 'object', { subObj: classRef('/Script/CoreUObject.Object') }), mkPin('OutputDelegate', 'Output', 'delegate'));
  return n;
}

/** Любая запись реестра с переопределением дефолтов пинов: createFn(entry, {Time:'2.0'}). */
export function createFn(entry, values = {}, pos) {
  const e = JSON.parse(JSON.stringify(entry));
  for (const [k, v] of Object.entries(values)) {
    const p = (e.pins || []).find(x => x.name === k && x.dir === 'Input');
    if (!p) throw new Error(`${e.id}: нет входного пина ${k} (есть: ${(e.pins || []).filter(x => x.dir === 'Input').map(x => x.name).join(', ')})`);
    if (p.cat === 'class' && v) p.defObj = normalizeClassPath(v);
    else if (p.cat === 'object' && v) p.defObj = assetPath(v, p.object);
    else { if (p.autoDv === undefined) p.autoDv = p.dv || ''; p.dv = v; }
  }
  return createFromEntry(e, pos);
}

export { createCast };

/** Format Text с аргументами: createFormatText('HP: {Health} / {Max}', { Health: 'double', Max: 'double' }).
 *  Пины аргументов пишутся сразу с типом источника (без типа — wildcard, движок уточнит при подключении).
 *  PinNames(i) — список аргументов K2Node_FormatText. ⚠ аргументы ждут подтверждения вставкой. */
export function createFormatText(format, types = {}, pos) {
  const n = node('K2Node_FormatText', pos);
  n.title = 'Format Text';
  const args = [...new Set([...format.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(m => m[1]))];
  n.rawProps = args.map((a, i) => `PinNames(${i})="${a}"`);
  n.pins.push(mkPin('Format', 'Input', 'text', { dv: format }), mkPin('Result', 'Output', 'text'));
  for (const a of args) n.pins.push(types[a] ? pin(a, 'Input', parseType(types[a])) : mkPin(a, 'Input', 'wildcard'));
  return n;
}

/** Create Widget (UMGEditor.K2Node_CreateWidget). wbp: /Game/UI/WBP_X или null (класс выбрать в движке). */
export function createWidget(wbp, pos) {
  const n = node('K2Node_CreateWidget', pos);
  n.rawClass = '/Script/UMGEditor.K2Node_CreateWidget'; n.className = 'UMGEditor.K2Node_CreateWidget';
  const cp = wbp ? normalizeClassPath(wbp) : '';
  n.title = `Create ${cp ? cp.split('.').pop().replace(/_C$/, '') : 'Widget'}`;
  n.pins.push(mkPin('execute', 'Input', 'exec'), mkPin('then', 'Output', 'exec'),
    mkPin('Class', 'Input', 'class', { subObj: classRef('/Script/UMG.UserWidget'), defObj: cp }),
    mkPin('ReturnValue', 'Output', 'object', { subObj: cp ? classRef(wbp) : classRef('/Script/UMG.UserWidget') }),
    mkPin('OwningPlayer', 'Input', 'object', { subObj: classRef('PlayerController') }));
  return n;
}

/** Get/Set любого BlueprintVisible-свойства класса: createMemberVar('set', 'PlayerController.bShowMouseCursor', 'bool', 'true'). */
export function createMemberVar(kind, key, type, value = '', pos) {
  const dot = key.lastIndexOf('.');
  const owner = key.slice(0, dot), prop = key.slice(dot + 1);
  const ty = parseType(type);
  const short = kind === 'set' ? 'K2Node_VariableSet' : 'K2Node_VariableGet';
  const n = node(short, pos);
  n.title = `${kind === 'set' ? 'Set' : 'Get'} ${prop}`;
  n.rawProps = [`VariableReference=(MemberParent=${classRef(owner)},MemberName="${prop}")`];
  if (kind === 'set') n.pins.push(mkPin('execute', 'Input', 'exec'), mkPin('then', 'Output', 'exec'), pin(prop, 'Input', ty, { dv: value }), pin('Output_Get', 'Output', ty));
  else n.pins.push(pin(prop, 'Output', ty));
  n.pins.push(mkPin('self', 'Input', 'object', { subObj: classRef(owner) }));
  return n;
}

/** P1.10: своя переменная BP (bSelfContext). self-пин = класс ЭТОГО BP ("/Script/Engine.BlueprintGeneratedClass'/Game/X/BP_X.BP_X_C'"):
 *  bp — путь BP (/Game/X/BP_X); без него класс берётся из generateUEText(…, { root }) (--root), иначе пусто (движок достроит).
 *  createSelfVar('get', 'WheelRadius_M', 'float') · createSelfVar('set', 'V_plane', 'vector', '', { bp: '/Game/Vehicle/wheel/BP_WheelActor' }) */
export function createSelfVar(kind, name, type, value = '', { bp = '', guid = '' } = {}, pos) {
  const ty = parseType(type);
  const short = kind === 'set' ? 'K2Node_VariableSet' : 'K2Node_VariableGet';
  const n = node(short, pos);
  n.title = `${kind === 'set' ? 'Set' : 'Get'} ${name}`;
  n.varName = name; if (guid) n.varGuid = guid;
  if (bp) n.ownerClass = classRef(bp);
  if (kind === 'set') n.pins.push(mkPin('execute', 'Input', 'exec'), mkPin('then', 'Output', 'exec'), pin(name, 'Input', ty, { dv: value }), pin('Output_Get', 'Output', ty));
  else n.pins.push(pin(name, 'Output', ty));
  n.pins.push(mkPin('self', 'Input', 'object', { hidden: true }));
  return n;
}

/** R50 copy-back: Set переменной с RepNotify в тексте ТАКОЙ ЖЕ, как обычный Set своей переменной. Подпись «w/ Notify»
 *  движок берёт из флагов самой переменной, а функцию OnRep_<name> создаёт сам. Переменную нельзя вставить текстом,
 *  как и диспетчер, поэтому на ноде висит пузырь с инструкцией. rep: 'notify' | 'replicated'. */
export function createReplicatedVarSet(name, type, value = '', { rep = 'notify', ...o } = {}, pos) {
  const n = createSelfVar('set', name, type, value, o, pos);
  // порядок пинов как в copy-back: exec, exec, значение, self, Output_Get
  const i = n.pins.findIndex(q => q.name === 'self'); const [self] = n.pins.splice(i, 1); n.pins.splice(3, 0, self);
  const zero = { float: '0.0', double: '0.0', int: '0', bool: 'false' }[type];
  if (zero != null) for (const q of n.pins.filter(q => q.name === name || q.name === 'Output_Get')) {
    if (q.name === name && !q.defaultValue) q.defaultValue = zero;
    if (q.name === 'Output_Get') q.defaultValue = zero;
    q.autoFixed = zero;
  }
  n.bubble = rep === 'notify'
    ? `Создайте переменную ${name} (${type}), Replication = RepNotify: движок сам добавит функцию OnRep_${name}`
    : `Создайте переменную ${name} (${type}), Replication = Replicated`;
  return n;
}

/** P1.9: локальная переменная (или параметр) функции: VariableReference=(MemberScope="<Функция>",MemberName,MemberGuid),
 *  без bSelfContext и БЕЗ self-пина (канон BP_WheelActor SlipVel: у локал-гета один пин).
 *  guid — MemberGuid локала из инвентаря (tools/inventory.mjs), если известен; иначе случайный (движок резолвит по имени).
 *  createLocalVarGet('SlipVel', 'V_plane', 'vector') */
export function createLocalVarGet(scope, name, type, { guid = '' } = {}, pos) {
  const n = node('K2Node_VariableGet', pos);
  n.title = `Get ${name}`; n.varName = name; n.varScope = scope; if (guid) n.varGuid = guid;
  n.pins.push(pin(name, 'Output', parseType(type)));
  return n;
}
/** Set локала — форма по аналогии с Get (без self). ⚠ не проверена движком. */
export function createLocalVarSet(scope, name, type, value = '', { guid = '' } = {}, pos) {
  const ty = parseType(type);
  const n = node('K2Node_VariableSet', pos);
  n.title = `Set ${name}`; n.varName = name; n.varScope = scope; if (guid) n.varGuid = guid;
  n.pins.push(mkPin('execute', 'Input', 'exec'), mkPin('then', 'Output', 'exec'), pin(name, 'Input', ty, { dv: value }), pin('Output_Get', 'Output', ty));
  return n;
}

/* ---------------- ассеты (round28) ----------------
 * IA_Jump → /Game/Input/Actions/IA_Jump.IA_Jump (шаблон UE5); IMC_Default → /Game/Input/IMC_Default.IMC_Default;
 * /Game/X/Y → /Game/X/Y.Y; полный путь с точкой — как есть. Для BP-класса (pin class:) — _C. */
export function assetPath(v, cls = '') {
  let s = String(v).trim();
  if (!s.startsWith('/')) {
    const c = String(cls).split('.').pop();
    const dir = c === 'InputAction' || /^IA_/.test(s) ? '/Game/Input/Actions' : c === 'InputMappingContext' || /^IMC_/.test(s) ? '/Game/Input' : '/Game';
    s = `${dir}/${s}`;
  }
  if (!s.split('/').pop().includes('.')) s = `${s}.${s.split('/').pop()}`;
  return s;
}
const IA_TYPES = { bool: 'bool', digital: 'bool', float: 'float', axis1d: 'float', vector2d: 'vector2d', axis2d: 'vector2d', vector: 'vector', axis3d: 'vector' };
function iaType(t = 'bool') {
  const k = IA_TYPES[String(t).toLowerCase()];
  if (!k) throw new Error(`тип значения IA «${t}»: bool|float|vector2d|vector (или digital|axis1d|axis2d|axis3d)`);
  return parseType(k);
}
const iaProp = ia => `InputAction="/Script/EnhancedInput.InputAction'${assetPath(ia, 'InputAction')}'"`;

/** Событие Enhanced Input (K2Node_EnhancedInputAction) для любого IA; type — ValueType ассета (пины движок всё равно перестроит). */
export function createInputActionEvent(ia, type = 'bool', pos) {
  const n = node('K2Node_EnhancedInputAction', pos);
  n.rawClass = '/Script/InputBlueprintNodes.K2Node_EnhancedInputAction'; n.className = 'InputBlueprintNodes.K2Node_EnhancedInputAction';
  n.title = `EnhancedInputAction ${assetPath(ia).split('.').pop()}`;
  // R33 copy-back (IA_Look, 2026-09-30): AdvancedPinDisplay=Hidden; видим только Triggered и ActionValue,
  // Started/Ongoing/Canceled/Completed/ElapsedSeconds/TriggeredSeconds/InputAction — advanced;
  // секунды — real/double; последний выход InputAction (object) с дефолтом = сам ассет.
  n.rawProps = [iaProp(ia), 'AdvancedPinDisplay=Hidden'];
  for (const e of ['Triggered', 'Started', 'Ongoing', 'Canceled', 'Completed'])
    n.pins.push(mkPin(e, 'Output', 'exec', { advanced: e !== 'Triggered' }));
  const path = assetPath(ia, 'InputAction');
  n.pins.push(pin('ActionValue', 'Output', iaType(type)),
    mkPin('ElapsedSeconds', 'Output', 'real', { sub: 'double', advanced: true }),
    mkPin('TriggeredSeconds', 'Output', 'real', { sub: 'double', advanced: true }),
    mkPin('InputAction', 'Output', 'object', { subObj: `"/Script/CoreUObject.Class'/Script/EnhancedInput.InputAction'"`,
      advanced: true, dv: path.split('.').pop(), defObj: path }));
  return n;
}

/** Pure «Get IA_X» (K2Node_GetInputActionValue) для любого IA. */
export function createInputActionValue(ia, type = 'vector2d', pos) {
  const n = node('K2Node_GetInputActionValue', pos);
  n.rawClass = '/Script/InputBlueprintNodes.K2Node_GetInputActionValue'; n.className = 'InputBlueprintNodes.K2Node_GetInputActionValue';
  n.title = `Get ${assetPath(ia).split('.').pop()}`;
  n.rawProps = [iaProp(ia)];
  // R33 copy-back: выход называется ReturnValue (не ActionValue)
  n.pins.push(pin('ReturnValue', 'Output', iaType(type)));
  return n;
}

/* ---------------- добавление компонентов (R35 copy-back, 2026-09-30) ----------------
 * createAddComponentByClass() — K2Node_AddComponentByClass: класс выбирается пином Class (или проводом).
 *   Подтверждён вариант БЕЗ выбранного класса: bManualAttachment и RelativeTransform скрыты, ReturnValue = ActorComponent.
 *   Если класс задан — пишем его дефолтом пина Class и типом ReturnValue, оба пина раскрываем (движок перестроит
 *   при вставке; этот вариант copy-back'ом ещё не сверен).
 * createAddComponent(cls, bp) — K2Node_AddComponent («Add Static Mesh Component» и т.п.): тип зашит в узел
 *   (TemplateType), шаблон компонента живёт в самом BP (TemplateBlueprint + TemplateName «NODE_Add<Класс>-<n>»).
 *   Вне того BP ссылка на шаблон не существует — для переносимых сниппетов предпочтительнее AddComponentByClass. */
export function createAddComponentByClass(cls = '', pos) {
  const n = node('K2Node_AddComponentByClass', pos);
  n.title = 'Add Component by Class';
  const actor = classRef('Actor'), base = classRef('ActorComponent');
  const c = cls ? normalizeClassPath(cls) : '';
  n.pins.push(mkPin('execute', 'Input', 'exec'),
    mkPin('self', 'Input', 'object', { subObj: actor }),
    mkPin('then', 'Output', 'exec'),
    mkPin('Class', 'Input', 'class', { subObj: base, ...(c ? { defObj: c } : {}) }),
    mkPin('ReturnValue', 'Output', 'object', { subObj: c ? classRef(c) : base }),
    mkPin('bManualAttachment', 'Input', 'bool', { hidden: !c, ...(c ? { dv: 'false', auto: 'false' } : {}) }),
    mkPin('RelativeTransform', 'Input', 'struct', { subObj: UE_STRUCTS.Transform, hidden: !c }));
  return n;
}

export function createAddComponent(cls, bp, index = 0, pos) {
  const n = node('K2Node_AddComponent', pos);
  const c = normalizeClassPath(cls), short = c.split('.').pop().replace(/_C$/, '');
  const bpPath = assetPath(bp);
  n.title = `Add ${short}`;
  n.rawProps = [`TemplateBlueprint="${bpPath}"`, `TemplateType=${classRef(c)}`, 'FunctionReference=(MemberName="AddComponent",bSelfContext=True)'];
  n.pins.push(mkPin('execute', 'Input', 'exec'),
    mkPin('then', 'Output', 'exec'),
    mkPin('self', 'Input', 'object', { subObj: classRef('Actor') }),
    mkPin('TemplateName', 'Input', 'name', { dv: `NODE_Add${short}-${index}`, autoFixed: 'None', hidden: true, notConnectable: true, readOnly: true }),
    mkPin('bManualAttachment', 'Input', 'bool', { dv: 'false', auto: 'false' }),
    mkPin('RelativeTransform', 'Input', 'struct', { subObj: UE_STRUCTS.Transform, const: true, ignored: true }),
    mkPin('ComponentTemplateContext', 'Input', 'object', { subObj: classRef('/Script/CoreUObject.Object'), const: true, hidden: true, notConnectable: true }),
    mkPin('bDeferredFinish', 'Input', 'bool', { dv: 'false', auto: 'false', hidden: true, notConnectable: true }),
    mkPin('ReturnValue', 'Output', 'object', { subObj: classRef(c) }));
  return n;
}

/* ---------------- любой вызов функции (round29) ----------------
 * createCall('PrimitiveComponent.SetSimulatePhysics', ['bSimulate:bool=true'])
 * createCall('KismetMathLibrary.Abs', ['A:float', '->', 'ReturnValue:float'], { pure: true, isStatic: true })
 * Член класса → видимый self этого класса; static (библиотека) → скрытый self (Default__) достроит парсер.
 * Пины движок перестроит по самой UFUNCTION — важно верное имя класса и функции. */
export function createCall(key, words = [], { pure = false, isStatic = false } = {}, pos) {
  const dot = key.lastIndexOf('.');
  if (dot < 0) throw new Error(`call ${key}: формат Класс.Функция`);
  const owner = key.slice(0, dot), fn = key.slice(dot + 1);
  const arrow = words.indexOf('->');
  const ins = arrow < 0 ? words : words.slice(0, arrow), outs = arrow < 0 ? [] : words.slice(arrow + 1);
  const short = 'K2Node_CallFunction';
  const n = createFromEntry({ id: fn, title: fn, className: `/Script/BlueprintGraph.${short}`, func: fn, pure, pins: [] }, pos);
  n.memberParent = classRef(owner);
  if (!pure) n.pins.push(mkPin('execute', 'Input', 'exec'), mkPin('then', 'Output', 'exec'));
  if (!isStatic) n.pins.push(mkPin('self', 'Input', 'object', { subObj: classRef(owner) }));
  for (const w of ins) {
    const pr = parseParam(w);
    const o = pr.type.cat === 'class' ? { defObj: pr.dv ? normalizeClassPath(pr.dv) : '' } : pr.type.cat === 'object' ? { defObj: pr.dv ? assetPath(pr.dv, pr.type.classPath) : '' } : { dv: pr.dv };
    if (pr.type.cat === 'struct') o.const = true;
    n.pins.push(pin(pr.name, 'Input', pr.type, o));
  }
  for (const w of outs) { const pr = parseParam(w); n.pins.push(pin(pr.name, 'Output', pr.type)); }
  return n;
}

/** Отложенные async-ноды (K2Node_AsyncAction, UBlueprintAsyncActionBase). Форма — по copy-back R49 (AsyncLoadPrimaryAsset):
 *  ProxyFactoryFunctionName/ProxyFactoryClass/ProxyClass + execute/then + exec-выходы делегатов + их параметры + входы фабрики.
 *  createAsyncAction({ proxy: '/Script/Engine.AsyncActionHandleSaveGame', factory: 'AsyncSaveGameToSlot',
 *    inputs: ['SaveGameObject:object:SaveGame', 'SlotName:string', 'UserIndex:int'], events: ['Completed'], outputs: ['SaveGame:object:SaveGame', 'bSuccess:bool'] }) */
export function createAsyncAction({ proxy, factory, factoryClass = proxy, inputs = [], events = ['Completed'], outputs = [] }, pos) {
  const n = node('K2Node_AsyncAction', pos);
  n.title = factory;
  n.rawProps = [`ProxyFactoryFunctionName="${factory}"`, `ProxyFactoryClass="/Script/CoreUObject.Class'${factoryClass}'"`, `ProxyClass="/Script/CoreUObject.Class'${proxy}'"`];
  n.pins.push(mkPin('execute', 'Input', 'exec'), mkPin('then', 'Output', 'exec'));
  for (const e of events) n.pins.push(mkPin(e, 'Output', 'exec'));
  for (const w of outputs) { const pr = parseParam(w); n.pins.push(pin(pr.name, 'Output', pr.type)); }
  n.pins.push(mkPin('WorldContextObject', 'Input', 'object', { subObj: classRef('/Script/CoreUObject.Object') }));
  for (const w of inputs) { const pr = parseParam(w); n.pins.push(pin(pr.name, 'Input', pr.type, { dv: pr.dv })); }
  return n;
}

/** R60: типизированные Make Array / Make Set / Make Map со значениями.
 *  createMakeContainer('array', 'int', [1,2,3]) · ('set', 'name', ['A','B']) · ('map', ['name','vector'], [['Spawn',[0,0,100]], ...]).
 *  Значения — formatValue (src/values.js): числа, bool, [x,y,z] для Vector/Rotator, [r,g,b,a] LinearColor, {loc,rot,scale} Transform, готовые строки UE. */
export function createMakeContainer(kind, type, values = [], pos) {
  const cls = { array: 'K2Node_MakeArray', set: 'K2Node_MakeSet', map: 'K2Node_MakeMap' }[kind];
  if (!cls) throw new Error(`createMakeContainer: array | set | map`);
  const n = node(cls, pos);
  const N = Math.max(1, values.length);
  n.rawProps = [`NumInputs=${N}`];
  const val = (ty, v) => { const f = formatValue(ty, v); return { ...(f.dv !== undefined ? { dv: f.dv } : {}), ...(f.defObj ? { defObj: f.defObj } : {}) }; };
  if (kind === 'map') {
    const [kt, vt] = type.map(parseType);
    n.title = `Make Map (${type.join(' → ')})`;
    for (let i = 0; i < N; i++) {
      const [k, v] = values[i] ?? [];
      n.pins.push(pin(`Key ${i}`, 'Input', kt, val(kt, k)), pin(`Value ${i}`, 'Input', vt, val(vt, v)));
    }
    n.pins.push(pin('Map', 'Output', { ...kt, container: 'Map', valueType: { cat: vt.cat, sub: vt.sub, subObj: vt.subObj ? (vt.subObj.startsWith('"') ? vt.subObj : `"${vt.subObj}"`) : '' } }));
  } else {
    const t = parseType(type);
    n.title = `Make ${kind === 'array' ? 'Array' : 'Set'} (${type})`;
    for (let i = 0; i < N; i++) {
      // R60 вердикт: значение целого Transform-пина движок теряет (пин «контейнер контейнеров»). Значения держатся только
      // в разбитом виде (Split Struct Pin): родитель скрыт + SubPins, дети Location/Rotation/Scale с ParentPin (copy-back r60-transform-split).
      if (/\.Transform'/.test(t.subObj) && values[i] !== undefined) n.pins.push(...splitTransformPin(`[${i}]`, `[ ${i}]`, values[i]));
      else n.pins.push(pin(`[${i}]`, 'Input', t, val(t, values[i])));
    }
    n.pins.push(pin(kind === 'array' ? 'Array' : 'Set', 'Output', { ...t, container: kind === 'array' ? 'Array' : 'Set' }));
  }
  return n;
}

/** R60: Transform-вход в разбитом виде (Split Struct Pin) — единственный способ сохранить значение. v: {loc,rot,scale}. */
export function splitTransformPin(name, display, v = {}) {
  const T = parseType('transform'), V = parseType('vector'), R = parseType('rotator');
  const { loc = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = v;
  const fr = (proto) => `LOCGEN_FORMAT_NAMED(NSLOCTEXT("KismetSchema", "SplitPinFriendlyNameFormat", "{PinDisplayName} {ProtoPinDisplayName}"), "PinDisplayName", INVTEXT("${display}"), "ProtoPinDisplayName", INVTEXT("${proto}"))`;
  const parent = pin(name, 'Input', T, { dv: formatValue(T, v).dv, hidden: true });
  const kids = [['Location', V, loc, '0, 0, 0'], ['Rotation', R, rot, '0, 0, 0'], ['Scale', V, scale, '1.000000,1.000000,1.000000']].map(([k, ty, val, auto]) => {
    const c = pin(`${name}_${k}`, 'Input', ty, { dv: formatValue(ty, val).dv, autoFixed: auto });
    c.friendlyRaw = fr(k); c.parentPin = parent.id; return c;
  });
  parent.subPins = kids.map(c => c.id);
  return [parent, ...kids];
}

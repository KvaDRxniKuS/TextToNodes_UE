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
 * bool int int64 byte float(=double) string name text
 * vector rotator transform vector2d linearcolor hitresult key timerhandle … (любой ключ UE_STRUCTS, без учёта регистра)
 * object:Класс  class:Класс  enum:EИмя   суффикс [] → массив
 * Класс: Actor | /Script/Module.Class | /Game/Path/BP_X            */
const SCALAR = { bool: ['bool'], int: ['int'], int64: ['int64'], byte: ['byte'], float: ['real', 'double'], double: ['real', 'double'], real: ['real', 'double'], string: ['string'], name: ['name'], text: ['text'] };
export function parseType(t) {
  let s = String(t).trim(), container = 'None';
  if (s.endsWith('[]')) { container = 'Array'; s = s.slice(0, -2); }
  const [head, ...rest] = s.split(':'); const arg = rest.join(':');
  const k = head.toLowerCase();
  if (SCALAR[k]) return { cat: SCALAR[k][0], sub: SCALAR[k][1] || '', subObj: '', container };
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
  throw new Error(`неизвестный тип «${t}». Допустимо: ${Object.keys(SCALAR).join(' ')} ${Object.keys(UE_STRUCTS).map(x => x.toLowerCase()).join(' ')} object:X class:X enum:X, суффикс []`);
}
/** "Имя:тип" или "Имя:тип=значение" */
export function parseParam(spec) {
  const eq = spec.indexOf('=');
  const body = eq < 0 ? spec : spec.slice(0, eq), dv = eq < 0 ? '' : spec.slice(eq + 1);
  const c = body.indexOf(':');
  if (c < 0) throw new Error(`параметр «${spec}»: формат Имя:тип[=значение]`);
  return { name: body.slice(0, c), type: parseType(body.slice(c + 1)), dv };
}
const pin = (name, dir, ty, extra = {}) => mkPin(name, dir, ty.cat, { sub: ty.sub, subObj: ty.subObj, container: ty.container, ...extra });

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
export function createCustomEvent(name, params = [], pos) {
  const n = node('K2Node_CustomEvent', pos);
  n.title = `Custom Event ${name}`;
  n.eventName = name;
  n.rawProps = [`CustomFunctionName="${name}"`];
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
    p.dv = v;
  }
  return createFromEntry(e, pos);
}

export { createCast };

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

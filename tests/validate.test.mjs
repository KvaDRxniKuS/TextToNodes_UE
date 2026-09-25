// tests/validate.test.mjs — негативные фикстуры на все коды E/W + позитив + round-trip + весь реестр.
// Запуск: node tests/validate.test.mjs  (или npm test). Exit 1 при любом провале.
import fs from 'fs';
import { parseToGraphs, generateUEText } from '../src/parser.js';
import { createCallFunction, createOperator, createMacroInstance, createStructNode, createSequence, createSwitch, createBranch, createKnot, createComment, fitComment, linkPins, layoutRow, estNodeWidth, createFromEntry } from '../src/generator.js';
import { validateStrict } from '../src/validate.js';

let pass = 0, fail = 0;
const ok = (cond, tag) => { cond ? pass++ : (fail++, console.log('FAIL:', tag)); };

let seq = 1;
const H = i => i.toString(16).toUpperCase().padStart(32, '0');
function pin(name, o = {}) {
  const id = o.id || H(seq++);
  const dir = o.out ? 'Direction="EGPD_Output",' : '';
  const link = o.link ? `LinkedTo=(${o.link},),` : '';
  return `   CustomProperties Pin (PinId=${id},PinName="${name}",${dir}PinType.PinCategory="${o.cat || 'exec'}",PinType.PinSubCategory="${o.sub || ''}",PinType.PinSubCategoryObject=${o.subObj || 'None'},PinType.PinSubCategoryMemberReference=(),PinType.PinValueType=(),PinType.ContainerType=None,PinType.bIsReference=False,PinType.bIsConst=False,PinType.bIsWeakPointer=False,PinType.bIsUObjectWrapper=False,PinType.bSerializeAsSinglePrecisionFloat=False,${link}bHidden=False,bNotConnectable=False,bDefaultValueIsReadOnly=False,bDefaultValueIsIgnored=False,bAdvancedView=False,bOrphanedPin=False,)`;
}
const VEC = "\"/Script/CoreUObject.ScriptStruct'/Script/CoreUObject.Vector'\"";
const ENUM_TQ = "\"/Script/CoreUObject.Enum'/Script/Engine.ETraceTypeQuery'\"";
function block(cls, name, guid, extras, pins) {
  return `Begin Object Class=${cls} Name="${name}" ExportPath="x"\n${extras.join('\n')}\n   NodePosX=0\n   NodePosY=0\n   NodeGuid=${guid}\n${pins.join('\n')}\nEnd Object`;
}
const FR_SELF = f => `   FunctionReference=(MemberName="${f}",MemberGuid=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,bSelfContext=True)`;
const FR_LIB = (lib, f) => `   FunctionReference=(MemberParent="/Script/CoreUObject.Class'/Script/Engine.${lib}'",MemberName="${f}")`;
const P = '/Script/BlueprintGraph.';
const cases = [];
cases.push(['E01', 'мусор без блоков', false]);
cases.push(['E01', 'Begin Object Class=X Name="Y"', false]);
cases.push(['E03', block(P + 'K2Node_Knot', 'K_1', '', [], [pin('InputPin'), pin('OutputPin', { out: 1 })]).replace(/   NodeGuid=.*\n/, ''), false]);
cases.push(['E04', block(P + 'K2Node_Knot', 'K_1', H(seq++), [], [pin('InputPin').replace(/PinId=[A-F0-9]+,/, ''), pin('OutputPin', { out: 1 })]), false]);
cases.push(['E04', block(P + 'K2Node_Knot', 'K_1', H(seq++), [], [pin('InputPin', { id: 'ABC' }), pin('OutputPin', { out: 1 })]), false]);
{ const d = H(seq++); cases.push(['E05', block(P + 'K2Node_Knot', 'K_1', H(seq++), [], [pin('InputPin', { id: d }), pin('OutputPin', { id: d, out: 1 })]), false]); }
cases.push(['E05', block(P + 'K2Node_Knot', 'K_1', H(seq++), [], []) + '\n' + block(P + 'K2Node_Knot', 'K_1', H(seq++), [], []), false]);
{ const a = H(seq++); cases.push(['E06', block(P + 'K2Node_Knot', 'K_1', H(seq++), [], [pin('InputPin'), pin('OutputPin', { id: a, out: 1, link: 'Nope_9 ' + H(seq++) })]), false]); }
{ const a = H(seq++), b = H(seq++); cases.push(['E07', block(P + 'K2Node_Knot', 'K_1', H(seq++), [], [pin('InputPin'), pin('OutputPin', { id: a, out: 1, link: 'K_2 ' + b })]) + '\n' + block(P + 'K2Node_Knot', 'K_2', H(seq++), [], [pin('InputPin', { id: b }), pin('OutputPin', { out: 1 })]), false]); }
cases.push(['E08', block(P + 'K2Node_Event', 'E_1', H(seq++), [], [pin('then', { out: 1 })]), false]);
cases.push(['E09', block(P + 'K2Node_ForLoop', 'F_1', H(seq++), [], [pin('execute')]), false]);
cases.push(['E10', block(P + 'K2Node_CallFunction', 'C_1', H(seq++), [], [pin('execute')]), false]);
cases.push(['E11', block(P + 'K2Node_MakeStruct', 'M_1', H(seq++), [], [pin('X'), pin('Vector', { out: 1, cat: 'struct', sub: 'Vector', subObj: VEC })]), false]);
cases.push(['E11', block(P + 'K2Node_MakeStruct', 'M_1', H(seq++), [`   StructType=${VEC}`], [pin('X'), pin('ReturnValue', { out: 1, cat: 'struct', sub: 'Vector', subObj: VEC })]), false]);
cases.push(['E12', block(P + 'K2Node_CallFunction', 'D_1', H(seq++), [FR_LIB('KismetSystemLibrary', 'Delay')], [pin('execute'), pin('Completed', { out: 1 }), pin('Duration', { cat: 'real', sub: 'double' })]), false]);
cases.push(['E13', block(P + 'K2Node_PromotableOperator', 'O_1', H(seq++), [], [pin('A'), pin('ReturnValue', { out: 1 })]), false]);
cases.push(['E14', block(P + 'K2Node_CallFunction', 'C_1', H(seq++), [FR_SELF('F')], [pin('A', { cat: 'struct', sub: 'Vector', subObj: 'Bogus' })]), false]);
cases.push(['E14', block(P + 'K2Node_CallFunction', 'C_1', H(seq++), [FR_SELF('F')], [pin('T', { cat: 'byte', subObj: 'Bogus' })]), false]);
cases.push(['E15', block(P + 'K2Node_MacroInstance', 'MI_1', H(seq++), [], [pin('execute')]), false]);
cases.push(['E17', block(P + 'K2Node_Knot', 'K_1', H(seq++), [], [pin('InputPin')]), false]);
cases.push(['E18', block(P + 'K2Node_MacroInstance', 'MI_1', H(seq++), ['   MacroGraphReference=MacroGraphReference=(MacroGraph=X)'], [pin('execute')]), false]);
cases.push(['W01', block(P + 'K2Node_SwitchInteger', 'S_1', H(seq++), [], [pin('execute'), pin('Selection', { cat: 'int' })]), true]);
cases.push(['W02', block(P + 'K2Node_Select', 'S_1', H(seq++), [], [pin('Index', { cat: 'int' }), pin('ReturnValue', { out: 1, cat: 'real', sub: 'double' })]), true]);
cases.push(['W03', block(P + 'K2Node_MakeArray', 'A_1', H(seq++), [], [pin('[0]', { cat: 'int' }), pin('ReturnValue', { out: 1, cat: 'object' })]), true]);
cases.push(['W05', block(P + 'K2Node_CallFunction', 'C_1', H(seq++), [FR_SELF('NopeFunc')], [pin('execute')]), true]);
cases.push(['W06', block(P + 'K2Node_CallFunction', 'C_1', H(seq++), [FR_SELF('VSize')], [pin('A', { cat: 'struct', sub: 'Vector', subObj: VEC }), pin('ReturnValue', { out: 1, cat: 'real', sub: 'double' })]), true]);
cases.push(['W07', block(P + 'K2Node_MacroInstance', 'MI_1', H(seq++), ['   MacroGraphReference=(MacroGraph=/Script/Engine.EdGraph\'"/Engine/EditorBlueprintResources/StandardMacros.StandardMacros:Gate"\',GraphBlueprint=/Script/Engine.Blueprint\'"/Engine/EditorBlueprintResources/StandardMacros.StandardMacros"\')'], [pin('Enter')]), true]);
cases.push(['W08', block(P + 'K2Node_PromotableOperator', 'O_1', H(seq++), ['   OperationName="Greater"', '   bDefaultsToPureFunc=True', FR_LIB('KismetMathLibrary', 'Bogus')], [pin('A', { cat: 'real', sub: 'double' }), pin('ReturnValue', { out: 1, cat: 'bool' })]), true]);
cases.push(['W09', block(P + 'K2Node_CallFunction', 'LT_1', H(seq++), [FR_LIB('KismetSystemLibrary', 'BoxTraceSingle')], [pin('execute'), pin('then', { out: 1 }), pin('WorldContextObject', { cat: 'object' }), pin('Start', { cat: 'struct', sub: 'Vector', subObj: VEC }), pin('End', { cat: 'struct', sub: 'Vector', subObj: VEC }), pin('TraceChannel', { cat: 'byte' }), pin('ReturnValue', { out: 1, cat: 'bool' })]), true]);
cases.push(['W10', block(P + 'K2Node_CallFunction', 'C_1', H(seq++), [FR_SELF('F')], [pin('A', { cat: 'struct', sub: 'Vector' })]), true]);
cases.push(['W10', block(P + 'K2Node_CallFunction', 'C_1', H(seq++), [FR_SELF('F')], [pin('A', { cat: 'struct', sub: 'Vector', subObj: "ScriptStruct'\"/Script/Core.Foo\"'" })]), true]);
cases.push(['W11', block(P + 'K2Node_CallFunction', 'C_1', H(seq++), [FR_SELF('F')], [pin('A', { cat: 'struct', sub: 'Vector', subObj: "/Script/CoreUObject.ScriptStruct'/Script/Core.Vector'" })]), true]);

for (const [code, text, expectValid] of cases) {
  const v = validateStrict(text);
  const hit = v.errors.concat(v.warnings).some(x => x.startsWith(code));
  ok(hit && v.valid === expectValid, `${code} (valid=${v.valid}, errs=${v.errors.length}, warns=${v.warnings.length})`);
}
// известный энам из allowlist: нет ни E14, ни W10
{
  const t = block(P + 'K2Node_CallFunction', 'C_1', H(seq++), [FR_SELF('F')], [pin('T', { cat: 'byte', subObj: ENUM_TQ })]);
  const v = validateStrict(t);
  ok(v.valid && !v.errors.concat(v.warnings).some(x => x.startsWith('E14') || x.startsWith('W10')), 'известный энам без E14/W10');
{
  const t = block(P + 'K2Node_CallFunction', 'C_1', H(seq++), [FR_LIB('KismetSystemLibrary', 'Delay')], [pin('execute'), pin('then', { out: 1 })]);
  const v = validateStrict(t);
  ok(v.valid && !v.errors.concat(v.warnings).some(x => x.startsWith('W11')), 'MemberParent quoted-full без W11');
}
}

const reg = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url), 'utf8'));
const byId = id => reg.find(e => e.id === id);
const seq2 = createSequence(2, { x: 0, y: 0 });
const delay = createCallFunction(byId('Delay'), { x: 240, y: 0 });
const prt = createCallFunction(byId('PrintString'), { x: 480, y: 0 });
const mk = createStructNode(byId('MakeVector'), { x: 480, y: 160 });
const gt = createOperator(byId('Greater_Float'), { x: 240, y: 160 });
const fl = createMacroInstance(byId('ForLoop'), { x: 720, y: 0 });
const sw = createSwitch('int', ['0', '1'], { x: 960, y: 0 });
const br = createBranch({ x: 1200, y: 0 });
const cm = createComment('smoke', { x: -80, y: -80 });
linkPins(seq2, 'then_0', delay, 'execute'); linkPins(delay, 'then', prt, 'execute');
const txt = generateUEText([cm, seq2, delay, prt, mk, gt, fl, sw, br]);
const v0 = validateStrict(txt);
ok(v0.valid && v0.errors.length === 0, 'позитив: 0 ошибок');
ok(txt.includes('"/Script/CoreUObject.ScriptStruct') && !txt.includes('/Script/Core.Vector'), 'пути quoted-full');
ok(!txt.includes('PinFriendlyName='), 'без PinFriendlyName');
ok(txt.includes("ExportPath=\"/Script/BlueprintGraph.K2Node_CallFunction'\"/Game/"), 'ExportPath в формате движка');
ok(txt.includes('MemberParent="/Script/CoreUObject.Class'), 'MemberParent quoted-full');
ok(txt.includes('PinSubCategory="",PinType.PinSubCategoryObject="/Script/CoreUObject.ScriptStruct'), 'struct-пины: SubCategory пусто + каноника');
ok(!txt.includes('/Script/Core.Vector'), 'без путей /Script/Core');
const graphs = parseToGraphs(txt);
const nodes = graphs.EventGraph.nodes;
ok(nodes.length === 9, 'парсинг: 9 нод');
const dly = nodes.find(n => n.funcName === 'Delay');
ok(dly && dly.memberParent && dly.memberParent.includes('KismetSystemLibrary'), 'захват MemberParent');
const fln = nodes.find(n => n.className.includes('MacroInstance'));
ok(fln && fln.macroGraph === 'ForLoop' && fln.macroGuid, 'захват MacroGraph/Guid');
const mkn = nodes.find(n => n.className.includes('MakeStruct'));
ok(mkn && mkn.structType && mkn.structType.includes('/Script/CoreUObject.Vector'), 'захват StructType /Script/Core');
// NSLOCTEXT-friendly парсинг
{
  const sample = 'Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="X" ExportPath="x"\n   NodePosX=0\n   NodePosY=0\n   NodeGuid=' + H(seq++) + '\n' + pin('self', { cat: 'object' }).replace('PinName="self",', 'PinName="self",PinFriendlyName=NSLOCTEXT("K2Node", "Target", "Target"),') + '\nEnd Object';
  const g2 = parseToGraphs(sample);
  ok(g2.EventGraph.nodes[0].pins[0].friendly === 'Target', 'парсинг NSLOCTEXT friendly');
}
nodes.forEach(n => delete n.rawBlock);
const txt2 = generateUEText(nodes);
const v2 = validateStrict(txt2);
ok(v2.valid && v2.errors.length === 0, 'регенерация из парсинга: 0 ошибок');
const ltN = createCallFunction(byId('LineTraceSingle'));
const ltTxt = generateUEText([ltN]);
ok(ltTxt.includes("PinName=\"WorldContextObject\",PinType.PinCategory=\"object\",PinType.PinSubCategory=\"\",PinType.PinSubCategoryObject=\"/Script/CoreUObject.Class'/Script/CoreUObject.Object'\""), 'WCO каноническая форма (Class+пусто+const)');
ok(ltTxt.split('bIsConst=True').length - 1 === 4, 'четыре bIsConst=True (WCO+Start+End+ActorsToIgnore)');
ok(ltTxt.includes('PinName="Start",PinType.PinCategory="struct",PinType.PinSubCategory=""'), 'Start: struct с пустым SubCategory');
ok(ltTxt.includes('PinName="ActorsToIgnore"') && ltTxt.includes('ContainerType=Array,PinType.bIsReference=True'), 'ActorsToIgnore: Array+ref');
ok(ltTxt.includes('PinSubCategoryObject="/Script/CoreUObject.Enum\'/Script/Engine.EDrawDebugTrace\'"'), 'DrawDebugType: энам EDrawDebugTrace');
ok(ltTxt.includes('PinName="TraceChannel"') && ltTxt.includes('DefaultValue="TraceTypeQuery1"'), 'TraceChannel: энам + default');
ok(ltTxt.includes('PinName="DrawTime",PinType.PinCategory="real",PinType.PinSubCategory="float"'), 'DrawTime: real/float');
ok(ltTxt.split('bAdvancedView=True').length - 1 === 3, 'три bAdvancedView=True (TraceColor/TraceHitColor/DrawTime)');
const fel = createMacroInstance(byId('ForEachLoop'));
const felTxt = generateUEText([fel]);
ok(felTxt.includes('GraphGuid=99DBFD5540A796041F72A5A9DA655026') && felTxt.includes('PinName="Exec"'), 'ForEachLoop: guid + пин Exec');
ok(felTxt.includes('PinName="Array",PinType.PinCategory="wildcard"') && felTxt.includes('ContainerType=Array'), 'ForEachLoop: Array wildcard+Array');
const kn = createKnot();
const knTxt = generateUEText([kn]);
ok(knTxt.includes('PinName="InputPin",PinType.PinCategory="wildcard"') && knTxt.includes('bDefaultValueIsIgnored=True'), 'Knot: wildcard + ignored');
ok(byId('Reroute').pins[0].cat === 'wildcard' && byId('Reroute').pins[0].ignored === true, 'Reroute: wildcard+ignored');
ok(byId('ForLoop').pins.some(p => p.name === 'FirstIndex'), 'ForLoop: FirstIndex без пробела');
ok(byId('PrintString').pins.some(p => p.name === 'Duration' && p.sub === 'float'), 'PrintString: Duration real/float');
ok(byId('Delay').pins.some(p => p.name === 'Duration' && p.sub === 'float' && p.dv === '0.2'), 'Delay: Duration real/float default 0.2 (L1/L2)');
ok(txt.includes('DefaultValue="0.2"'), 'Delay: дефолт 0.2 в тексте');
{
  const bv = byId('BreakVector').pins.find(p => p.name === 'Vector');
  ok(bv.ref === true && bv.const === true, 'BreakVector: вход ref+const (L2)');
}
{
  const LAT = "\"/Script/CoreUObject.ScriptStruct'/Script/Engine.LatentActionInfo'\"";
  const t = block(P + 'K2Node_CallFunction', 'C_1', H(seq++), [FR_SELF('F')], [pin('LatentInfo', { cat: 'struct', subObj: LAT })]);
  const v = validateStrict(t);
  ok(v.valid && !v.errors.concat(v.warnings).some(x => x.startsWith('E14') || x.startsWith('W10')), 'LatentActionInfo в пуле структур');
}
{
  const fc = fitComment('t', [seq2, delay]);
  ok(fc.width === 700 && fc.pos.x === -60 && fc.pos.y === -110, 'fitComment: бокс по правым краям (700/-60/-110, Delay=340)');
}

let regErr = 0, regWarn = 0;
const regThrow = [];
for (const e of reg) {
  if (e.id === 'Enhanced_GetActionValue') continue; // EnhancedInput-only, нет в FULL-словаре
  try {
    const short = e.className.split('.').pop();
    let n = null;
    if (short === 'K2Node_CallFunction' || short === 'K2Node_CallArrayFunction') n = createCallFunction(e);
    else if (short === 'K2Node_PromotableOperator') n = createOperator(e);
    else if (short === 'K2Node_MacroInstance') n = createMacroInstance(e);
    else if (short === 'K2Node_MakeStruct' || short === 'K2Node_BreakStruct') n = createStructNode(e);
    else continue;
    const v = validateStrict(generateUEText([n]));
    regWarn += v.warnings.length;
    if (!v.valid) { regErr++; console.log('REG-ERR', e.id, v.errors); }
  } catch (err) { regThrow.push(e.id + ': ' + err.message); }
}
ok(regErr === 0 && regThrow.length === 0, `реестр: 0 ошибок генерации (warnings=${regWarn})`);
regThrow.forEach(t => console.log('THROW:', t));

// K1 copy-back: реальный текст движка UE 5.8 (comment + LineTraceSingle 16 пинов)
{
  const k1 = fs.readFileSync(new URL('./fixtures/k1-copyback.txt', import.meta.url), 'utf8');
  const v = validateStrict(k1);
  ok(v.valid && v.errors.length === 0, 'K1 copy-back: strict 0 ошибок (предупреждений: ' + v.warnings.length + ')');
  const gk = parseToGraphs(k1);
  ok(gk.EventGraph.nodes.length === 2, 'K1 copy-back: 2 ноды');
  const fn = gk.EventGraph.nodes.find(n => n.funcName === 'LineTraceSingle');
  ok(fn && fn.pins.length === 16, 'K1 copy-back: 16 пинов (движок добавил self)');
  ok(fn && fn.pins.some(p => p.name === 'ActorsToIgnore' && p.container === 'Array' && p.isRef && p.ignored), 'K1 copy-back: ActorsToIgnore Array+ref+ignored');
  ok(fn && fn.pins.filter(p => p.advanced).length === 3, 'K1 copy-back: 3 advanced-пина');
  ok(fn && fn.pins.find(p => p.name === 'self').friendly === 'Target', 'K1 copy-back: self friendly=Target (NSLOCTEXT)');
  gk.EventGraph.nodes.forEach(n => delete n.rawBlock);
  const rt = generateUEText(gk.EventGraph.nodes);
  const vr = validateStrict(rt);
  ok(vr.valid && vr.errors.length === 0, 'K1 copy-back: регенерация 0 ошибок');
}

// Q6: настоящий «Break Hit Result» = pure GameplayStatics.BreakHitResult (copy-back BP_WheelActor, UE 5.8)
{
  const bp = byId('BreakHitResult_pure');
  ok(bp && bp.pure === true && bp.lib === 'GameplayStatics' && bp.func === 'BreakHitResult', 'BreakHitResult_pure: pure GameplayStatics-вызов');
  ok(bp.pins.length === 19 && !bp.pins.some(p => p.cat === 'exec'), 'BreakHitResult_pure: 19 пинов, без exec');
  ok(bp.pins.filter(p => p.dir === 'Output').length === 18, 'BreakHitResult_pure: 18 выходов');
  ok(bp.pins.filter(p => p.advanced).length === 16, 'BreakHitResult_pure: 16 advanced');
  const hit = bp.pins[0];
  ok(hit.name === 'Hit' && hit.ref && hit.const && hit.ignored, 'BreakHitResult_pure: Hit ref+const+ignored');
  ok(bp.pins.some(p => p.name === 'PhysMat' && p.object === '/Script/PhysicsCore.PhysicalMaterial'), 'BreakHitResult_pure: PhysMat из PhysicsCore');
  ok(byId('BreakHitResult').verified === true, 'BreakHitResult struct: verified (выходов нет — движок не строит)');
  const bn = createCallFunction(bp, { x: 0, y: 0 });
  const bt = generateUEText([bn]);
  ok(bt.indexOf('bDefaultsToPureFunc=True') !== -1 && bt.indexOf('bDefaultsToPureFunc=True') < bt.indexOf('FunctionReference='), 'pure: bDefaultsToPureFunc перед FunctionReference');
  const bv = validateStrict(bt);
  ok(bv.valid && bv.errors.length === 0 && bv.warnings.length === 0, 'pure: сгенерированный текст STRICT-OK без варнингов');
  const fx = fs.readFileSync(new URL('./fixtures/breakhitresult-copyback.txt', import.meta.url), 'utf8');
  const fv = validateStrict(fx);
  ok(fv.errors.length === 2 && fv.errors.every(e => e.startsWith('E06')), 'Q6 фикстура: только 2xE06 (фрагмент, _111 вне выборки)');
  const gf = parseToGraphs(fx);
  const pfn = gf.EventGraph.nodes.find(n => n.funcName === 'BreakHitResult');
  ok(pfn && pfn.pure === true && pfn.pins.length === 20, 'Q6 фикстура: pure-нода, 20 пинов с self');
  ok(pfn && pfn.pins.filter(p => p.advanced).length === 16, 'Q6 фикстура: 16 advanced');
  ok(pfn && pfn.pins.filter(p => p.category === 'name').every(p => p.defaultValue === 'None'), 'Q6 фикстура: name-пины с дефолтом None');
  gf.EventGraph.nodes.forEach(n => delete n.rawBlock);
  const frt = generateUEText(gf.EventGraph.nodes);
  const fvr = validateStrict(frt);
  ok(fvr.errors.length === 2 && frt.includes('bDefaultsToPureFunc=True'), 'Q6 фикстура: регенерация сохраняет E06 + pure-флаг');
}

// M1 copy-back: round-trip pure BreakHitResult (трейд 15→16, pure 19→20, провод жив)
{
  const m1 = fs.readFileSync(new URL('./fixtures/m1-copyback.txt', import.meta.url), 'utf8');
  const v = validateStrict(m1);
  ok(v.valid && v.errors.length === 0 && v.warnings.length === 0, 'M1 copy-back: strict 0 ошибок, 0 варнингов');
  const gm = parseToGraphs(m1);
  ok(gm.EventGraph.nodes.length === 3, 'M1 copy-back: 3 ноды');
  const tr = gm.EventGraph.nodes.find(n => n.funcName === 'LineTraceSingle');
  const pu = gm.EventGraph.nodes.find(n => n.funcName === 'BreakHitResult');
  ok(tr && tr.pins.length === 16, 'M1 copy-back: трейд 15->16 (self добавлен)');
  ok(pu && pu.pure === true && pu.pins.length === 20, 'M1 copy-back: pure 19->20 (self добавлен)');
  ok(tr && tr.pins.findIndex(p => p.name === 'self') === 2, 'M1 copy-back: self трейда третий (после execute/then)');
  ok(pu && pu.pins.findIndex(p => p.name === 'self') === 0, 'M1 copy-back: self pure-ноды первый');
  ok(tr.pins.find(p => p.name === 'OutHit').linkedTo.some(l => l.nodeName === 'K2Node_CallFunction_101') &&
     pu.pins.find(p => p.name === 'Hit').linkedTo.some(l => l.nodeName === 'K2Node_CallFunction_100'), 'M1 copy-back: провод OutHit<->Hit жив в обе стороны');
  const cm = gm.EventGraph.nodes.find(n => n.isComment);
  ok(cm && cm.width === 700 && cm.height === 698, 'M1 copy-back: размер коммента 700x698 пережил round-trip');
}

// Q2: CapsuleTraceMulti — форма OutHits (struct HitResult Array, без ref/const) + резолв ForEachLoop
{
  const cm2 = byId('CapsuleTraceMulti');
  ok(cm2 && cm2.verified === true && cm2.func === 'CapsuleTraceMulti', 'CapsuleTraceMulti: verified');
  ok(cm2.pins.length === 17, 'CapsuleTraceMulti: 17 пинов (без self)');
  const oh = cm2.pins.find(p => p.name === 'OutHits');
  ok(oh && oh.cat === 'struct' && oh.sub === 'HitResult' && oh.container === 'Array' && !oh.ref && !oh.const, 'CapsuleTraceMulti: OutHits struct+Array без ref/const');
  const nm = cm2.pins.map(p => p.name);
  ok(nm.indexOf('Radius') === nm.indexOf('End') + 1 && nm.indexOf('HalfHeight') === nm.indexOf('End') + 2 && nm.indexOf('TraceChannel') === nm.indexOf('End') + 3, 'CapsuleTraceMulti: Radius/HalfHeight после End');
  ok(cm2.pins.find(p => p.name === 'Radius').sub === 'float' && cm2.pins.find(p => p.name === 'HalfHeight').dv === '0.0', 'CapsuleTraceMulti: Radius/HalfHeight float+0.0');
  const ct = generateUEText([createCallFunction(cm2, { x: 0, y: 0 })]);
  const cv = validateStrict(ct);
  ok(cv.valid && cv.errors.length === 0 && cv.warnings.length === 0, 'CapsuleTraceMulti: генерация STRICT-OK без варнингов');
  ok(['SphereTraceMulti', 'BoxTraceMulti'].every(id => { const e = byId(id); return e && e.verified === true && !e.note; }), 'Multi-аналогии: Sphere/Box подтверждены (O1)');
  const fx = fs.readFileSync(new URL('./fixtures/capsuletracemulti-copyback.txt', import.meta.url), 'utf8');
  const fv = validateStrict(fx);
  ok(fv.valid && fv.errors.length === 0 && fv.warnings.length === 0, 'Q2 фикстура: strict 0 ошибок, 0 варнингов');
  const gq = parseToGraphs(fx);
  ok(gq.EventGraph.nodes.length === 3, 'Q2 фикстура: 3 ноды');
  const qtr = gq.EventGraph.nodes.find(n => n.funcName === 'CapsuleTraceMulti');
  const qfe = gq.EventGraph.nodes.find(n => n.macroGraph === 'ForEachLoop');
  ok(qtr && qtr.pins.length === 18, 'Q2 фикстура: трейд 17->18 (self добавлен)');
  const qar = qfe.pins.find(p => p.name === 'Array');
  const qel = qfe.pins.find(p => p.name === 'Array Element');
  ok(qar.category === 'struct' && qar.container === 'Array' && qel.category === 'struct' && (qel.container === 'None' || !qel.container), 'Q2 фикстура: ForEachLoop резолвнул wildcard в HitResult');
  ok(qfe.macroGuid === '99DBFD5540A796041F72A5A9DA655026', 'Q2 фикстура: GraphGuid ForEachLoop');
  ok(qtr.pins.find(p => p.name === 'then').linkedTo.some(l => l.nodeName === 'K2Node_MacroInstance_5') &&
     qtr.pins.find(p => p.name === 'OutHits').linkedTo.some(l => l.nodeName === 'K2Node_MacroInstance_5') &&
     qel.linkedTo.some(l => l.nodeName === 'K2Node_CallFunction_112'), 'Q2 фикстура: 3 провода на месте');
}

// Раскладка: linkPins выравнивает строки пинов (N1+)
{
  const la = createCallFunction(byId('CapsuleTraceMulti'), { x: 0, y: 0 });
  const lf = createMacroInstance(byId('ForEachLoop'), { x: 320, y: 0 });
  const lb = createCallFunction(byId('BreakHitResult_pure'), { x: 640, y: 0 });
  linkPins(la, 'then', lf, 'Exec');
  ok(lf.pos.y === 0, 'align: exec-линки не двигают (цепочки в ряд)');
  linkPins(la, 'OutHits', lf, 'Array');
  ok(lf.pos.y === 198, 'align: OutHits->Array выравнивает data-провод (last wins, WCO скрыт)');
  linkPins(lf, 'Array Element', lb, 'Hit');
  ok(lb.pos.y === 264, 'align: каскад Element(3)->Hit(0)');
  const lc = createCallFunction(byId('Delay'), { x: 0, y: 100 });
  const ld = createCallFunction(byId('Delay'), { x: 320, y: 100 });
  linkPins(lc, 'then', ld, 'execute', { align: false });
  ok(ld.pos.y === 100, 'align: opts {align:false} не двигает');
}

// N1 copy-back: 42/42 PinId, резолв wildcard-макро при вставке, 3 провода
{
  const n1 = fs.readFileSync(new URL('./fixtures/n1-copyback.txt', import.meta.url), 'utf8');
  const v = validateStrict(n1);
  ok(v.valid && v.errors.length === 0 && v.warnings.length === 0, 'N1 copy-back: strict 0 ошибок, 0 варнингов');
  ok(!n1.includes('PinToolTip'), 'N1 copy-back: свежая вставка без тултипов (движок кеширует их позже)');
  const gn = parseToGraphs(n1);
  ok(gn.EventGraph.nodes.length === 4, 'N1 copy-back: 4 ноды');
  const ntr = gn.EventGraph.nodes.find(n => n.funcName === 'CapsuleTraceMulti');
  const nfe = gn.EventGraph.nodes.find(n => n.macroGraph === 'ForEachLoop');
  const npu = gn.EventGraph.nodes.find(n => n.funcName === 'BreakHitResult');
  ok(ntr && ntr.pins.length === 18, 'N1 copy-back: трейд 17->18 (self добавлен)');
  ok(npu && npu.pins.length === 20, 'N1 copy-back: pure 19->20 (self добавлен)');
  const nar = nfe.pins.find(p => p.name === 'Array');
  const nel = nfe.pins.find(p => p.name === 'Array Element');
  ok(nar.category === 'struct' && nel.category === 'struct', 'N1 copy-back: движок резолвнул wildcard-макро при вставке с проводами');
  ok(ntr.pins.find(p => p.name === 'then').linkedTo.some(l => l.nodeName === 'K2Node_MacroInstance_101') &&
     ntr.pins.find(p => p.name === 'OutHits').linkedTo.some(l => l.nodeName === 'K2Node_MacroInstance_101') &&
     nel.linkedTo.some(l => l.nodeName === 'K2Node_CallFunction_102'), 'N1 copy-back: 3 провода живы');
  const ncm = gn.EventGraph.nodes.find(n => n.isComment);
  ok(ncm && ncm.width === 1020 && ncm.height === 698, 'N1 copy-back: коммент 1020x698 цел');
}

// Q2-done: LineTraceMulti (аналогия сошлась 1:1) + LineTraceSingleByProfile
{
  const ltm = byId('LineTraceMulti');
  ok(ltm && ltm.verified === true && !ltm.note, 'LineTraceMulti: verified, note снят');
  ok(ltm.pins.map(p => p.name).join(',') === 'execute,then,WorldContextObject,Start,End,TraceChannel,bTraceComplex,ActorsToIgnore,DrawDebugType,OutHits,bIgnoreSelf,TraceColor,TraceHitColor,DrawTime,ReturnValue', 'LineTraceMulti: порядок пинов как у движка');
  const lbp = byId('LineTraceSingleByProfile');
  ok(lbp && lbp.verified === true && lbp.func === 'LineTraceSingleByProfile' && lbp.pins.length === 15, 'LineTraceSingleByProfile: verified, 15 пинов');
  const pn = lbp.pins.find(p => p.name === 'ProfileName');
  ok(pn && pn.cat === 'name' && pn.dv === 'None' && lbp.pins.indexOf(pn) === ltm.pins.findIndex(p => p.name === 'TraceChannel'), 'ByProfile: ProfileName вместо TraceChannel на той же позиции');
  ok(!lbp.pins.some(p => p.name === 'TraceChannel'), 'ByProfile: TraceChannel нет');
  const bt2 = generateUEText([createCallFunction(lbp, { x: 0, y: 0 })]);
  const bv2 = validateStrict(bt2);
  ok(bv2.valid && bv2.errors.length === 0 && bv2.warnings.length === 0, 'ByProfile: генерация STRICT-OK без варнингов');
  const fx = fs.readFileSync(new URL('./fixtures/linetracemulti-byprofile-copyback.txt', import.meta.url), 'utf8');
  const fv = validateStrict(fx);
  ok(fv.valid && fv.errors.length === 0 && fv.warnings.length === 0, 'Q2-done фикстура: strict 0/0');
  ok(!fx.includes('LinkedTo'), 'Q2-done фикстура: ноды без связей');
  const gd = parseToGraphs(fx);
  const qm = gd.EventGraph.nodes.find(n => n.funcName === 'LineTraceMulti');
  const qb = gd.EventGraph.nodes.find(n => n.funcName === 'LineTraceSingleByProfile');
  ok(qm && qm.pins.length === 16 && qb && qb.pins.length === 16, 'Q2-done фикстура: 16+16 пинов');
  const qoh = qm.pins.find(p => p.name === 'OutHits');
  const qsh = qb.pins.find(p => p.name === 'OutHit');
  ok(qoh.container === 'Array' && !qoh.isRef && (qsh.container === 'None' || !qsh.container), 'Q2-done фикстура: OutHits массив, OutHit одиночный');
}

// O1/O2: Sphere/Box Multi + Sphere/Capsule Single + Line ForObjects (все 1:1 с движком)
{
  const sm = byId('SphereTraceMulti');
  ok(sm && sm.verified === true && !sm.note && sm.pins.length === 16, 'SphereTraceMulti: verified, 16 пинов (аналогия 1:1)');
  const bx = byId('BoxTraceMulti');
  const bn = bx.pins.map(p => p.name);
  const ori = bx.pins.find(p => p.name === 'Orientation');
  ok(bx.verified === true && !bx.note && bx.pins.length === 17, 'BoxTraceMulti: verified, 17 пинов');
  ok(ori && ori.cat === 'struct' && ori.sub === 'Rotator' && ori.const === true && ori.dv === '0, 0, 0' && bn.indexOf('Orientation') === bn.indexOf('HalfSize') + 1, 'BoxTraceMulti: Orientation Rotator+const после HalfSize');
  ok(bx.pins.find(p => p.name === 'HalfSize').dv === '0, 0, 0', 'BoxTraceMulti: HalfSize с дефолтом');
  const ss = byId('SphereTraceSingle');
  const sn = ss.pins.map(p => p.name);
  ok(ss && ss.verified === true && !ss.note && ss.pins.length === 16 && sn.indexOf('Radius') === sn.indexOf('End') + 1, 'SphereTraceSingle: verified, 16 пинов, Radius после End');
  const cs = byId('CapsuleTraceSingle');
  const cn = cs.pins.map(p => p.name);
  ok(cs && cs.verified === true && !cs.note && cs.pins.length === 17 && cn.indexOf('Radius') === cn.indexOf('End') + 1 && cn.indexOf('HalfHeight') === cn.indexOf('End') + 2, 'CapsuleTraceSingle: verified, 17 пинов, Radius/HalfHeight после End');
  const fo = byId('LineTraceSingleForObjects');
  const ot = fo.pins.find(p => p.name === 'ObjectTypes');
  ok(fo && fo.verified === true && !fo.note && fo.pins.length === 15 && !fo.pins.some(p => p.name === 'TraceChannel'), 'LineTraceSingleForObjects: verified, 15 пинов, без TraceChannel');
  ok(ot && ot.cat === 'byte' && ot.enum === 'EObjectTypeQuery' && ot.container === 'Array' && ot.ref === true && ot.const === true && ot.ignored === true && ot.dv === 'ObjectTypeQuery1', 'ForObjects: ObjectTypes byte-массив ref+const+ignored с дефолтом');
  ok(['SphereTraceByChannel', 'CapsuleTraceByChannel', 'LineTraceByObject'].every(id => !byId(id)), 'O: старые sketch-id удалены');
  const foTxt = generateUEText([createCallFunction(fo, { x: 0, y: 0 })]);
  const foV = validateStrict(foTxt);
  ok(foV.valid && foV.errors.length === 0 && foV.warnings.length === 0, 'ForObjects: генерация STRICT-OK без варнингов');
  ok(foTxt.includes(`/Script/Engine.EObjectTypeQuery'`), 'ForObjects: путь энама EObjectTypeQuery в тексте');
  const o1 = fs.readFileSync(new URL('./fixtures/sphereboxtracemulti-copyback.txt', import.meta.url), 'utf8');
  const o1v = validateStrict(o1);
  ok(o1v.valid && o1v.errors.length === 0 && o1v.warnings.length === 0, 'O1 фикстура: strict 0/0');
  ok(!o1.includes('LinkedTo') && !o1.includes('PinToolTip'), 'O1 фикстура: без связей и тултипов (свежая вставка)');
  const go1 = parseToGraphs(o1);
  ok(go1.EventGraph.nodes.length === 3, 'O1 фикстура: 3 ноды');
  const o1s = go1.EventGraph.nodes.find(n => n.funcName === 'SphereTraceMulti');
  const o1b = go1.EventGraph.nodes.find(n => n.funcName === 'BoxTraceMulti');
  ok(o1s && o1s.pins.length === 17 && o1b && o1b.pins.length === 18, 'O1 фикстура: 17+18 пинов с self');
  ok(o1s.pins.findIndex(p => p.name === 'self') === 2 && o1s.pins.filter(p => p.advanced).length === 3, 'O1 фикстура: self третий, 3 advanced');
  const o1c = go1.EventGraph.nodes.find(n => n.isComment);
  ok(o1c && o1c.width === 960 && o1c.height === 640, 'O1 фикстура: коммент 960x640');
  const o2 = fs.readFileSync(new URL('./fixtures/tracesingle-forobjects-copyback.txt', import.meta.url), 'utf8');
  const o2v = validateStrict(o2);
  ok(o2v.valid && o2v.errors.length === 0 && o2v.warnings.length === 0, 'O2 фикстура: strict 0/0');
  const go2 = parseToGraphs(o2);
  ok(go2.EventGraph.nodes.length === 4, 'O2 фикстура: 4 ноды');
  const o2s = go2.EventGraph.nodes.find(n => n.funcName === 'SphereTraceSingle');
  const o2c = go2.EventGraph.nodes.find(n => n.funcName === 'CapsuleTraceSingle');
  const o2f = go2.EventGraph.nodes.find(n => n.funcName === 'LineTraceSingleForObjects');
  ok(o2s && o2s.pins.length === 17 && o2c && o2c.pins.length === 18 && o2f && o2f.pins.length === 16, 'O2 фикстура: 17+18+16 пинов с self');
  const o2ot = o2f.pins.find(p => p.name === 'ObjectTypes');
  ok(o2ot && o2ot.category === 'byte' && o2ot.container === 'Array' && o2ot.isRef && o2ot.isConst && o2ot.ignored && o2ot.defaultValue === 'ObjectTypeQuery1', 'O2 фикстура: ObjectTypes из движка как в реестре');
  ok(o2.split('PinToolTip').length - 1 === 17, 'O2 фикстура: тултипы только у SphereSingle (17 — движок закешировал позже)');
  ok(o2s.pins.find(p => p.name === 'OutHit').container !== 'Array' && o2c.pins.find(p => p.name === 'OutHit').container !== 'Array', 'O2 фикстура: OutHit одиночный у обоих Single');
}

// Раскладка: layoutRow без наложений (O-фидбек: Δ320 перекрывал трейды)
{
  const a = createCallFunction(byId('SphereTraceMulti'));
  const b = createCallFunction(byId('BoxTraceMulti'));
  ok(estNodeWidth(a) === 400 && estNodeWidth(b) === 400, 'estNodeWidth: трейды по 400px');
  layoutRow([a, b]);
  ok(a.pos.x === 0 && b.pos.x === 520, 'layoutRow: Box встал за правым краем Sphere + зазор (520)');
  const fc = fitComment('t', [a, b]);
  ok(fc.width === 1040 && fc.pos.x === -60, 'fitComment: накрывает ряд по правым краям (1040/-60)');
  const s1 = createCallFunction(byId('SphereTraceSingle'));
  const c1 = createCallFunction(byId('CapsuleTraceSingle'));
  const fo = createCallFunction(byId('LineTraceSingleForObjects'));
  layoutRow([s1, c1, fo]);
  ok([s1, c1, fo].every((n, i, arr) => i === 0 || n.pos.x - arr[i - 1].pos.x >= estNodeWidth(arr[i - 1])), 'layoutRow: инвариант без наложений на тройке O2');
}
// Round 1 (copy-back 01): NotEqual-автопин свитчей, GraphGuid макросов, безымянный пин FlipFlop
{
  const swT = generateUEText([createFromEntry(byId('SwitchInt'))]);
  ok(swT.includes('PinName="NotEqual_IntInt"') && swT.includes('Default__KismetMathLibrary'), 'round1: SwitchInteger несёт NotEqual_IntInt');
  const swS = generateUEText([createFromEntry(byId('SwitchString'))]);
  ok(swS.includes('PinName="NotEqual_StriStri"') && swS.includes('Default__KismetStringLibrary'), 'round1: SwitchString несёт NotEqual_StriStri');
  const swE = generateUEText([createFromEntry(byId('SwitchEnum'))]);
  ok(swE.includes('PinName="NotEqual_ByteByte"') && swE.includes('EDrawDebugTrace'), 'round1: SwitchEnum на EDrawDebugTrace + NotEqual_ByteByte');
  const MG = { Gate: '5FD0ADDB41B99E726A411F8E87B5F37C', DoOnce: '1281F54248A2ECB5B8B2C5B24AE6FDF4', WhileLoop: 'FA93B260444755CD702C21A123E9A987', ForLoopWithBreak: '1FCFFE2843C702031581E5A273BD4C6B', DoN: 'E8C56B2F4535DC8B7DB8469140DCA455' };
  for (const [id, g] of Object.entries(MG)) ok(generateUEText([createFromEntry(byId(id))]).includes('GraphGuid=' + g), `round1: ${id} GraphGuid захвачен`);
  const ffT = generateUEText([createFromEntry(byId('FlipFlop'))]);
  ok(validateStrict(ffT).valid && /CustomProperties Pin \(PinId=[A-F0-9]{32},PinType\./.test(ffT), 'round1: FlipFlop безымянный exec-пин, strict чист');
  ok(byId('DoN').verified === true && byId('DoN').macro.graph === 'Do N', 'round1b: DoN — имя с пробелом, verified');
  const seT = generateUEText([createFromEntry(byId('SwitchEnum'))]);
  ok(seT.includes(`Enum="/Script/CoreUObject.Enum'/Script/Engine.EDrawDebugTrace'"`) && seT.includes('EnumEntries(0)=""') && seT.includes('EnumEntries(3)="Persistent"') && !seT.includes('PinName="Default"'), 'round1b: SwitchEnum — Enum/Entries (None→""), без Default');
  // round3: PromotableOperator — quoted-full MemberParent (unquoted движок отторг в TimeManagement+wildcard).
  const addT = generateUEText([createFromEntry(byId('Add_Float'))]);
  ok(addT.includes(`FunctionReference=(MemberParent="/Script/CoreUObject.Class'/Script/Engine.KismetMathLibrary'",MemberName="Add_DoubleDouble")`), 'round3: Add — quoted-full MemberParent + Add_DoubleDouble');
  // round3: Percent/Power — CallFunction, не оператор (live-рефы).
  const pctT = generateUEText([createFromEntry(byId('Percent_Float'))]);
  ok(pctT.includes('Class=/Script/BlueprintGraph.K2Node_CallFunction') && pctT.includes('MemberName="Percent_FloatFloat"'), 'round3: Percent — CallFunction Percent_FloatFloat');
  const powT = generateUEText([createFromEntry(byId('Power_Float'))]);
  ok(powT.includes('MemberName="MultiplyMultiply_FloatFloat"') && powT.includes('PinName="Base"') && powT.includes('PinName="Exp"'), 'round3: Power — MultiplyMultiply_FloatFloat + Base/Exp');
  // round3: Max/Min float — CommutativeAssociative FMax/FMin (live-рефы).
  const maxT = generateUEText([createFromEntry(byId('Max_Float'))]);
  ok(maxT.includes('Class=/Script/BlueprintGraph.K2Node_CommutativeAssociativeBinaryOperator') && maxT.includes('MemberName="FMax"') && maxT.includes('PinName="self"'), 'round3: Max — CommutativeAssociative FMax + self');
  const minT = generateUEText([createFromEntry(byId('Min_Float'))]);
  ok(minT.includes('MemberName="FMin"'), 'round3: Min — FMin');
  // round3b: F-имена округлений + SignOfFloat (без префикса функций нет).
  const sigT = generateUEText([createFromEntry(byId('Sign_Float'))]);
  ok(sigT.includes('MemberName="SignOfFloat"'), 'round3b: Sign — SignOfFloat');
  const flrT = generateUEText([createFromEntry(byId('Floor_Float'))]);
  ok(flrT.includes('MemberName="FFloor"'), 'round3b: Floor — FFloor');
  const ceiT = generateUEText([createFromEntry(byId('Ceil_Float'))]);
  ok(ceiT.includes('MemberName="FCeil"'), 'round3b: Ceil — FCeil');
  const truT = generateUEText([createFromEntry(byId('Trunc_Float'))]);
  ok(truT.includes('MemberName="FTrunc"'), 'round3b: Trunc — FTrunc');
}
// Sweep coverage: каждая запись реестра строится (кроме референс-листа)
{
  const THROW_OK = new Set(['Enhanced_GetActionValue']); // InputActionValue вне FULL-словаря
  const buildFail = [];
  for (const e of reg) {
    try { createFromEntry(e); }
    catch (err) { buildFail.push(e.id + ': ' + err.message); }
  }
  const unexpected = buildFail.filter(f => ![...THROW_OK].some(id => f.startsWith(id + ':')));
  unexpected.forEach(f => console.log('SWEEP-BUILD-FAIL:', f));
  ok(unexpected.length === 0, `sweep: строятся все записи (${reg.length - buildFail.length}/${reg.length})`);
  for (const id of THROW_OK) {
    let threw = false;
    try { createFromEntry(byId(id)); } catch { threw = true; }
    ok(threw, `sweep: ${id} всё ещё требует референс`);
  }
}
console.log(`
VALIDATE: pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);

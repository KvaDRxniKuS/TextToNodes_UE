// tests/validate.test.mjs — негативные фикстуры на все коды E/W + позитив + round-trip + весь реестр.
// Запуск: node tests/validate.test.mjs  (или npm test). Exit 1 при любом провале.
import fs from 'fs';
import { parseToGraphs, generateUEText } from '../src/parser.js';
import { createCallFunction, createOperator, createMacroInstance, createStructNode, createSequence, createSwitch, createBranch, createKnot, createComment, fitComment, linkPins } from '../src/generator.js';
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
cases.push(['W09', block(P + 'K2Node_CallFunction', 'LT_1', H(seq++), [FR_LIB('KismetSystemLibrary', 'SphereTraceSingle')], [pin('execute'), pin('then', { out: 1 }), pin('WorldContextObject', { cat: 'object' }), pin('Start', { cat: 'struct', sub: 'Vector', subObj: VEC }), pin('End', { cat: 'struct', sub: 'Vector', subObj: VEC }), pin('TraceChannel', { cat: 'byte' }), pin('ReturnValue', { out: 1, cat: 'bool' })]), true]);
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
  ok(fc.width === 620 && fc.pos.x === -60 && fc.pos.y === -110, 'fitComment: бокс по граням (620/-60/-110)');
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
console.log(`\nVALIDATE: pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);

// tests/sandbox.test.mjs — извлекает parseUE/genBlock/createFromReg/REG из index.html,
// прогоняет со стабами DOM. Запуск: node tests/sandbox.test.mjs (или npm test).
import fs from 'fs';
import { validateStrict } from '../src/validate.js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function extractFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('нет ' + name);
  let j = src.indexOf('{', i), depth = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    if (src[k] === '}') { depth--; if (!depth) return src.slice(i, k + 1); }
  }
  throw new Error('не закрыта ' + name);
}
function extractConst(src, name) {
  const m = src.match(new RegExp('const ' + name + '=\\{[^}]*\\};'));
  if (!m) throw new Error('нет const ' + name);
  return m[0];
}
const ri = script.indexOf('const REG = [') + 'const REG = '.length;
let depth = 0, instr = false, esc = false, end = -1;
for (let k = ri; k < script.length; k++) {
  const c = script[k];
  if (instr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') instr = false; }
  else { if (c === '"') instr = true; else if (c === '[') depth++; else if (c === ']') { depth--; if (!depth) { end = k + 1; break; } } }
}
const REG_SRC = script.slice(ri, end);
const harness =
  'const UE_VERSION=\'FULL\';\n' + extractConst(script, 'UE_LIBS') + '\n' + extractConst(script, 'UE_STRUCTS') + '\n' + extractConst(script, 'UE_ENUMS') + '\n' +
  'const REG=' + REG_SRC + ';\nfunction getREG(){ return REG; }\n' +
  'function guid(){ const h="0123456789ABCDEF"; let s=""; for(let i=0;i<32;i++) s+=h[Math.floor(Math.random()*16)]; return s; }\n' +
  'function headerColor(n){ return ""; } function snapVal(v){ return v; }\n' +
  'const mouseWorld={x:0,y:0}; const _nodes=[];\n' +
  'function curGraph(){ return {nodes:_nodes}; } function render(){}\n' +
  'const selected={clear(){},add(){}};\n' +
  extractFn(script, 'parseUE') + '\n' + extractFn(script, 'genBlock') + '\n' + extractFn(script, 'createFromReg') + '\n' + extractFn(script, 'classRef') + '\n' + extractFn(script, 'macroRefs') + '\n' +
  'globalThis.__sb = { parseUE, genBlock, createFromReg, getREG, _nodes, UE_LIBS, UE_STRUCTS, UE_ENUMS };';
fs.writeFileSync(new URL('./.sb-harness.tmp.cjs', import.meta.url), harness);
const { execSync } = await import('child_process');
execSync('node --check "' + new URL('./.sb-harness.tmp.cjs', import.meta.url).pathname + '"');
await import('./.sb-harness.tmp.cjs');
const sb = globalThis.__sb;
fs.unlinkSync(new URL('./.sb-harness.tmp.cjs', import.meta.url));

let pass = 0, fail = 0;
const ok = (c, t) => { c ? pass++ : (fail++, console.log('FAIL:', t)); };
ok(sb.getREG().length === 239, 'REG встроенный: 239');
ok(sb.UE_STRUCTS.Vector.includes('/Script/CoreUObject.Vector'), 'UE_STRUCTS: quoted-full');
ok(sb.UE_ENUMS.ETraceTypeQuery.includes('ETraceTypeQuery'), 'UE_ENUMS на месте');
ok(sb.UE_ENUMS.EObjectTypeQuery.includes('/Script/Engine.EObjectTypeQuery'), 'UE_ENUMS: EObjectTypeQuery (O2)');

for (const id of ['Delay', 'ForLoop', 'MakeVector', 'VSize', 'Add_Int', 'Greater_Float', 'Branch', 'PrintString', 'Gate', 'LineTraceSingle', 'ForEachLoop', 'BoxTraceMulti', 'LineTraceSingleForObjects']) {
  sb._nodes.length = 0;
  sb.createFromReg(id, { x: 0, y: 0 });
  const n = sb._nodes[0];
  ok(!!n, id + ': создана');
  if (!n) continue;
  n.rawBlock = sb.genBlock(n);
  const v = validateStrict(n.rawBlock);
  ok(v.valid, id + ': strict valid (' + v.errors.join(';') + ')');
}
sb._nodes.length = 0; sb.createFromReg('Delay', { x: 0, y: 0 });
ok(sb._nodes[0].memberParent.includes('KismetSystemLibrary'), 'Delay memberParent');
ok(sb._nodes[0].pins.some(p => p.name === 'then'), 'Delay пин then');
sb._nodes.length = 0; sb.createFromReg('ForLoop', { x: 0, y: 0 });
ok(sb._nodes[0].macroGraph === 'ForLoop' && sb._nodes[0].macroGuid === '55C904AF4B45FE1761FB55A8DB9FB801', 'ForLoop macro+guid');
sb._nodes.length = 0; sb.createFromReg('Add_Int', { x: 0, y: 0 });
ok(sb._nodes[0].operationName === 'Add' && sb._nodes[0].opMemberName === 'Add_IntInt', 'Add_Int op mapping');
sb._nodes.length = 0; sb.createFromReg('LineTraceSingle', { x: 0, y: 0 });
const lt = sb._nodes[0];
ok((lt.pins.find(p => p.name === 'TraceChannel') || {}).subCategoryObject.includes('ETraceTypeQuery'), 'TraceChannel enum subObj');
ok((lt.pins.find(p => p.name === 'Start') || {}).subCategoryObject.includes('/Script/CoreUObject.Vector'), 'Start quoted-full');
ok(lt.rawBlock.includes("ExportPath=\"/Script/BlueprintGraph.K2Node_CallFunction'\"/Game/"), 'ExportPath формат движка');
ok(lt.rawBlock.includes('MemberParent="/Script/CoreUObject.Class'), 'sandbox MemberParent quoted-full');
ok(lt.rawBlock.includes('PinSubCategory="",PinType.PinSubCategoryObject="/Script/CoreUObject.ScriptStruct'), 'sandbox struct SubCategory пусто');
ok(!lt.rawBlock.includes('PinFriendlyName='), 'без PinFriendlyName');
const g = sb.parseUE(lt.rawBlock);
const pn = g.EventGraph.nodes[0];
ok(pn.memberParent.includes('KismetSystemLibrary'), 'parseUE: MemberParent');
ok((pn.pins.find(p => p.name === 'Start') || {}).subCategoryObject.includes('/Script/CoreUObject.Vector'), 'parseUE: subObj');
console.log(`\nSANDBOX: pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);

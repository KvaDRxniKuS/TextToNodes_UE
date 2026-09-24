// src/validate.js — СТРОГАЯ валидация UE-текста перед вставкой в движок.
// Проверяет всё, что ломалось в engine-тестах v1/v2 (см. docs/ENGINE_VERIFIED.md):
// двусторонние связи, GUID, MemberParent, StructType, MacroInstance, Delay/then...
//
// CLI:  node src/validate.js graph.txt   (без файла — читает stdin; exit 1 при ошибках)
// API:  import { validateStrict } from './validate.js'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ALL_SUBOBJ } from './ue-types.js';

const HEX32 = /^[A-F0-9]{32}$/;
let REG_CACHE = null;

function loadRegistry() {
  if (REG_CACHE) return REG_CACHE;
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    REG_CACHE = JSON.parse(fs.readFileSync(path.join(dir, '../data/ue-functions.json'), 'utf8'));
  } catch (e) { REG_CACHE = []; }
  return REG_CACHE;
}

const KNOWN_SUBOBJ = new Set(ALL_SUBOBJ);

export function validateStrict(text, { registry = null } = {}) {
  const errors = [], warnings = [];
  const reg = registry || loadRegistry();
  const funcEntry = new Map();
  for (const e of reg) if (e.func) funcEntry.set(e.func, e);

  // --- разбивка на блоки верхнего уровня
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let depth = 0, cur = null;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('Begin Object')) { depth++; if (depth === 1) cur = { start: i, lines: [] }; }
    else if (t.startsWith('End Object')) { if (depth === 1 && cur) { cur.end = i; blocks.push(cur); cur = null; } depth = Math.max(0, depth - 1); }
    else if (cur && depth === 1) cur.lines.push(lines[i]);
  }
  const begins = (text.match(/Begin Object/g) || []).length;
  const ends = (text.match(/End Object/g) || []).length;
  if (begins === 0) errors.push('E01: нет Begin Object блоков');
  if (begins !== ends) errors.push(`E01: несбаланс Begin ${begins} vs End ${ends}`);

  // --- разбор блоков
  const nodes = [], pinIds = new Map(), guids = new Map(), names = new Set();
  blocks.forEach((b, bi) => {
    const hm = lines[b.start].trim().match(/Begin Object Class=([^\s]+) Name="([^"]+)"/);
    if (!hm) { errors.push(`E02: блок #${bi + 1}: нет Class/Name в заголовке`); return; }
    const [, cls, name] = hm;
    const short = cls.split('.').pop();
    if (names.has(name)) errors.push(`E05: дублирующееся имя ноды ${name}`);
    names.add(name);
    const node = { name, cls, short, pins: [], guid: '', funcName: '', memberParent: '', op: '', structType: '', macro: '' };
    for (const l of b.lines) {
      if (/^([A-Za-z0-9_]+)=\1=/.test(l.trim())) errors.push(`E18: ${name}: задвоенный префикс свойства (${l.trim().slice(0, 40)}...)`);
      const t = l.trim();
      if (t.startsWith('NodeGuid=')) node.guid = (t.match(/NodeGuid=([A-F0-9]+)/) || [])[1] || '';
      else if (t.startsWith('CustomProperties Pin')) {
        const s = t.substring(t.indexOf('Pin (') + 5);
        const pid = (s.match(/PinId=([A-F0-9]+)/) || [])[1] || '';
        const pname = (s.match(/PinName="([^"]+)"/) || [])[1];
        if (!pid) errors.push(`E04: ${name}: пин без PinId (${pname || '???'}) — движок перегенерирует пин и порвёт связь`);
        else {
          if (!HEX32.test(pid)) errors.push(`E04: ${name}.${pname}: PinId не 32-HEX (${pid})`);
          if (pinIds.has(pid)) errors.push(`E05: дублирующийся PinId ${pid} (${pinIds.get(pid)} + ${name}.${pname})`);
          else pinIds.set(pid, `${name}.${pname}`);
        }
        if (pname === undefined) errors.push(`E04: ${name}: пин без PinName`);
        const linked = (s.match(/LinkedTo=\(([^)]*)\)/) || [])[1] || '';
        const links = [];
        linked.split(',').map(x => x.trim()).filter(Boolean).forEach(tok => {
          const p = tok.split(/\s+/); if (p.length >= 2) links.push({ node: p[0], pin: p[1] });
        });
        const cat = (s.match(/PinCategory="([^"]*)"/) || [])[1] || '';
        const subObj = (s.match(/PinSubCategoryObject=([^,\)]+)/) || [])[1] || '';
        const isOut = s.includes('EGPD_Output');
        node.pins.push({ id: pid, name: pname || '', cat, subObj, links, isOut });
      }
      else if (t.startsWith('FunctionReference=')) {
        node.funcName = (t.match(/MemberName="([^"]+)"/) || [])[1] || '';
        node.memberParent = (t.match(/MemberParent="([^"]+)"/) || t.match(/MemberParent=([^,\)]+)/) || [])[1] || '';
      }
      else if (t.startsWith('OperationName=')) node.op = (t.match(/OperationName="([^"]+)"/) || [])[1] || '';
      else if (t.startsWith('StructType=')) node.structType = (t.match(/StructType=([^\s]+)/) || [])[1] || '';
      else if (t.startsWith('MacroGraphReference=')) node.macro = t;
    }
    if (!node.guid) errors.push(`E03: ${name}: нет NodeGuid`);
    else {
      if (!HEX32.test(node.guid)) errors.push(`E03: ${name}: NodeGuid не 32-HEX`);
      if (guids.has(node.guid)) errors.push(`E05: дублирующийся NodeGuid ${node.guid}`);
      else guids.set(node.guid, name);
    }
    nodes.push(node);
  });

  const byName = new Map(nodes.map(n => [n.name, n]));

  // --- связи: существование + двусторонность
  let linkCount = 0;
  nodes.forEach(n => n.pins.forEach(p => p.links.forEach(L => {
    linkCount++;
    const tgt = byName.get(L.node);
    if (!tgt) { errors.push(`E06: ${n.name}.${p.name} → несуществующая нода ${L.node}`); return; }
    const tp = tgt.pins.find(x => x.id === L.pin);
    if (!tp) { errors.push(`E06: ${n.name}.${p.name} → несуществующий пин ${L.node} ${L.pin}`); return; }
    if (!tp.links.some(x => x.node === n.name && x.pin === p.id))
      errors.push(`E07: односторонняя связь ${n.name}.${p.name} → ${L.node}.${tp.name} (нет обратной LinkedTo)`);
  })));

  // --- правила движка (из v1/v2 тестов)
  const BANNED_FLOW = ['K2Node_ForLoop', 'K2Node_WhileLoop', 'K2Node_Gate', 'K2Node_DoOnceMultiInput', 'K2Node_FlipFlop', 'K2Node_DoN'];
  nodes.forEach(n => {
    if (n.short === 'K2Node_Event')
      errors.push(`E08: ${n.name}: K2Node_Event — движок превращает его в сломанный custom event; вставляй ноды в граф с существующим эвентом`);
    if (BANNED_FLOW.includes(n.short))
      errors.push(`E09: ${n.name}: ${n.short} не существует как K2Node — используй K2Node_MacroInstance (см. реестр macro.*)`);
    if (n.short === 'K2Node_CallFunction' || n.short === 'K2Node_CallArrayFunction') {
      if (!n.funcName) errors.push(`E10: ${n.name}: CallFunction без FunctionReference/MemberName`);
      if (n.funcName) {
        const e = funcEntry.get(n.funcName);
        if (!e) warnings.push(`W05: ${n.name}: функция ${n.funcName} не найдена в реестре — проверь имя в движке`);
        else if (e.lib && !n.memberParent) warnings.push(`W06: ${n.name}: ${n.funcName} лучше с MemberParent ${e.lib} (bSelfContext может не найтись)`);
        if (e && e.note) warnings.push(`W09: ${n.name}: ${n.funcName}: ${e.note}`);
      }
      if (n.funcName === 'Delay') {
        if (!n.pins.some(p => p.name === 'then')) errors.push(`E12: Delay ${n.name}: выходной пин должен называться "then"`);
        if (n.pins.some(p => p.name === 'Completed')) errors.push(`E12: Delay ${n.name}: пин "Completed" движок оторвёт — переименуй в "then"`);
      }
    }
    if (n.short === 'K2Node_MakeStruct' || n.short === 'K2Node_BreakStruct') {
      if (!n.structType) errors.push(`E11: ${n.name}: ${n.short} без StructType`);
      else if (!n.structType.includes("ScriptStruct'")) errors.push(`E11: ${n.name}: StructType должен быть quoted-full (UE 5.8): "/Script/CoreUObject.ScriptStruct'/Script/...'"`);
      else if (n.structType.startsWith('/Script/')) warnings.push(`W11: ${n.name}: StructType ${n.structType} в полной asset-dump форме — буфер обмена требует quoted-full ("/Script/CoreUObject.ScriptStruct'/Script/...'" (UE 5.8), иначе движок дропнет ноду`);
      if (n.short === 'K2Node_MakeStruct' && n.structType) {
        const st = (n.structType.split('.').pop() || '').replace(/['"]/g, '');
        if (st && !n.pins.some(p => p.isOut && p.name === st))
          errors.push(`E11: MakeStruct ${n.name}: выходной пин должен называться "${st}" (движок переименовывает ReturnValue)`);
      }
    }
    if (n.short === 'K2Node_MacroInstance') {
      if (!n.macro) errors.push(`E15: ${n.name}: MacroInstance без MacroGraphReference`);
      else if (!n.macro.includes('GraphGuid=')) warnings.push(`W07: ${n.name}: MacroInstance без GraphGuid — движок обычно прощает, но лучше захватить из редактора`);
    }
    if (n.short === 'K2Node_PromotableOperator') {
      if (!n.op) errors.push(`E13: ${n.name}: PromotableOperator без OperationName`);
      if (n.funcName && n.op && n.funcName !== `${n.op}_DoubleDouble` && !funcEntry.has(n.funcName))
        warnings.push(`W08: ${n.name}: MemberName ${n.funcName} не похож на ${n.op}_DoubleDouble и его нет в реестре`);
    }
    if (n.short === 'K2Node_Knot') {
      if (!n.pins.some(p => p.name === 'InputPin')) errors.push(`E17: Knot ${n.name}: нет InputPin`);
      if (!n.pins.some(p => p.name === 'OutputPin')) errors.push(`E17: Knot ${n.name}: нет OutputPin`);
    }
    if ((n.short === 'K2Node_SwitchInteger' || n.short === 'K2Node_SwitchString') && !n.pins.some(p => p.name === 'Default'))
      warnings.push(`W01: ${n.name}: Switch без пина Default`);
    if (n.short === 'K2Node_Select' && !n.pins.some(p => /^Option/.test(p.name)))
      warnings.push(`W02: ${n.name}: Select без Option-пинов`);
    if (['K2Node_MakeArray', 'K2Node_MakeSet', 'K2Node_MakeMap'].includes(n.short))
      warnings.push(`W03: ${n.name}: ${n.short} требует ContainerType — текст может не вставиться; проверь в движке`);
    n.pins.forEach(p => {
      const known = !!p.subObj && KNOWN_SUBOBJ.has(p.subObj);
      if (p.cat === 'struct') {
        if (!p.subObj || p.subObj === 'None')
          warnings.push(`W10: ${n.name}.${p.name}: struct-пин без SubCategoryObject (движок достраивает по сигнатуре — проверено H1/J5; Make/Break нужен quoted-full путь "/Script/CoreUObject.ScriptStruct'/Script/...'" (UE 5.8)`);
        else if (!p.subObj.includes("ScriptStruct'"))
          errors.push(`E14: ${n.name}.${p.name}: struct-пин с битым PinSubCategoryObject (${p.subObj})`);
        else if (!known && p.subObj.startsWith('/Script/'))
          warnings.push(`W11: ${n.name}.${p.name}: путь ${p.subObj} в полной asset-dump форме — буфер обмена требует quoted-full ("/Script/CoreUObject.ScriptStruct'/Script/...'" (UE 5.8), иначе движок дропнет ноду`);
        else if (!known)
          warnings.push(`W10: ${n.name}.${p.name}: путь ${p.subObj} не из проверенного списка (src/ue-types.js) — убедись, что объект существует, иначе вставка упадёт`);
      }
      if (p.cat === 'byte' && p.subObj && p.subObj !== 'None') {
        if (!p.subObj.includes("Enum'"))
          errors.push(`E14: ${n.name}.${p.name}: byte-пин с битым PinSubCategoryObject (${p.subObj}) — для энамов нужен путь "/Script/CoreUObject.Enum'/Script/...'"`);
        else if (!known && p.subObj.startsWith('/Script/'))
          warnings.push(`W11: ${n.name}.${p.name}: путь энама ${p.subObj} в полной asset-dump форме — буфер обмена требует quoted-full ("/Script/CoreUObject.Enum'/Script/...'" (UE 5.8), иначе движок дропнет ноду`);
        else if (!known)
          warnings.push(`W10: ${n.name}.${p.name}: путь энама ${p.subObj} не из проверенного списка — убедись, что существует`);
      }
    });
  });

  return { valid: errors.length === 0, errors, warnings, nodes: nodes.length, links: linkCount };
}

// CLI: node src/validate.js [file] — без файла читает stdin
const invokedAs = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedAs && invokedAs === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  const src = (arg && !arg.startsWith('-')) ? fs.readFileSync(arg, 'utf8') : fs.readFileSync(0, 'utf8');
  const v = validateStrict(src);
  v.errors.forEach(e => console.log('❌ ' + e));
  v.warnings.forEach(w => console.log('⚠️ ' + w));
  console.log(`\nНод: ${v.nodes}, связей: ${v.links}, ошибок: ${v.errors.length}, предупреждений: ${v.warnings.length}`);
  console.log(v.valid ? '✅ STRICT OK — можно вставлять в UE' : '⛔ STRICT FAIL — чини перед вставкой');
  process.exit(v.valid ? 0 : 1);
}

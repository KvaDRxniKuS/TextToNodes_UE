// src/inventory.js — инвентарь графа/функции из UE-текста (P2 «контекст-первый»). CLI: tools/inventory.mjs
export function typeOf(t) {
  const cat = (t.match(/PinCategory="([^"]*)"/) || [])[1] || '';
  const sub = (t.match(/PinSubCategory="([^"]*)"/) || [])[1] || '';
  const so = (t.match(/PinSubCategoryObject=("[^"]*"|[^,)]*)/) || [])[1] || '';
  const arr = /ContainerType=Array/.test(t) ? '[]' : '';
  const leaf = so.replace(/"/g, '').replace(/'$/, '').split(/[.'/]/).pop();
  let ty = cat;
  if (cat === 'real') ty = sub === 'float' ? 'single' : 'float';
  else if (cat === 'struct') ty = (leaf || 'struct').toLowerCase();
  else if (cat === 'byte' && so && so !== 'None') ty = `enum:${leaf}`;
  else if (cat === 'object' || cat === 'class') ty = `${cat}:${so.replace(/"/g, '').replace(/^[^']*'/, '').replace(/'$/, '')}`;
  return ty + arr;
}

export function inventory(text) {
  const inv = { members: [], locals: [], params: [], external: [], composites: [], tunnels: [], calls: [], functions: [] };
  const seen = new Set();
  const add = (list, key, obj) => { const k = list + ':' + key; if (!seen.has(k)) { seen.add(k); inv[list].push(obj); } };
  // только блоки верхнего уровня — вложенные (BoundGraph композита) тоже встречаются как отдельные Begin Object
  const blocks = text.split(/^\s*Begin Object /m).slice(1).map(b => 'Begin Object ' + b.split(/^\s*End Object/m)[0]);
  for (const b of blocks) {
    const cls = ((b.match(/Class=([^\s]+)/) || [])[1] || '').split('.').pop();
    const name = (b.match(/Name="([^"]+)"/) || [])[1] || '';
    const pins = [...b.matchAll(/CustomProperties Pin \((.*)\)\s*$/gm)].map(m => m[1]);
    const pinName = p => (p.match(/PinName="([^"]*)"/) || [])[1] || '';
    const isOut = p => p.includes('EGPD_Output');
    if (cls === 'K2Node_VariableGet' || cls === 'K2Node_VariableSet') {
      const vr = (b.match(/VariableReference=\(([^\n]*)\)/) || [])[1] || '';
      const vn = (vr.match(/MemberName="([^"]+)"/) || [])[1]; if (!vn) continue;
      const guid = (vr.match(/MemberGuid=([A-F0-9]{32})/) || [])[1] || '';
      const scope = (vr.match(/MemberScope="([^"]+)"/) || [])[1];
      const parent = (vr.match(/MemberParent=("[^"]+"|[^,)]+)/) || [])[1];
      const vp = pins.find(p => pinName(p) === vn);
      const type = vp ? typeOf(vp) : '';
      if (scope) add('locals', scope + '.' + vn, { scope, name: vn, type, guid });
      else if (parent) add('external', parent + '.' + vn, { owner: parent.replace(/"/g, ''), name: vn, type });
      else add('members', vn, { name: vn, type, guid });
    } else if (cls === 'K2Node_FunctionEntry' || cls === 'K2Node_FunctionResult') {
      const fn = (b.match(/FunctionReference=\([^\n]*MemberName="([^"]+)"/) || [])[1] || name;
      if (cls === 'K2Node_FunctionEntry' && !inv.functions.includes(fn)) inv.functions.push(fn);
      for (const m of b.matchAll(/LocalVariables\(\d+\)=\((.*)\)\s*$/gm)) {
        const lv = m[1];
        const vn = (lv.match(/VarName="([^"]+)"/) || [])[1]; if (!vn) continue;
        add('locals', fn + '.' + vn, { scope: fn, name: vn, type: typeOf((lv.match(/VarType=\(([^)]*)\)/) || [])[1] || ''), guid: (lv.match(/VarGuid=([A-F0-9]{32})/) || [])[1] || '' });
      }
      for (const p of pins) {
        const pn = pinName(p);
        if (!pn || /PinCategory="exec"/.test(p) || pn === 'self') continue;
        // Entry: выходы = входные параметры функции; Result: входы = выходные
        if (cls === 'K2Node_FunctionEntry' ? isOut(p) : !isOut(p))
          add('params', fn + '.' + pn, { scope: fn, name: pn, type: typeOf(p), dir: cls === 'K2Node_FunctionEntry' ? 'in' : 'out' });
      }
    } else if (cls === 'K2Node_Composite') {
      add('composites', name, { name, graph: (b.match(/BoundGraph=[^'"]*['"]*([^'"\n]+)/) || [])[1] || '' });
    } else if (cls === 'K2Node_Tunnel') {
      add('tunnels', name, { name, pins: pins.filter(p => !/PinCategory="exec"/.test(p)).map(p => ({ name: pinName(p), type: typeOf(p), dir: isOut(p) ? 'out' : 'in' })) });
    } else if (/CallFunction/.test(cls)) {
      const fn = (b.match(/FunctionReference=\([^\n]*MemberName="([^"]+)"/) || [])[1];
      if (fn && !inv.calls.includes(fn)) inv.calls.push(fn);
    }
  }
  return inv;
}


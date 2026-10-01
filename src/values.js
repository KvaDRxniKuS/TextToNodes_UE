// R60: текстовые форматы значений по умолчанию для пинов (как их пишет UE 5.8 в DefaultValue/DefaultObject/DefaultTextValue).
// formatValue(type, v) → { dv } | { defObj }. type — результат parseType. v — JS-значение или готовая строка (передаётся как есть).
const f6 = (x) => Number(x).toFixed(6);
const isArr = Array.isArray;
export function formatValue(t, v) {
  if (v === undefined || v === null || v === '') return {};
  if (t.cat === 'object' || t.cat === 'class' || t.cat === 'softobject' || t.cat === 'softclass') return { defObj: String(v) };
  if (typeof v === 'string' && !(t.cat === 'struct' && typeof v === 'string' && v.startsWith('#'))) {
    // строка — готовый текст UE, кроме GameplayTag по имени тега
    if (t.cat === 'struct' && /GameplayTag'/.test(t.subObj) && !v.startsWith('(')) return { dv: `(TagName=\\"${v}\\")` };
    return { dv: v };
  }
  switch (t.cat) {
    case 'bool': return { dv: v ? 'true' : 'false' };
    case 'int': case 'int64': case 'byte': return { dv: String(Math.trunc(v)) };
    case 'real': return { dv: f6(v) };
    case 'struct': {
      const s = t.subObj;
      if (/\.Vector'/.test(s) && isArr(v)) return { dv: v.map(f6).join(',') };
      if (/\.Rotator'/.test(s) && isArr(v)) return { dv: v.map(f6).join(',') }; // порядок Pitch,Yaw,Roll
      if (/\.Vector2D'/.test(s) && isArr(v)) return { dv: `(X=${f6(v[0])},Y=${f6(v[1])})` };
      if (/\.LinearColor'/.test(s) && isArr(v)) return { dv: `(R=${f6(v[0])},G=${f6(v[1])},B=${f6(v[2])},A=${f6(v[3] ?? 1)})` };
      if (/\.Transform'/.test(s) && v && typeof v === 'object') {
        const { loc = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = v;
        return { dv: [loc, rot, scale].map(a => a.map(f6).join(',')).join('|') };
      }
    }
  }
  throw new Error(`formatValue: не знаю формат для ${t.cat} ${t.subObj || ''} = ${JSON.stringify(v)}`);
}

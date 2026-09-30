// Линтер раскладки — правила из docs/LAYOUT_REFERENCES.md (три графа пользователя, 2026-09-30).
// Только читает ноды с координатами; ничего не двигает и не связывает. Предупреждения, не ошибки.
//   L1  exec-нода без входящего exec (висит мёртвой; события и knot'ы не в счёт)
//   L2  выход Sequence уходит вверх (цель выше самого Sequence)
//   L3  длинный провод данных по X (> maxData px): источник дублировать у потребителя или вести шиной knot'ов
//   L4  длинный exec-провод по X (> maxExec px, шина knot→knot не в счёт; грязный образец — 1900px): вероятно, дерево стоит в промежутке ряда — увести под ряд
const EVENTS = /K2Node_(CustomEvent|Event|InputAction|EnhancedInputAction|InputKey|ComponentBoundEvent|ActorBoundEvent)$/;

export function lintLayout(nodes, { maxData = 1200, maxExec = 1600 } = {}) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const out = [];
  const name = n => `${n.id}${n.varName ? ` (${n.varName})` : n.eventName ? ` (${n.eventName})` : ''}`;
  for (const n of nodes) {
    const cls = n.className || '';
    const execIn = n.pins.filter(p => p.direction === 'Input' && p.category === 'exec' && !p.hidden);
    if (execIn.length && !EVENTS.test(cls) && !/Knot$/.test(cls) && execIn.every(p => !p.linkedTo.length))
      out.push({ code: 'L1', node: n.id, msg: `${name(n)}: exec-вход не подключён — нода не выполнится` });
    for (const p of n.pins) {
      if (p.direction !== 'Output') continue;
      for (const l of p.linkedTo) {
        const t = byId.get(l.nodeName);
        if (!t || !n.pos || !t.pos) continue;
        if (/Sequence$/.test(cls) && p.category === 'exec' && t.pos.y < n.pos.y)
          out.push({ code: 'L2', node: n.id, msg: `${name(n)}.${p.name} → ${name(t)}: выход Sequence уходит вверх (${t.pos.y} < ${n.pos.y})` });
        if (/Knot$/.test(cls) && /Knot$/.test(t.className || '')) continue;   // шина knot'ов длинна по замыслу
        const dx = Math.abs(t.pos.x - n.pos.x);
        if (p.category === 'exec' ? dx > maxExec : dx > maxData)
          out.push({ code: p.category === 'exec' ? 'L4' : 'L3', node: n.id, msg: `${name(n)}.${p.name} → ${name(t)}: провод ${dx}px по X` });
      }
    }
  }
  return out;
}

// Потоковый расстановщик (ступень 2) по эталонам пользователя:
//   sweep/copyback/sphere-flow-layout-reference.md (правила 1–6),
//   sweep/copyback/flow-layout-samples-2-reference.md (правила 7–12),
//   sweep/copyback/flow-demo-reference.md (ручная перестановка flow-demo, 2026-10-02).
// v2 (по flow-demo-reference):
//   • хребет плотный: ширина ноды + gap; места под чистые входы в ряду НЕ резервируется;
//   • exec-пины соосны (headerLines);
//   • else / Completed / прочие побочные exec-выходы — под СЛЕДУЮЩЕЙ нодой: Y = её низ + 32, прямой провод;
//   • дерево чистых — влево от потребителя: прямые входы правым краем у (потребитель.x − 16), входы входов —
//     колонкой левее (зазор 32); дети центрируются по родителю. Дерево ищет свободное место ПОД рядом
//     (сдвиг вниз по 16), а если путь вниз перекрыт exec-нодой (ответвлением) — НАД рядом.
// Не меняет код нод (F): только pos. Knot'ы не создаёт.
import { estNodeWidth, GRID } from './generator.js';
import { execPinOffset } from './arranger.js';

const up = v => Math.ceil(v / GRID) * GRID;
const down = v => Math.floor(v / GRID) * GRID;
const isExec = p => p.category === 'exec';
const vis = (n, dir) => (n.pins || []).filter(p => !p.hidden && !p.advanced && p.direction === dir);
export const isPure = n => !(n.pins || []).some(p => !p.hidden && isExec(p)) && !(n.className || '').includes('Comment');
const compact = n => /VariableGet|K2Node_Self|PromotableOperator|CommutativeAssociativeBinaryOperator|Knot/.test(n.className || '');

/** Высота для раскладки (свёрнутые advanced-пины не считаются, стрелка разворота +16). */
export function flowHeight(n) {
  const rows = Math.max(vis(n, 'Input').length, vis(n, 'Output').length, 1);
  const adv = (n.pins || []).some(p => p.advanced && !p.hidden) ? 16 : 0;
  return compact(n) ? 32 * rows : up(48 + 32 * rows + adv);
}

export function arrangeExecFlow(nodes, { x = 0, y = 0, gap = 48, colGap = 32, vGap = 16, branchGap = 32, rowGap = 160 } = {}) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const placed = new Set();
  const boxes = []; // {x0,y0,x1,y1,exec}
  const addBox = (n, exec) => boxes.push({ x0: n.pos.x, y0: n.pos.y, x1: n.pos.x + estNodeWidth(n), y1: n.pos.y + flowHeight(n), exec });
  const execOut = n => vis(n, 'Output').filter(isExec);
  const nextOf = p => (p.linkedTo || []).map(l => byId.get(l.nodeName)).filter(Boolean);
  const mainOut = n => {
    const outs = execOut(n).filter(p => nextOf(p).length);
    return outs.find(p => /^(then|LoopBody|then_0|Exec)$/.test(p.name)) || outs[0] || null;
  };
  const pureInputs = (n, seen) => {
    const res = [];
    for (const p of vis(n, 'Input')) if (!isExec(p)) for (const l of p.linkedTo || []) {
      const s = byId.get(l.nodeName);
      if (s && isPure(s) && !placed.has(s) && !seen.has(s)) { seen.add(s); res.push(s); }
    }
    return res;
  };

  // Дерево чистых относительной формой: [{node, dx, dy}] с правым краем прямых входов в 0 и верхом 0.
  const shapeTree = root => {
    const seen = new Set();
    const items = [];
    // рекурсивно: возвращает высоту поддерева, кладёт узлы с относительными координатами
    const lay = (parent, right, top) => {
      const kids = pureInputs(parent, seen);
      if (!kids.length) return 0;
      const w = Math.max(...kids.map(estNodeWidth));
      const left = down(right - w);
      let cy = top, bottom = top;
      for (const k of kids) {
        const h = flowHeight(k);
        const it = { node: k, dx: left, dy: cy };
        items.push(it);
        const subH = lay(k, left - colGap, cy);
        // поддерево центрируем относительно ребёнка: сдвиг ребёнка к центру поддерева
        if (subH > h) it.dy = up(cy + (subH - h) / 2);
        cy = up(cy + Math.max(h, subH) + vGap);
        bottom = cy - vGap;
      }
      return bottom - top;
    };
    const h = lay(root, 0, 0);
    return { items, h };
  };
  const fits = (items, ox, oy) => {
    let execHit = false, hit = false;
    for (const it of items) {
      const b = { x0: ox + it.dx, y0: oy + it.dy, x1: ox + it.dx + estNodeWidth(it.node), y1: oy + it.dy + flowHeight(it.node) };
      for (const o of boxes) if (b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 + vGap && o.y0 < b.y1 + vGap) { hit = true; if (o.exec) execHit = true; }
    }
    return { hit, execHit };
  };
  const placeTree = (n, rowTop) => {
    const { items, h } = shapeTree(n);
    if (!items.length) return;
    const ox = n.pos.x - 16;
    let oy = up(n.pos.y + flowHeight(n)), above = false;
    for (let i = 0; i < 64; i++) {
      const f = fits(items, ox, oy);
      if (!f.hit) break;
      if (f.execHit) { above = true; break; }
      oy += GRID;
    }
    if (above) {
      oy = down(rowTop - 3 * vGap - h);
      for (let i = 0; i < 64 && fits(items, ox, oy).hit; i++) oy -= GRID;
    }
    for (const it of items) { it.node.pos = { x: ox + it.dx, y: oy + it.dy }; placed.add(it.node); addBox(it.node, false); }
  };

  // Ряд хребта: сначала все exec-ноды (и ответвления), потом деревья — чтобы деревья видели ответвления.
  const rows = [];
  const layRow = (start, x0, y0) => {
    const spine = [];
    for (let n = start; n && !placed.has(n); ) { spine.push(n); placed.add(n); const m = mainOut(n); n = m ? nextOf(m)[0] : null; }
    let cursor = x0;
    for (const n of spine) { n.pos = { x: up(cursor), y: 0 }; cursor = n.pos.x + estNodeWidth(n) + gap; }
    const offs = spine.map(n => execPinOffset(n) ?? 0);
    const ref = Math.max(...offs);
    spine.forEach((n, i) => { n.pos.y = y0 + ref - offs[i]; addBox(n, true); });
    const rowTop = Math.min(...spine.map(n => n.pos.y));
    rows.push({ spine, rowTop });
    spine.forEach((n, i) => {
      const m = mainOut(n);
      for (const p of execOut(n)) if (p !== m) for (const t of nextOf(p)) if (!placed.has(t)) {
        const at = spine[i + 1] || n;
        let by = up(at.pos.y + flowHeight(at) + branchGap);
        // ниже уже занятых exec-ответвлений в этой колонке
        for (const o of boxes) if (o.exec && o.x0 < at.pos.x + estNodeWidth(at) && at.pos.x < o.x1 && o.y1 > by - branchGap && o.y0 > at.pos.y) by = up(o.y1 + branchGap);
        layRow(t, at.pos.x, by);
      }
    });
  };

  const starts = nodes.filter(n => !isPure(n) && !vis(n, 'Input').some(p => isExec(p) && (p.linkedTo || []).length) && execOut(n).length);
  let rowY = y;
  for (const s of starts) if (!placed.has(s)) {
    const first = rows.length;
    layRow(s, x, rowY);
    for (const r of rows.slice(first)) for (const n of r.spine) placeTree(n, r.rowTop);
    rowY = up(Math.max(...boxes.map(b => b.y1)) + rowGap);
  }
  let lx = x;
  for (const n of nodes) if (!placed.has(n) && !(n.className || '').includes('Comment')) { n.pos = { x: lx, y: rowY }; lx = up(lx + estNodeWidth(n) + gap); }
  return { nodes, rows: rows.map(r => r.spine) };
}

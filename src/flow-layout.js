// Потоковый расстановщик (ступень 2) по эталонам пользователя:
//   sweep/copyback/sphere-flow-layout-reference.md (правила 1–6),
//   sweep/copyback/flow-layout-samples-2-reference.md (правила 7–12).
// Реализовано здесь:
//   1/7  exec-хребет одним рядом, exec-пины соосны (headerLines), ряд плотный;
//   6    шаг хребта неравный: ширина ноды + место под дерево её чистых входов;
//   3/9  чистые входы — деревом слева-снизу от потребителя: прямые входы столбиком под потребителем
//        (шаг = высота + 16, листья-Get'ы → 48), входы входов — колонкой левее;
//        если под нодой стоит ответвление (else/Completed) — дерево ставится НАД рядом;
//   8    else / Completed / прочие побочные exec-выходы — под СЛЕДУЮЩЕЙ нодой хребта, прямым проводом,
//        дальше ответвление идёт своим плотным рядом.
// Не меняет код нод (F): только pos. Knot'ы не создаёт (всё вперёд, переносов назад нет).
import { estNodeWidth, GRID } from './generator.js';
import { execPinOffset } from './arranger.js';

const up = v => Math.ceil(v / GRID) * GRID;
const isExec = p => p.category === 'exec';
const vis = (n, dir) => (n.pins || []).filter(p => !p.hidden && p.direction === dir);
export const isPure = n => !(n.pins || []).some(p => !p.hidden && isExec(p)) && !(n.className || '').includes('Comment');
const compact = n => /VariableGet|K2Node_Self|PromotableOperator|CommutativeAssociativeBinaryOperator|Knot/.test(n.className || '');

/** Высота для раскладки чистых (эталон: Get ≈ 32 → шаг 48; библиотечная с 4 пинами ≈ 176 → шаг ≈ 208). */
export function flowHeight(n) {
  const rows = Math.max(vis(n, 'Input').length, vis(n, 'Output').length, 1);
  return compact(n) ? 32 * rows : up(48 + 32 * rows);
}

export function arrangeExecFlow(nodes, { x = 0, y = 0, gap = 48, colGap = 32, vGap = 16, branchDrop = 48 } = {}) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const placed = new Set();
  const execOut = n => vis(n, 'Output').filter(isExec);
  const nextOf = p => (p.linkedTo || []).map(l => byId.get(l.nodeName)).filter(Boolean);
  // Главный выход: then / LoopBody / then_0, иначе первый подключённый.
  const mainOut = n => {
    const outs = execOut(n).filter(p => nextOf(p).length);
    return outs.find(p => /^(then|LoopBody|then_0|Exec)$/.test(p.name)) || outs[0] || null;
  };
  // Чистые входы ноды (ещё не расставленные), по порядку пинов.
  const pureInputs = n => {
    const res = [];
    for (const p of vis(n, 'Input')) if (!isExec(p)) for (const l of p.linkedTo || []) {
      const s = byId.get(l.nodeName);
      if (s && isPure(s) && !placed.has(s) && !res.includes(s)) res.push(s);
    }
    return res;
  };
  // Дерево чистых: колонки по глубине (0 — прямые входы).
  const treeOf = n => {
    const cols = []; const seen = new Set();
    let frontier = [n];
    for (let d = 0; frontier.length && d < 12; d++) {
      const col = [];
      for (const c of frontier) for (const s of pureInputs(c)) if (!seen.has(s)) { seen.add(s); col.push(s); }
      if (!col.length) break;
      cols.push(col); frontier = col;
    }
    return cols;
  };
  const colWidth = col => Math.max(...col.map(estNodeWidth));
  // Ширина дерева левее правого края прямых входов (прямые входы правым краем у левого края потребителя).
  const treeSpan = cols => cols.reduce((w, c, i) => w + colWidth(c) + (i ? colGap : 0), 0);

  const result = { nodes: [], rows: [] };
  const placeTree = (n, cols, above, rowTop, rowBottom) => {
    let right = n.pos.x + (cols.length ? Math.min(estNodeWidth(n), colWidth(cols[0])) : 0) - 16; // прямые входы — под нодой, чуть левее
    cols.forEach((col, d) => {
      const w = colWidth(col);
      const cx = Math.floor((right - w) / GRID) * GRID;
      const hs = col.map(flowHeight);
      const total = hs.reduce((a, h) => a + h + vGap, -vGap);
      let cy = above ? rowTop - vGap * 2 - total : n.pos.y + flowHeight(n) + vGap * 2;
      col.forEach((s, i) => { s.pos = { x: cx, y: up(cy) }; placed.add(s); result.nodes.push(s); cy += hs[i] + vGap; });
      right = cx - colGap;
    });
  };

  // Ряд хребта начиная с start; возвращает {bottom}.
  const layRow = (start, x0, y0) => {
    const spine = [];
    for (let n = start; n && !placed.has(n); ) { spine.push(n); placed.add(n); const m = mainOut(n); n = m ? nextOf(m)[0] : null; }
    const trees = spine.map(treeOf);
    // X: учитываем место под деревья (правило 6).
    let cursor = x0;
    spine.forEach((n, i) => {
      const need = trees[i].length ? treeSpan(trees[i]) - Math.min(estNodeWidth(n), colWidth(trees[i][0])) + 16 : 0;
      const nx = up(Math.max(cursor, i ? cursor + need : x0 + need));
      n.pos = { x: nx, y: 0 };
      cursor = nx + estNodeWidth(n) + gap;
    });
    // Y: соосные exec-пины.
    const offs = spine.map(execPinOffset).map(v => v ?? 0);
    const ref = Math.max(...offs);
    spine.forEach((n, i) => { n.pos.y = y0 + ref - offs[i]; result.nodes.push(n); });
    const rowTop = Math.min(...spine.map(n => n.pos.y));
    const rowBottom = up(Math.max(...spine.map(n => n.pos.y + flowHeight(n))));
    // Ответвления: побочные exec-выходы → под следующей нодой хребта.
    const branches = [];
    spine.forEach((n, i) => {
      const m = mainOut(n);
      for (const p of execOut(n)) if (p !== m) for (const t of nextOf(p)) if (!placed.has(t)) branches.push({ at: spine[i + 1] || n, t });
    });
    const branchX = branches.length ? Math.min(...branches.map(b => b.at.pos.x)) : Infinity;
    result.rows.push(spine);
    // Деревья: под нодой; если её место снизу занимают ответвления (X ноды правее начала ответвления) — над рядом (правило 9).
    spine.forEach((n, i) => placeTree(n, trees[i], n.pos.x + estNodeWidth(n) > branchX, rowTop, rowBottom));
    let bottom = Math.max(rowBottom, ...result.nodes.filter(s => isPure(s)).map(s => s.pos.y + flowHeight(s)));
    let by = up(rowBottom + branchDrop);
    for (const b of branches) {
      if (placed.has(b.t)) continue;
      const sub = layRow(b.t, b.at.pos.x, by);
      by = up(sub.bottom + branchDrop);
      bottom = Math.max(bottom, sub.bottom);
    }
    return { bottom };
  };

  const starts = nodes.filter(n => !isPure(n) && !vis(n, 'Input').some(p => isExec(p) && (p.linkedTo || []).length) && execOut(n).length);
  let rowY = y;
  for (const s of starts) if (!placed.has(s)) { rowY = up(layRow(s, x, rowY).bottom + 160); }
  // Остатки (чистые без потребителя и пр.) — рядом снизу.
  let lx = x;
  for (const n of nodes) if (!placed.has(n) && !(n.className || '').includes('Comment')) { n.pos = { x: lx, y: rowY }; lx = up(lx + estNodeWidth(n) + gap); result.nodes.push(n); }
  return result;
}

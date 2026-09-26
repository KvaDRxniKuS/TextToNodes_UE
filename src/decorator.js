// Ступень 3: декоратор — визуальное выравнивание черновика, построенного ступенью 2.
//
// Правило ТЗ (дословно): «берёт XY пинов соединённых нод, двигает ноды так, чтобы Y
// подходящих пинов совпадали, и оставляет зазор в 5 шагов сетки по X. Переносные knot'ы:
// X первого = X пина-выхода первой не-knot ноды, X второго = X пина-входа второй, оба на Y
// посередине между низом верхней строки и верхом нижней».
//
// Отсюда границы ответственности ступени 3:
//   · только координаты: ни создания/удаления нод, ни правки пинов и `LinkedTo`;
//   · узел не уходит из своего уровня и не меняет порядок нод внутри уровня —
//     черновая структура расстановщика сохраняется;
//   · knot-переносы не создаются и не удаляются (это ступень 2), а только ставятся по пинам.
import { estNodeWidth, estNodeHeight, pinCenterY, GRID } from './generator.js';
import { rerouteCorridorY } from './arranger.js';

export const isKnot = n => (n.className || '').includes('Knot');
const isComment = n => (n.className || '').includes('Comment') || !!(n && n.isComment);
const dirOf = p => String((p && p.direction) || '').toLowerCase();
const isOut = p => dirOf(p) === 'output';
const isIn = p => dirOf(p) === 'input';

// Knot в UE — одна клетка сетки: InputPin на левом крае, OutputPin на правом.
export const KNOT_W = 16;

/** X пина в модели Slate-ноды: вход прижат к левому краю ноды, выход — к правому. */
export function pinCenterX(n, pin) {
  if (isKnot(n)) return isOut(pin) ? n.pos.x + KNOT_W : n.pos.x;
  return isOut(pin) ? n.pos.x + estNodeWidth(n) : n.pos.x;
}

/** Смещение центра пина от NodePosY — чтобы двигать ноду под пин, а не пин под ноду. */
function pinOffsetY(n, pin, pinY) {
  return pinY({ ...n, pos: { x: n.pos.x, y: 0 } }, pin);
}

/**
 * Соединения между РЕАЛЬНЫМИ нодами: цепочки knot-переносов раскрыты и лежат в `via`.
 * Декоратор мыслит связями «нода → нода», поэтому knot'ы для него — способ прокладки,
 * а не участники выравнивания.
 */
export function flatLinks(nodes) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const links = [];
  for (const source of nodes) {
    if (isKnot(source) || isComment(source)) continue;
    for (const out of source.pins || []) {
      if (!isOut(out)) continue;
      for (const link of out.linkedTo || []) {
        let node = byId.get(link.nodeName);
        let pin = node ? node.pins.find(p => p.id === link.pinId) : null;
        const via = [];
        while (node && isKnot(node)) {
          via.push(node);
          // через knot проходим НАПРОЛЁТ: пришёл во вход — вышел из выхода (иначе
          // вернёмся по взаимной LinkedTo назад в тот же узел)
          const forward = (node.pins || []).find(p => p !== pin && isIn(pin) === isOut(p)) || node.pins[1] || node.pins[0];
          const next = (forward.linkedTo || [])[0];
          if (!next) { node = null; pin = null; break; }
          node = byId.get(next.nodeName);
          pin = node ? node.pins.find(p => p.id === next.pinId) : null;
        }
        if (!node || isComment(node) || !pin || !isIn(pin)) continue;
        links.push({ source, out, target: node, input: pin, via, exec: out.category === 'exec' });
      }
    }
  }
  return links;
}

/** Строки черновика: ноды с одинаковым (привязанным к сетке) NodePosY — это один уровень. */
export function groupByRowY(nodes, grid = GRID) {
  const map = new Map();
  for (const n of nodes) {
    const key = Math.round(n.pos.y / grid) * grid;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(n);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => {
    const nodes = list.slice().sort((a, b) => a.pos.x - b.pos.x);
    return {
      nodes,
      get top() { return Math.min(...this.nodes.map(n => n.pos.y)); },
      get bottom() { return Math.max(...this.nodes.map(n => n.pos.y + estNodeHeight(n))); },
    };
  });
}

/**
 * Уровни по перекрытию вертикальных полос: после выравнивания пинов ряд превращается в
 * «лесенку» (Y нод ряда различаются), поэтому уровень = связная группа полос, а не один Y.
 */
export function buildLevels(nodes) {
  const items = nodes.filter(n => !isKnot(n) && !isComment(n))
    .map(n => ({ n, top: n.pos.y, bottom: n.pos.y + estNodeHeight(n) }))
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  const levels = [];
  let cur = null;
  for (const it of items) {
    if (cur && it.top < cur.bottom) {
      cur.nodes.push(it.n);
      cur.top = Math.min(cur.top, it.top);
      cur.bottom = Math.max(cur.bottom, it.bottom);
    } else {
      cur = { top: it.top, bottom: it.bottom, nodes: [it.n] };
      levels.push(cur);
    }
  }
  for (const l of levels) l.nodes.sort((a, b) => a.pos.x - b.pos.x);
  return levels;
}

/**
 * Выравнивание черновика. Опции:
 *  · `clearance` — зазор по X между соединёнными нодами, по ТЗ = 5 шагов сетки (80 при grid 16);
 *  · `grid`      — клетка редактора (для `snap` и группировки строк);
 *  · `pinY`      — модель Y-центра пина (по умолчанию — оценка из `generator.js`);
 *  · `minLevelGap` — минимальный вертикальный зазор между уровнями, нужное количество рядов
 *                    сдвигается вниз, если выравнивание пинов «съело» межуровневую щель;
 *  · `snap`      — привязать результат к сетке (по умолчанию выкл: округление ломает совмещение
 *                  пинов, а само совмещение и есть критерий ступени 3).
 * Возвращает `{ nodes, levels, rows, moved, notes, knots: [] }`; `knots` пуст — ступень 3
 * переносы не создаёт (в `layout-pipeline` они уже лежат в `nodes`).
 */
export function decorateLayout(nodes, {
  clearance = 5 * GRID,
  grid = GRID,
  pinY = pinCenterY,
  minLevelGap = 2 * grid,
  snap = false,
} = {}) {
  const real = nodes.filter(n => !isKnot(n) && !isComment(n));
  const knots = nodes.filter(isKnot);
  const links = flatLinks(nodes);
  const rows = groupByRowY(real, grid);
  const rowOf = new Map();
  rows.forEach((r, i) => r.nodes.forEach(n => rowOf.set(n.id, i)));

  const moved = [];
  const notes = [];
  const rect = n => ({ x1: n.pos.x, x2: n.pos.x + estNodeWidth(n), y1: n.pos.y, y2: n.pos.y + estNodeHeight(n) });
  const hit = (a, b) => a.x1 < b.x2 - 1 && b.x1 < a.x2 - 1 && a.y1 < b.y2 - 1 && b.y1 < a.y2 - 1;
  const blocked = (r, self) => real.some(m => m !== self && hit(r, rect(m)));
  const place = (n, x, y, why) => {
    x = Math.round(x); y = Math.round(y);
    if (n.pos.x === x && n.pos.y === y) return false;
    const from = { x: n.pos.x, y: n.pos.y };
    n.pos.x = x; n.pos.y = y;
    moved.push({ id: n.id, from, to: { x, y }, why });
    return true;
  };
  const sizeOf = n => ({ w: estNodeWidth(n), h: estNodeHeight(n) });

  // ── 1. exec-скелет: следующий узел ряда = правый край предыдущего + зазор, Y — пин в пин ──
  const execIn = new Map();
  const dataLinks = [];
  for (const l of links) {
    if (l.exec) {
      if (!execIn.has(l.target.id)) execIn.set(l.target.id, []);
      execIn.get(l.target.id).push(l);
    } else dataLinks.push(l);
  }
  const execDriven = new Set();
  for (const row of rows) {
    const inRow = new Set(row.nodes.map(n => n.id));
    const queue = row.nodes.slice().sort((a, b) => a.pos.x - b.pos.x || a.pos.y - b.pos.y);
    const done = new Set();
    let cursor = -Infinity; // правый край последнего поставленного узла ряда + зазор
    while (queue.length) {
      const i = queue.findIndex(n => (execIn.get(n.id) || []).some(e => inRow.has(e.source.id) && done.has(e.source.id) && e.source !== n));
      if (i < 0) {
        // вершина ряда (событие) или вход из другого уровня через knot-перенос:
        // позиция черновика — это и есть структура расстановщика, не трогаем
        const anchor = queue.shift();
        done.add(anchor.id);
        cursor = Math.max(cursor, anchor.pos.x + sizeOf(anchor).w + clearance);
        continue;
      }
      const n = queue.splice(i, 1)[0];
      const driver = (execIn.get(n.id) || [])
        .filter(e => inRow.has(e.source.id) && done.has(e.source.id) && e.source !== n)
        .sort((a, b) => a.source.pos.x - b.source.pos.x)[0];
      const x = Math.max(cursor, driver.source.pos.x + sizeOf(driver.source).w + clearance);
      const y = n.pos.y + (pinY(driver.source, driver.out) - (n.pos.y + pinOffsetY(n, driver.input, pinY)));
      place(n, x, y, `exec ← ${driver.source.id}.${driver.out.name}`);
      execDriven.add(n.id);
      done.add(n.id);
      cursor = x + sizeOf(n).w + clearance;
    }
  }

  // ── 2. данные: совместить Y пинов и выдержать зазор по X, не накладывая ноды ──────
  // Двигаются только «чистые» ноды данных (геттеры, литералы, чистые функции): позиция
  // узла с exec-пинами принадлежит exec-цепочке (pass 1) или шаблону расстановщика
  // (событие-вершина, хендлер делегата «левее и ниже»), и ступень 3 её не трогает.
  const pureData = n => !(n.pins || []).some(p => p.category === 'exec');
  const rectOf = (x, y, w, h) => ({ x1: x, x2: x + w, y1: y, y2: y + h });
  const victim = (r, self) => (real.find(m => m !== self && hit(r, rect(m))) || {}).id || 'соседний узел';
  for (const { source: p, out, target: c, input } of dataLinks) {
    const { w, h } = sizeOf(p);
    const yAlign = pinY(c, input) - pinOffsetY(p, out, pinY);
    const xLeft = c.pos.x - clearance - w;
    const label = `данные → ${c.id}.${input.name}`;
    if (!pureData(p)) { notes.push(`${p.id}: узел с exec-пинами — ${label} не двигает ноду (ряд/шаблон важнее)`); continue; }
    if (c.pos.x <= p.pos.x + w) { notes.push(`${p.id}: ${label} идёт назад по X — зазор не применяется`); continue; }
    if (!blocked(rectOf(xLeft, yAlign, w, h), p)) place(p, xLeft, yAlign, label);
    else if (!blocked(rectOf(xLeft, p.pos.y, w, h), p)) {
      place(p, xLeft, p.pos.y, label);
      notes.push(`${p.id}: ${label} — Y-выравнивание наложило бы узел на ${victim(rectOf(xLeft, yAlign, w, h), p)}, выровнен только X`);
    }
    else if (!blocked(rectOf(p.pos.x, yAlign, w, h), p)) place(p, p.pos.x, yAlign, label);
    else notes.push(`${p.id}: ${label} не выравнивается — любое положение с зазором ${clearance}px занято`);
  }

  // ── 3. межуровневые щели не должны закрыться после сдвига нод ─────────────────────────
  for (let i = 1; i < rows.length; i++) {
    const prevBottom = Math.max(...rows[i - 1].nodes.map(n => n.pos.y + estNodeHeight(n)));
    const curTop = Math.min(...rows[i].nodes.map(n => n.pos.y));
    const need = prevBottom + minLevelGap - curTop;
    if (need <= 0) continue;
    for (let j = i; j < rows.length; j++) for (const n of rows[j].nodes) {
      n.pos.y += need;
      moved.push({ id: n.id, from: { x: n.pos.x, y: n.pos.y - need }, to: { x: n.pos.x, y: n.pos.y }, why: `ряд ${j}: щель с рядом ${j - 1}` });
    }
  }

  // ── 4. knot-переносы: X по пинам концов, Y — середина коридора между уровнями ──────────
  // Уровни — это ряды черновика (их состав задал генератор марками @row), но с ГРАНИЦАМИ
  // после выравнивания: corridor пересчитывается по фактическим низу/верху строк.
  const levels = rows.map(r => ({
    top: Math.min(...r.nodes.map(n => n.pos.y)),
    bottom: Math.max(...r.nodes.map(n => n.pos.y + estNodeHeight(n))),
    nodes: r.nodes,
  }));
  for (const l of links) {
    if (!l.via.length) continue;
    const y = Math.round(rerouteCorridorY(l.source, l.target, levels));
    const x1 = pinCenterX(l.source, l.out);
    const x2 = pinCenterX(l.target, l.input) - KNOT_W;
    l.via.forEach((k, i) => {
      const t = l.via.length === 1 ? 0 : i / (l.via.length - 1);
      const x = x1 + (x2 - x1) * t;
      const from = { x: k.pos.x, y: k.pos.y };
      k.pos.x = Math.round(x); k.pos.y = y;
      moved.push({ id: k.id, from, to: { ...k.pos }, why: `коридор ${l.source.id} → ${l.target.id}` });
    });
  }

  if (snap) for (const n of nodes) {
    n.pos.x = Math.round(n.pos.x / grid) * grid;
    n.pos.y = Math.round(n.pos.y / grid) * grid;
  }

  return { nodes, placed: real, knots: [], alignedKnots: knots, levels, rows, moved, notes, clearance, grid };
}

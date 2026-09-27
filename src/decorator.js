// Ступень 3: декоратор — визуальная доводка черновика, построенного ступенью 2.
//
// Правила ТЗ в формулировке пользователя (2026-09-27):
//   · «Y exec-нод одного ряда должен быть идентичным»  → ряд плоский, без лесенки;
//   · «если есть несколько exec-выходов (Branch, Sequence), следующие ноды образуют столбец
//      с числом рядов = числу exec-выходов»            → один X на всех детей, по ряду на выход;
//   · «Y должен совпадать только у knot-нод, которые используются для back-переноса»
//     → совмещаем Y средних knot'ов коридора, а не всех подряд;
//   · зазор по X между нодами ряда = 5 шагов сетки;
//   · перенос собирается из 4 knot'ов-стадиума (`transferRoute`), каждый участок которого
//     соосен пину, поэтому ошибка модели пинов не растягивается по всему переносу.
//
// Границы ответственности: ступень 3 меняет ТОЛЬКО координаты. Ни создания, ни удаления нод,
// ни правки пинов и `LinkedTo`, ни переноса нод между уровнями.
import { estNodeWidth, estNodeHeight, pinCenterY, KNOT_W, GRID } from './generator.js';
import { rerouteCorridorY, transferRoute } from './arranger.js';

export const isKnot = n => (n.className || '').includes('Knot');
export { KNOT_W };
export const isComment = n => (n.className || '').includes('Comment') || !!(n && n.isComment);
const dirOf = p => String((p && p.direction) || '').toLowerCase();
const isOut = p => dirOf(p) === 'output';
const isIn = p => dirOf(p) === 'input';

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
 * Декоратор мыслит связями «нода → нода», поэтому knot'ы для него — способ прокладки.
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
          // через knot проходим напролёт: вошли во вход — выходим из выхода
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

/** Строки черновика: ноды с одинаковым (привязанным к сетке) NodePosY — один уровень. */
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
 * Уровни по перекрытию вертикальных полос: после выравнивания ряд плоский, но под-ряды
 * форка лежат на 32px ниже и всё ещё относятся к тому же уровню.
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
 * Доводка черновика. Опции:
 *  · `clearance`   — зазор по X между нодами ряда, по ТЗ 5 шагов сетки (80 при grid 16);
 *  · `grid`        — клетка редактора;
 *  · `pinY`        — модель Y-центра пина (калибруется замерами из UE);
 *  · `minLevelGap` — минимальная щель между уровнями; если выравнивание её съело, ряд
 *                    (и всё под ним) сдвигается вниз — состав уровней не меняется;
 *  · `snap`        — привязать к сетке (по выкл: округление разбирает соосность пинов).
 * Возвращает `{ nodes, levels, rows, moved, notes, knots: [] }`; `knots` пуст —
 * переносы создаёт ступень 2, здесь они только ставятся по пинам.
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
  const sizeOf = n => ({ w: estNodeWidth(n), h: estNodeHeight(n) });
  const place = (n, x, y, why) => {
    x = Math.round(x); y = Math.round(y);
    if (n.pos.x === x && n.pos.y === y) return false;
    const from = { x: n.pos.x, y: n.pos.y };
    n.pos.x = x; n.pos.y = y;
    moved.push({ id: n.id, from, to: { x, y }, why });
    return true;
  };

  const execInRow = new Map();   // ребёнок → связи exec из его же ряда
  const execOutRow = new Map();  // родитель → связи exec в тот же ряд
  const execOutAny = new Map();  // родитель → ВСЕ использованные exec-выходы (дети и в других рядах)
  for (const l of links) {
    if (!l.exec || l.source === l.target) continue;
    const same = rowOf.get(l.source.id) === rowOf.get(l.target.id);
    if (!execOutAny.has(l.source.id)) execOutAny.set(l.source.id, []);
    execOutAny.get(l.source.id).push(l);
    if (!same) continue;
    if (!execInRow.has(l.target.id)) execInRow.set(l.target.id, []);
    execInRow.get(l.target.id).push(l);
    if (!execOutRow.has(l.source.id)) execOutRow.set(l.source.id, []);
    execOutRow.get(l.source.id).push(l);
  }

  // ── 1. плоские ряды и столбцы детей форка ────────────────────────────────
  // Цепочка idёт по exec-связям: следующий узел = правый край водителя + зазор, Y — Y ряда.
  // Если у ноды несколько использованных exec-выходов, дети встают СТОЛБЦОМ: общий X
  // (правый край родителя + зазор), ряд 0 — Y родителя, каждый следующий — под-ряд, Y
  // которого совмещён с пином-выходом родителя.
  const placedInRow = new Map(rows.map((_, i) => [i, new Set()])); // rowId → Set(nodeId)
  for (const [rowId, row] of rows.entries()) {
    const done = placedInRow.get(rowId);
    const entries = row.nodes
      .filter(n => !(execInRow.get(n.id) || []).length)
      .sort((a, b) => a.pos.x - b.pos.x);
    for (const entry of entries) {
      if (done.has(entry.id)) continue;
      walk(entry, entry.pos.x, entry.pos.y, rowId, done);
    }
  }
  function walk(n, x, y, rowId, done) {
    if (!done.has(n.id)) place(n, x, y, `плоский ряд Y=${y}`);
    done.add(n.id);
    const kidsAll = execOutAny.get(n.id) || [];
    if (!kidsAll.length) return;
    // порядок детей = порядок exec-выходов родителя (then, then_1, … / then, else)
    const outs = (n.pins || []).filter(p => p.category === 'exec' && isOut(p) && kidsAll.some(k => k.out === p));
    const fork = outs.length > 1; // «несколько exec-выходов» → дети образуют столбец
    // Щель под стадиум: цепочка из 4 knot'ов, идущая ВПЕРЁД, занимает между нодами
    // 4 * KNOT_W (64px) — иначе K2 и K3 встают квадрат в квадрат. Меньше нужного не делаем,
    // больше — по усмотрению (у нас clearance = 5 клеток = 80px).
    const gapFor = k => (k.via || []).length >= 3 && pinCenterX(k.target, k.input) > pinCenterX(k.source, k.out)
      ? 4 * KNOT_W : 0;
    const gap = Math.max(clearance, ...outs.flatMap(o => kidsAll.filter(k => k.out === o)).map(gapFor));
    const colX = x + sizeOf(n).w + gap;
    let cursor = colX;
    for (const p of outs) {
      const group = kidsAll.filter(k => k.out === p && !done.has(k.target.id));
      for (const k of group) {
        const sameRow = rowOf.get(k.target.id) === rowId;
        if (!sameRow) {
          if (!fork) continue; // линейный перенос: приёмник остаётся в позиции расстановщика
          const childDone = placedInRow.get(rowOf.get(k.target.id));
          if (!childDone || childDone.has(k.target.id)) continue;
          // ребёнок форка уехал в другой уровень: столбец по X сохраняем, Y его уровня не трогаем
          walk(k.target, colX, k.target.pos.y, rowOf.get(k.target.id), childDone);
          notes.push(`${k.target.id}: в столбце выхода ${n.id}.${p.name} (X=${Math.round(colX)}), Y его уровня ${k.target.pos.y} сохранён`);
          continue;
        }
        // сосед по ряду: тот же Y (ряд плоский), X — следующий слот ряда. Столбец «друг под
        // другом» для детей одного ряда физически невозможен, если высота ноды больше шага
        // пинов (32px) — дети бы легли друг на друга, поэтому ряд остаётся лентой.
        walk(k.target, cursor, y, rowId, done);
        cursor += sizeOf(k.target).w + gap;
      }
    }
  }

  // ── 2. данные: рядом — пин в пин, из другого ряда — вход точно под пином ──
  // Двигаются только «чистые» ноды данных (без exec-пинов): позиция узла с exec-пинами
  // принадлежит ряду (pass 1) или шаблону расстановщика.
  const pureData = n => !(n.pins || []).some(p => p.category === 'exec');
  const rectOf = (x, y, w, h) => ({ x1: x, x2: x + w, y1: y, y2: y + h });
  const victim = (r, self) => (real.find(m => m !== self && hit(r, rect(m))) || {}).id || 'соседний узел';
  for (const { source: p, out, target: c, input } of links) {
    if (p === c || out.category === 'exec') continue; // exec-связи уже разложил pass 1
    const { w, h } = sizeOf(p);
    const sameRow = rowOf.get(p.id) === rowOf.get(c.id);
    const yAlign = pinY(c, input) - pinOffsetY(p, out, pinY);
    const xPins = c.pos.x - w;          // правый край продюсера = X пина-входа: провод вертикальный
    const xGap = c.pos.x - clearance - w;
    const label = `данные → ${c.id}.${input.name}`;
    if (!pureData(p)) { notes.push(`${p.id}: узел с exec-пинами — ${label} не двигает ноду (ряд/шаблон важнее)`); continue; }
    if (sameRow && !blocked(rectOf(xGap, yAlign, w, h), p)) place(p, xGap, yAlign, label);
    else if (sameRow && !blocked(rectOf(p.pos.x, yAlign, w, h), p)) place(p, p.pos.x, yAlign, label);
    else if (!blocked(rectOf(xPins, p.pos.y, w, h), p)) {
      place(p, xPins, p.pos.y, label);
      const dy = Math.round(yAlign - p.pos.y);
      notes.push(`${p.id}: ${label} — пин входа на ${Math.abs(dy)}px ${dy < 0 ? 'выше' : 'ниже'} ряда ноды данных, поэтому нода поставлена строго под пин (провод вертикальный)`);
    }
    else if (!blocked(rectOf(xPins, yAlign, w, h), p)) place(p, xPins, yAlign, label);
    else notes.push(`${p.id}: ${label} не выравнивается — любое положение занято (${victim(rectOf(xPins, yAlign, w, h), p)})`);
  }

  // ── 3. уровни не должны наехать друг на друга после выравнивания ──────────
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

  // ── 4. переносы: стадиум из 4 knot'ов по пинам концов ─────────────────────
  // Уровни — ряды черновика, но с границами ПОСЛЕ выравнивания: коридор считается по факту.
  const levels = rows.map(r => ({
    top: Math.min(...r.nodes.map(n => n.pos.y)),
    bottom: Math.max(...r.nodes.map(n => n.pos.y + estNodeHeight(n))),
    nodes: r.nodes,
  }));
  for (const l of links) {
    if (!l.via.length) continue;
    if (l.via.length === 2) {
      // совместимость: старая пара — оба knot'а на коридорном Y, X по пинам концов
      const y = Math.round(rerouteCorridorY(l.source, l.target, levels)) - KNOT_W / 2;
      const x1 = pinCenterX(l.source, l.out);
      const x2 = pinCenterX(l.target, l.input) - KNOT_W;
      l.via.forEach((k, i) => {
        const from = { x: k.pos.x, y: k.pos.y };
        k.pos.x = Math.round(i ? x2 : x1); k.pos.y = y;
        moved.push({ id: k.id, from, to: { ...k.pos }, why: `коридор ${l.source.id} → ${l.target.id}` });
      });
      continue;
    }
    const route = transferRoute(l.source, l.out, l.target, l.input, { levels });
    if (route.length !== l.via.length) {
      // число knot'ов не совпало с маршрутом: раскладываем их по маршруту пропорционально
      notes.push(`${l.source.id} → ${l.target.id}: knot'ов ${l.via.length}, точек маршрута ${route.length} — расставлены пропорционально`);
      l.via.forEach((k, i) => {
        const t = l.via.length === 1 ? 0 : i / (l.via.length - 1);
        const a = route[Math.floor(t * (route.length - 1))], b = route[Math.ceil(t * (route.length - 1))];
        const f = route.length === 1 ? 0 : (t * (route.length - 1)) % 1;
        k.pos.x = Math.round(a.x + (b.x - a.x) * f);
        k.pos.y = Math.round(a.y + (b.y - a.y) * f);
      });
      continue;
    }
    l.via.forEach((k, i) => {
      const from = { x: k.pos.x, y: k.pos.y };
      k.pos.x = Math.round(route[i].x); k.pos.y = Math.round(route[i].y);
      moved.push({ id: k.id, from, to: { ...k.pos }, why: `стадиум ${l.source.id}.${l.out.name} → ${l.target.id}.${l.input.name}` });
    });
  }

  if (snap) for (const n of nodes) {
    n.pos.x = Math.round(n.pos.x / grid) * grid;
    n.pos.y = Math.round(n.pos.y / grid) * grid;
  }

  return { nodes, placed: real, knots: [], alignedKnots: knots, levels, rows, moved, notes, clearance, grid };
}

// Stage 2: coarse graph arrangement. This module changes node positions and
// creates topology-driven reroute knots through the creator API.
import { estNodeWidth, estNodeHeight, pinCenterY, KNOT_W, GRID } from './generator.js';
import { createKnot } from './creator.js';

const isKnot = n => (n.className || '').includes('Knot');

/**
 * Ступень 2 материализует соединения, заложенные ступенью 1: генератор пишет только код
 * нод (ни одного LinkedTo), а расстановщик записывает взаимные ссылки пинов — перед тем
 * как считать геометрию и решать, куда вставлять knot-переносы.
 * Конец связи ищется по PinId (как его заложила ступень 1), иначе — по имени пина.
 */
export function applyConnections(nodes, connections) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const applied = [];
  for (const c of connections) {
    const A = byId.get(c.from.node), B = byId.get(c.to.node);
    if (!A || !B) throw new Error(`connection ${c.spec || ''}: нет ноды ${A ? c.to.node : c.from.node} в тексте — соединения нужно заявлять по узлам этой вставки`);
    const out = A.pins.find(p => p.id === c.from.pinId) || A.pins.find(p => p.name === c.from.pin && p.direction === 'Output');
    const input = B.pins.find(p => p.id === c.to.pinId) || B.pins.find(p => p.name === c.to.pin && p.direction === 'Input');
    if (!out || !input) throw new Error(`connection ${c.spec || ''}: нет пина ${A.id}.${c.from.pin} / ${B.id}.${c.to.pin} — ступень 1 обязана была его создать`);
    if (out.linkedTo.some(l => l.pinId === input.id)) continue; // уже проведено (повторный проход по тому же тексту)
    out.linkedTo.push({ nodeName: B.id, pinId: input.id });
    input.linkedTo.push({ nodeName: A.id, pinId: out.id });
    applied.push({ source: A, out, target: B, input });
  }
  return applied;
}

/**
 * Коридор knot-переноса — щель МЕЖДУ уровнями, а не под целевым рядом (вердикт пользователя:
 * knot'ы вставали «под 2» вместо «между 1 и 2»). Считается по уровням расстановки: для спуска
 * вниз — между самым низким низом уровней от источника до предшествующего цели и верхом цели;
 * для подъёма вверх — зеркально. Если уровни неизвестны (вне arrangeRows) — старое поведение.
 */
export function rerouteCorridorY(source, target, levels) {
  const index = new Map();
  levels.forEach((l, i) => l.nodes.forEach(n => index.set(n.id, i)));
  const si = index.get(source.id), ti = index.get(target.id);
  const srcBottom = source.pos.y + estNodeHeight(source);
  const tgtBottom = target.pos.y + estNodeHeight(target);
  if (si !== undefined && ti !== undefined && si !== ti) {
    if (ti > si) {
      const bottom = Math.max(srcBottom, ...levels.slice(si, ti).map(l => l.bottom));
      return (bottom + levels[ti].top) / 2;
    }
    const top = Math.min(target.pos.y, ...levels.slice(ti + 1, si + 1).map(l => l.top));
    return (tgtBottom + top) / 2;
  }
  return Math.max(srcBottom, tgtBottom) + 64;
}

/**
 * Маршрут переноса — СТАДИУМ ИЗ 4 knot'ов (вердикт пользователя: «чтобы полностью
 * исключить любые дефекты, перенос выполняется другой механикой»). Каждый участок провода
 * соосен по X или по Y, поэтому ошибка модели пинов остаётся внутри короткого отрезка
 * «пин → knot», а не растягивается на весь перенос:
 *
 *   выход A ──X── K1 ──Y── K2 ──X── K3 ──Y── K4 ──X── вход B
 *
 *   K1 = (X пина-выхода A, Y пина-выхода A)            — сидит на пине, провод нулевой;
 *   K2 = (X пина-выхода A + ширина knot'а, Y коридора) — вертикаль вниз от K1;
 *   K3 = (X пина-входа B − 2·ширины knot'а, Y коридора) — горизонталь по коридору (Y общий);
 *   K4 = (X пина-входа B − ширина knot'а, Y пина-входа B) — вертикаль к пину B.
 *
 * Общий Y обязателен именно для обратного (back) переноса — только тогда средний участок
 * лежит строго поперёк уровней и никого не пересекает.
 */
/**
 * Y горизонтали переноса. Для связи между уровнями — середина щели между ними
 * (`rerouteCorridorY`), для связи внутри одного уровня — строка пина-выхода: тогда
 * выход, K1, K2, K3 лежат на одной линии, а излом ΔY происходит в последних 16px
 * перед целью (K3 → K4). Так провод остаётся ортогональным и при неточной ширине ноды.
 */
export function execCorridorY(source, out, target, input, levels = [], pinY = pinCenterY) {
  const index = new Map();
  levels.forEach((l, i) => l.nodes.forEach(n => index.set(n.id, i)));
  const si = index.get(source?.id), ti = index.get(target?.id);
  if (si !== undefined && si === ti) return Math.round(pinY(source, out));
  return Math.round(rerouteCorridorY(source, target, levels) / GRID) * GRID;
}

export function transferRoute(source, out, target, input, { levels = [], corridorY = null, pinY = pinCenterY } = {}) {
  const srcX = source.pos.x + estNodeWidth(source); // X пина-выхода
  const tgtX = target.pos.x;                        // X пина-входа
  // центр knot'а на 8px ниже его NodePosY — чтобы пин knot'а встал ровно на Y пина ноды
  const srcY = pinY(source, out) - KNOT_W / 2;
  const tgtY = pinY(target, input) - KNOT_W / 2;
  const yCorr = (corridorY !== null && corridorY !== undefined
    ? corridorY
    : execCorridorY(source, out, target, input, levels, pinY)) - KNOT_W / 2;
  return [
    { x: srcX, y: srcY, role: 'out' },
    { x: srcX + KNOT_W, y: yCorr, role: 'corridor-a' },
    { x: tgtX - 2 * KNOT_W, y: yCorr, role: 'corridor-b' },
    { x: tgtX - KNOT_W, y: tgtY, role: 'in' },
  ];
}

/** Create reroutes for exec edges which must travel backward or change rows. */
function createExecReroutes(nodes, { levels = [] } = {}) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const jobs = [];
  for (const source of nodes) {
    if (isKnot(source)) continue;
    for (const out of source.pins || []) {
      if (out.direction !== 'Output' || out.category !== 'exec') continue;
      for (const l of out.linkedTo || []) {
        const target = byId.get(l.nodeName);
        const input = target?.pins.find(p => p.id === l.pinId);
        if (!target || isKnot(target) || input?.category !== 'exec' || input.direction !== 'Input') continue;
        // Стадиум кладём на каждый провод, где пины не соосны или цель левее источника:
        // тогда излом ΔY происходит на knot'ах, а не наискосок через ряд.
        const coAxis = pinCenterY(source, out) === pinCenterY(target, input);
        const toTheRight = target.pos.x >= source.pos.x + estNodeWidth(source);
        if (!(coAxis && toTheRight)) jobs.push([source, out, target, input]);
      }
    }
  }

  const knots = [];
  for (const [source,out,target,input] of jobs) {
    out.linkedTo = out.linkedTo.filter(l => l.pinId !== input.id);
    input.linkedTo = input.linkedTo.filter(l => l.pinId !== out.id);
    const points = transferRoute(source, out, target, input, { levels });
    let previousNode = source, previousPin = out;
    for (const { x, y } of points) {
      const knot = createKnot({ x, y }, 'exec');
      const [inputPin, outputPin] = knot.pins;
      previousPin.linkedTo.push({ nodeName: knot.id, pinId: inputPin.id });
      inputPin.linkedTo.push({ nodeName: previousNode.id, pinId: previousPin.id });
      knots.push(knot);
      previousNode = knot; previousPin = outputPin;
    }
    previousPin.linkedTo.push({ nodeName: target.id, pinId: input.id });
    input.linkedTo.push({ nodeName: previousNode.id, pinId: previousPin.id });
  }
  return knots;
}

/**
 * Lay out explicit left-to-right rows. Each later row starts below the prior
 * row's estimated bottom. `gap` is free horizontal space after estimated width.
 * Returns positioned graph nodes, plus any reroute knots created at this stage.
 */
export function arrangeRows(rows, { x = 0, y = 0, gap = 160, rowGap = 160, createRerouteKnots = true, continueX = false } = {}) {
  let rowY = y;
  let nextRowX = x;
  const placed = [];
  const levels = [];
  for (const row of rows) {
    let cursorX = continueX ? nextRowX : x;
    let rowBottom = rowY;
    for (const node of row) {
      node.pos ||= { x: 0, y: 0 };
      node.pos.x = cursorX;
      node.pos.y = rowY;
      cursorX += estNodeWidth(node) + gap;
      rowBottom = Math.max(rowBottom, rowY + estNodeHeight(node));
      placed.push(node);
    }
    if (continueX) nextRowX = cursorX;
    levels.push({ top: rowY, bottom: rowBottom, nodes: row.slice() });
    rowY = rowBottom + rowGap;
  }
  const knots = createRerouteKnots ? createExecReroutes(placed, { levels }) : [];
  return { nodes: [...placed, ...knots], placed, knots, levels, bottom: rowY };
}

/** Extract a deterministic topological ordering from graph links. Exec edges are
 * prioritized; cyclic/data-feedback leftovers retain input order. */
export function topologicalNodes(nodes) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const incoming = new Map(nodes.map(n => [n.id, 0]));
  const edges = new Map(nodes.map(n => [n.id, []]));
  for (const n of nodes) for (const p of n.pins || []) {
    if (p.direction !== 'Output') continue;
    for (const link of p.linkedTo || []) {
      const target = byId.get(link.nodeName);
      if (!target || target === n) continue;
      if (!edges.get(n.id).some(e => e.id === target.id)) {
        edges.get(n.id).push({ id: target.id, exec: p.category === 'exec' });
        incoming.set(target.id, incoming.get(target.id) + 1);
      }
    }
  }
  const rank = new Map(nodes.map((n, i) => [n.id, i]));
  const ready = nodes.filter(n => incoming.get(n.id) === 0);
  const result = [];
  while (ready.length) {
    ready.sort((a,b) => rank.get(a.id)-rank.get(b.id));
    const n = ready.shift(); result.push(n);
    const outs = edges.get(n.id).slice().sort((a,b) => Number(b.exec)-Number(a.exec));
    for (const e of outs) {
      incoming.set(e.id, incoming.get(e.id)-1);
      if (incoming.get(e.id) === 0) ready.push(byId.get(e.id));
    }
  }
  for (const n of nodes) if (!result.includes(n)) result.push(n);
  return result;
}

/** Arrange a simple linked flow as one row; explicit rows are preferred for branches. */
export function arrangeFlow(nodes, options = {}) {
  const ordered = options.order ? options.order.map(x => typeof x === 'string' ? nodes.find(n => n.id === x) : x).filter(Boolean) : topologicalNodes(nodes);
  return arrangeRows([ordered], options);
}

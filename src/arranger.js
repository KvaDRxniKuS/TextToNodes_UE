// Stage 2: coarse graph arrangement. This module changes node positions and
// creates topology-driven reroute knots through the creator API.
import { estNodeWidth, estNodeHeight, pinCenterY, KNOT_SIDE_OFFSET, GRID } from './generator.js';
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
        if (target.pos.x <= source.pos.x || target.pos.y !== source.pos.y) jobs.push([source,out,target,input]);
      }
    }
  }

  const knots = [];
  for (const [source,out,target,input] of jobs) {
    out.linkedTo = out.linkedTo.filter(l => l.pinId !== input.id);
    input.linkedTo = input.linkedTo.filter(l => l.pinId !== out.id);
    const sourceCenterY = pinCenterY(source,out);
    const targetCenterY = pinCenterY(target,input);
    const backward = target.pos.x <= source.pos.x;
    // X knot'ов — от правого края источника и левого края цели (по пинам их выровняет
    // ступень 3), Y — общий: середина междурядного коридора, чтобы горизонтальный участок
    // провода не резал ни верхний, ни нижний уровень.
    const corridorY = Math.round(rerouteCorridorY(source, target, levels) / GRID) * GRID;
    // узел корреидора привязан к сетке: черновик обязан быть «сеточным», иначе ступень 3
    // при выравнивании пинов сдвигает knot'ы на произвольные пиксели
    const points = backward
      ? [[source.pos.x + estNodeWidth(source) + KNOT_SIDE_OFFSET, corridorY],
         [target.pos.x - KNOT_SIDE_OFFSET, corridorY]]
      : [[(source.pos.x + estNodeWidth(source) + target.pos.x) / 2, sourceCenterY - 8],
         [(source.pos.x + estNodeWidth(source) + target.pos.x) / 2, targetCenterY - 8]];
    let previousNode = source, previousPin = out;
    for (const [x,y] of points) {
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

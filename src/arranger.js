// Stage 2: coarse graph arrangement. This module changes node positions and
// creates topology-driven reroute knots through the creator API.
import { estNodeWidth, estNodeHeight, pinCenterY } from './generator.js';
import { createKnot } from './creator.js';

const isKnot = n => (n.className || '').includes('Knot');

/** Create reroutes for exec edges which must travel backward or change rows. */
function createExecReroutes(nodes) {
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
    const points = backward
      ? [[source.pos.x + estNodeWidth(source) + 32, Math.max(source.pos.y + estNodeHeight(source), target.pos.y + estNodeHeight(target)) + 64],
         [target.pos.x - 32, Math.max(source.pos.y + estNodeHeight(source), target.pos.y + estNodeHeight(target)) + 64]]
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
    rowY = rowBottom + rowGap;
  }
  const knots = createRerouteKnots ? createExecReroutes(placed) : [];
  return { nodes: [...placed, ...knots], placed, knots, bottom: rowY };
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

// Stage 2: coarse graph arrangement. This module changes only node positions.
// It does not create nodes, pins, or links.
import { estNodeWidth, estNodeHeight, createKnot } from './generator.js';

/**
 * Lay out explicit left-to-right rows. Pass node objects grouped by visual rows;
 * every row is placed left-to-right with non-overlapping estimated node bounds.
 * Rows advance downward. `gap` is free space AFTER a node's estimated right edge.
 */
function createBackwardExecKnots(nodes) {
  const byId = new Map(nodes.map(n => [n.id,n]));
  const jobs = [];
  for (const source of nodes) for (const out of source.pins || []) {
    if (out.direction !== 'Output' || out.category !== 'exec') continue;
    for (const l of out.linkedTo || []) {
      const target = byId.get(l.nodeName), input = target?.pins.find(p => p.id === l.pinId);
      if (target && input?.category === 'exec' && input.direction === 'Input' && target.pos.x <= source.pos.x) jobs.push([source,out,target,input]);
    }
  }
  const knots=[];
  for (const [source,out,target,input] of jobs) {
    out.linkedTo=out.linkedTo.filter(l=>l.pinId!==input.id);
    input.linkedTo=input.linkedTo.filter(l=>l.pinId!==out.id);
    const y=Math.max(source.pos.y+estNodeHeight(source),target.pos.y+estNodeHeight(target))+64;
    const points=[[source.pos.x+estNodeWidth(source)+32,y],[target.pos.x-32,y]];
    let prevNode=source,prevPin=out;
    for(const [x,y] of points){
      const knot=createKnot({x,y},'exec'),[ki,ko]=knot.pins;
      prevPin.linkedTo.push({nodeName:knot.id,pinId:ki.id});ki.linkedTo.push({nodeName:prevNode.id,pinId:prevPin.id});
      knots.push(knot);prevNode=knot;prevPin=ko;
    }
    prevPin.linkedTo.push({nodeName:target.id,pinId:input.id});input.linkedTo.push({nodeName:prevNode.id,pinId:prevPin.id});
  }
  return knots;
}

export function arrangeRows(rows, { x = 0, y = 0, gap = 160, rowGap = 160, createRerouteKnots = true } = {}) {
  let rowY = y;
  const placed = [];
  for (const row of rows) {
    let cursorX = x;
    let rowBottom = rowY;
    for (const node of row) {
      node.pos ||= { x: 0, y: 0 };
      node.pos.x = cursorX;
      node.pos.y = rowY;
      cursorX += estNodeWidth(node) + gap;
      rowBottom = Math.max(rowBottom, rowY + estNodeHeight(node));
      placed.push(node);
    }
    rowY = rowBottom + rowGap;
  }
  const knots = createRerouteKnots ? createBackwardExecKnots(placed) : [];
  return { nodes: [...placed, ...knots], placed, knots, bottom: rowY };
}

/** Extract a deterministic topological ordering from graph links. Exec edges are
 * prioritized; non-exec links break ties. Cyclic/data-feedback leftovers retain input order. */
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

/** Arrange a simple linked flow as one row; explicit ordered list is preferred
 * for graphs with branches or disconnected utility nodes. */
export function arrangeFlow(nodes, options = {}) {
  const ordered = options.order ? options.order.map(x => typeof x === 'string' ? nodes.find(n => n.id === x) : x).filter(Boolean) : topologicalNodes(nodes);
  return arrangeRows([ordered], options);
}

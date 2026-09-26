// Stage 3: pin-aware refinement of an already arranged graph.
// No semantic node/pin creation happens here; this stage only corrects
// positions, including reroute knots already emitted by the arranger.
import { estNodeWidth, pinCenterY } from './generator.js';

const isKnot = n => (n.className || '').includes('Knot');

/** Return each output->input connection exactly once, including pin identities. */
function graphLinks(nodes) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const links = [];
  for (const source of nodes) for (const out of source.pins || []) {
    if (out.direction !== 'Output') continue;
    for (const link of out.linkedTo || []) {
      const target = byId.get(link.nodeName);
      const input = target?.pins.find(p => p.id === link.pinId);
      if (target && input?.direction === 'Input') links.push({ source, out, target, input });
    }
  }
  return links;
}

/**
 * Refine an arrangement against actual modeled pin rows.
 * - Every forward link has a positive horizontal cable corridor: the target's
 *   left edge is at least `clearance` right of the source's estimated right edge.
 * - Exec pins are aligned first; remaining data links align a target only when
 *   they do not fight an already-selected exec anchor.
 * - Finally snap positions to the UE 16px grid and refine existing reroute knots.
 * Knot creation belongs to Stage 2 (arranger). Pin centers are estimated from
 * the node model; callers can provide `pinY(node,pin)` using engine measurements.
 */
export function decorateLayout(nodes, {
  clearance = 160,
  grid = 16,
  pinY = pinCenterY,
} = {}) {
  const links = graphLinks(nodes);
  // Preserve Stage-2's explicit row/column order. Topological sorting alone is
  // not enough: a data-only handler can feed two later exec nodes without being
  // part of the exec sequence.
  const order = nodes.slice().sort((a,b) => a.pos.y-b.pos.y || a.pos.x-b.pos.x);
  const rank = new Map(order.map((n, i) => [n.id, i]));
  const sorted = links.slice().sort((a, b) =>
    Number(b.out.category === 'exec') - Number(a.out.category === 'exec') ||
    rank.get(a.source.id) - rank.get(b.source.id));
  const anchored = new Set();

  // Establish a stable left-to-right constraint for every forward edge. Do not
  // pull feedback edges across the graph: those are left for knot routing.
  for (const { source, target, out, input } of sorted) {
    if (rank.get(source.id) < rank.get(target.id)) {
      target.pos.x = Math.max(target.pos.x, source.pos.x + estNodeWidth(source) + clearance);
    }
    if (out.category === 'exec' && !anchored.has(target.id)) {
      target.pos.y += pinY(source, out) - pinY(target, input);
      anchored.add(target.id);
    }
  }
  for (const { source, target, out, input } of sorted) {
    if (out.category === 'exec' || anchored.has(target.id)) continue;
    target.pos.y += pinY(source, out) - pinY(target, input);
    anchored.add(target.id);
  }

  // Arranger already created reroute nodes; decorator only moves those records.
  for (const n of nodes) {
    n.pos.x = Math.round(n.pos.x / grid) * grid;
    n.pos.y = Math.round(n.pos.y / grid) * grid;
  }
  return { nodes, knots: [] };
}

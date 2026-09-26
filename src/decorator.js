// Stage 3: pin-aware refinement of an already arranged graph.
// No semantic node/pin creation happens here; only positional corrections and
// optional structural exec reroutes via the existing Knot factory.
import { estNodeWidth, pinCenterY, decorateExec, snapToGrid } from './generator.js';

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
 * - Finally snap positions to the UE 16px grid and optionally add exec reroute knots.
 * Pin centers are estimated from the node model (header + visible pin rows); a
 * caller can supply `pinY(node,pin)` for engine-measured pin-center calibration.
 */
export function decorateLayout(nodes, {
  clearance = 160,
  grid = 16,
  addExecKnots = true,
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

  // Grid snap is applied before knot generation so knots are created on-grid.
  for (const n of nodes) {
    n.pos.x = Math.round(n.pos.x / grid) * grid;
    n.pos.y = Math.round(n.pos.y / grid) * grid;
  }
  if (!addExecKnots) return { nodes, knots: [] };
  const knots = decorateExec(nodes, { pad: clearance });
  return { nodes, knots };
}

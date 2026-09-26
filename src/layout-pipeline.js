// Explicit three-stage API: creator -> arranger -> decorator.
// Stage 1 public facade: src/creator.js (backed by src/generator.js and src/modules.js)
// creates nodes/pins and records links without layout decisions.
import { arrangeFlow, arrangeRows } from './arranger.js';
import { decorateLayout } from './decorator.js';

export { arrangeFlow, arrangeRows, decorateLayout };

/** Run Stage 2 then Stage 3 on already-created and linked nodes. */
export function positionBlueprint(nodes, { rows, arrange = {}, decorate = {} } = {}) {
  const arrangement = rows ? arrangeRows(rows, arrange) : arrangeFlow(nodes, arrange);
  const result = decorateLayout(arrangement.nodes, decorate);
  const allKnots = [...arrangement.knots, ...result.knots];
  return { nodes: [...arrangement.nodes, ...result.knots], knots: allKnots, arrangement };
}

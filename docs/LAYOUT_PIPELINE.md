# Blueprint construction pipeline

Blueprint generation is split into three explicit stages. Coordinates are not part of Stage 1 semantics.

## 1. Creator — `src/creator.js`

Create existing UE node types, pins, defaults and reciprocal links. `linkPins()` only records endpoints; it must not move either node. Node factories keep their current optional initial position argument for compatibility, but callers should treat it as a placeholder until Stage 2.

## 2. Arranger — `src/arranger.js`

`arrangeRows(rows, { x, y, gap, rowGap })` places explicit rows. Nodes proceed left-to-right by estimated node width plus a clear gap; each later row goes below the previous one. `arrangeFlow()` can derive a basic order from links, but callers should pass explicit rows for branches, data-only helpers, and layouts where exec order is authoritative.

This stage owns coarse sequence/topology, row wrapping and creation of two exec reroute knots for any exec edge that would point backward or horizontally into the source node. Its result returns both `placed` nodes and generated `knots` (or all of them in `nodes`). It does not attempt pixel-perfect pin alignment.

## 3. Decorator — `src/decorator.js`

`decorateLayout(nodes, options)` refines already-arranged positions from connected pin identities: exec edges are anchors first, then non-exec edges where they do not conflict with an exec anchor. It enforces a horizontal cable corridor for forward links, snaps positions to the UE 16px grid, and can add exec reroute knots. `pinY(node, pin)` can be supplied by an engine-calibrated pin-center model; the default uses the repository's current modeled header/pin-row geometry.

## Orchestration

`src/layout-pipeline.js` exports both stages and `positionBlueprint()` for the standard arrange-then-decorate path. Creation and linking happen before calling it. The former layout helpers in `generator.js` remain as compatibility APIs for existing scripts; new generators should use the three stage modules above. UE copy-back remains the authority for actual Slate geometry; estimated widths/pin centers require visual verification in the editor.

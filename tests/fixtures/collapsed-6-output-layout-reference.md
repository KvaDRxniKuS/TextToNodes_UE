# K2Node_Composite pin geometry reference (user copy-back, 2026-09-26)

The corrected reference has `K2Node_Composite_9000` at `NodePosX=-12160`, `NodePosY=-4624`. Outer side knots show the exact geometry:

- Port-level knot: `x=-12192` (32px left of node edge); opposite side: `x=-11872` (32px beyond the inferred right edge at -11904; composite width 256px).
- Between-port knot: `x=-12208` (another 16px outward on the input side); output-side analog is another 16px beyond the output port-knot column.
- First knot row `NodePosY=-4576` is 48px below the node origin; with the knot center at +8px, the first pin center is +56px. Later rows: -4544 and -4512, giving a 32px pin-row pitch.
- The corresponding six-output reference independently lists three exec outputs and three interface outputs at 32px increments, confirming category-independent row pitch.

This fixture note records measurements from the pasted live dump; it is not a substitute for the full composite serialization.

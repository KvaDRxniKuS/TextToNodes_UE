# 1×3 Composite right-side width calibration (user copy-back)

From the supplied live UE serialization:

- Composite `K2Node_Composite_9200`: `NodePosX=-11440`.
- User identifies `K2Node_Knot_17` at `NodePosX=-11232` as the correctly spaced right-side comparison: delta from node origin is 208px.
- With the established 32px port-Knot clearance, inferred right edge is `-11264`, hence Composite width is 176px: `208 - 32 = 176`.
- `K2Node_Knot_9402` at `NodePosX=-11152` is 80px farther right than the correctly spaced comparison; it is not the port-level calibration point and was the mistaken reference in the previous correction.

Therefore, right port column is `NodePosX+208`; the next recursive levels are `NodePosX+224` and `NodePosX+240`, each another 16px outward.

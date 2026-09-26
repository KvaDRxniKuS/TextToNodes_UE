# 1×3 Composite right-side width calibration (user copy-back)

From the supplied live UE serialization:

- Composite `K2Node_Composite_9200`: `NodePosX=-11440`.
- Right port-level Knot `K2Node_Knot_9402`: `NodePosX=-11152`.
- The port Knot is 32px beyond the Composite's right edge, so `width = (-11152) - (-11440) - 32 = 256px`.
- Another Knot, `K2Node_Knot_17`, is at `NodePosX=-11232`; its role is not established by these lines, so it is not used to infer node width.

This replaces the previous 240px estimate. Right port column is `NodePosX+288`; each recursive Knot level advances another 16px outward.

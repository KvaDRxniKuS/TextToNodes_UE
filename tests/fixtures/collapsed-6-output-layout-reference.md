# Collapsed Composite pin-pitch reference (UE copy-back, user-supplied 2026-09-26)

Derived from the supplied `K2Node_Composite_0` (`NodePosY=-2400`) and six outer Knot probes. This records the geometry evidence used for the generic pin-row step; the full user paste also contained the nested Tunnel graph and corresponding pins.

| Composite output | Type | Knot | Knot NodePosY | Relative to previous |
|---|---|---|---:|---:|
| `OutputPin` | exec | `Knot_37` | -2352 | — |
| `OutputPin2` | exec | `Knot_38` | -2320 | 32 px |
| `OutputPin3` | exec | `Knot_29` | -2288 | 32 px |
| `OutputPin4` | interface | `Knot_31` | -2256 | 32 px |
| `OutputPin5` | interface | `Knot_33` | -2224 | 32 px |
| `OutputPin6` | interface | `Knot_35` | -2192 | 32 px |

Conclusion: consecutive visible output pin levels use a 32 px vertical pitch across exec and interface types. The horizontal test stagger requested for the new probe is one 16 px grid unit. This is a derived measurement note, not a replacement for the original UE copy-back.

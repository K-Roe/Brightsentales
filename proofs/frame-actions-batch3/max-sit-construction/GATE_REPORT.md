# Max chair sitting: artwork construction gate

21 October 2026. **No Max chair animation has been delivered or approved. Batch 3 remains REJECTED.** This report records the source-art limitation required by Karl before attempting another pose workflow.

## What was attempted

1. Inspected approved Max (`434 × 724`), the existing head/arm cut-out and pivots, the rejected sit frames, the additive chair candidate and the shared Scene Maker renderer. [Pose registration specification](MAX_POSE_SPEC.md) records the measured source geometry.
2. Tested deterministic construction from the approved Max pixels: kept the approved face, hair, hoodie, hands, shorts and shoes; translated the upper body toward a seat landmark; drew bent leg connectors; composited with the provisional chair. [Five-position contact sheet](deterministic-contact.png) and [baking script](bake_pilot.py) are archived. It still reads as a standing figure lowered in front of a chair. The shoes conceal the new knee geometry, the shorts and chair cushion do not establish a supported hip, and the pose does not show the required change of weight. It **fails** Karl's explicit no-fake-sitting requirement.
3. Tried one additive image-generation inbetween based on approved Max and the prior seated candidate. [Result](generated-inbetween-rejected.png): it depicts a nearly seated pose despite a halfway request. It also redraws the face and upper body, so it cannot be inserted as a consistent intermediate frame. The prior independent generated [pose sequence](../repair-candidates/pilot-sequence.png) likewise changes proportions between frames. No generated candidate is production artwork.

## Exact limitation

The approved source provides no bent thighs, knees, underside of shorts, pelvis on a cushion, or obscured leg pixels. The existing cut-out separates head and arms only; it cannot articulate the lower body. Correct seating needs newly illustrated lower-body anatomy and several registered contact frames with a common head/torso design. The chair also needs separately authored rear/seat and foreground edges at that contact height. Pixel translation, automatic limb rotation, offsets and independent whole-frame generations tried here do not produce that information or consistent motion.

The next artwork method would have to be a **controlled additive redraw of the missing lower body and seat contact**, using approved Max's exact face and outfit elements as locked references, with a single registered pose sheet reviewed before app wiring. This is a new construction workflow, so I stopped before attempting it under Karl's source-art gate.

## Product state and verification boundary

- No `src/`, approved art, existing animation, Scene Maker control or saved-data format was changed. The proof script writes only inside this proof directory.
- There is no complete sitting video, Scene Maker playback test, save/reopen test or episode export for this attempt. A static contact sheet and image candidate are **not** visual acceptance.
- Maxine, sofa, toy actions and Batch 4 were not started.

The built-in image-generation tool produced the rejected inbetween. Prompt: edit approved Max into one complete transparent front-facing halfway-to-sitting frame with lowered pelvis, bent knees, feet on the floor, hands reaching toward chair arms, exact Max identity and outfit, no furniture or shadow; the approved sprite and prior seated candidate were references. It is archived solely to show the failure mode.

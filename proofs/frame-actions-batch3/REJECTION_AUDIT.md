# Batch 3 rejection audit — 21 October 2026

**Decision: REJECTED by Karl in entirety.** None of Sit down, Stand up, Pick up or Put down is approved for production. The 197 passing tests and build from the first implementation verified code paths, not believable cartoon motion. Batch 4 remains closed.

## Visual evidence inspected

These contact sheets sample the **complete exported videos**, rather than isolated successful frames:

| Sequence | Contact sheet | Original video | Failure visible in motion |
| --- | --- | --- | --- |
| Max chair | [contact sheet](rejection-audit/max-chair-contact.png) | [7 s video](videos/B3_Max_Chair.webm) | Upright character is in front of the chair; the seated pose appears suddenly without a visible shift of weight onto its seat. |
| Maxine chair | [contact sheet](rejection-audit/maxine-chair-contact.png) | [7 s video](videos/B3_Maxine_Chair.webm) | Same seat-contact and abrupt transition failure. This is a chair, not the requested sofa. |
| Max toy | [contact sheet](rejection-audit/max-toy-contact.png) | [9 s video](videos/B3_Max_Toy.webm) | Hand and ball alignment changes at pose boundaries; carry changes abruptly into side-walking art. |
| Maxine toy | [contact sheet](rejection-audit/maxine-toy-contact.png) | [9 s video](videos/B3_Maxine_Toy.webm) | Same hand-contact and orientation change failure. |
| Combined walk/wave/chair/toy | [contact sheet](rejection-audit/combined-contact.png) | [17 s video](videos/B3_Walk_Wave_Sit_Toy.webm) | Walk-to-chair ends without a convincing turn and sit; seated, standing and carrying states snap between front and side poses. |
| Maxine sofa | [failed frame](sofa-failure/sofa-seated.png) | [failed video](sofa-failure/B3_Maxine_Sofa.webm) | Sofa is painted into the background. A foreground strip hid her torso and disconnected her legs, so the attempted overlay was removed. |

## Source geometry and rendering diagnosis

Approved idle Max and Maxine are each **434 × 724** pixels. Their nontransparent bounds are `(47,19)–(426,699)` and `(31,33)–(428,706)`. Provisional Batch 3 frames are about **970 × 1620** pixels with substantially different internal padding. Examples: Max `sit-lowering` bounds `(66,121)–(935,1526)` and `sit-seated` `(35,67)–(940,1557)`; Maxine `sit-seated` `(40,51)–(955,1580)`. Yet `scenePreview.ts` draws all of them at 213 × 355 using the **approved idle** foot anchor. This changes visible scale and floor contact at frame boundaries.

`stateAt` chooses idle, lower and seated at fixed fractions of one action without anatomical inbetween frames or movement from the standing floor point to a chair seat contact point. The current seated art shows legs extending toward the viewer. Its pelvis is not registered to the chair cushion. The chair is one opaque image drawn entirely behind the Brightling, so neither front edge nor armrests can occlude the seated body. The render gives the appearance of a character in front of furniture. Moving the whole sprite with an arbitrary offset would trade this for hovering feet or a different mismatch.

The toy uses fixed offsets `(-72,-23)`, `(-55,-83)` and `(-58,-87)` from the character floor point in `objectAt`. They are not measured for each Max and Maxine pose and side-walk frame. The ball moves after a fixed time threshold even if the hand has not visually contacted it. Held balls render after all characters, so their depth cannot follow the gripping hand. Existing approved side-walk art has no carrying pose; the first side frame after the front carry frame therefore changes the whole silhouette abruptly.

The Living Room sofa is part of the approved flat background image. Its visible front, seat and back are not independent layers. Correct seated overlap cannot be obtained by replaying a strip of the background over the character. The approved room was left unchanged, and sofa seating remains unavailable.

## Repair approach before further implementation

1. Make a reviewed pose sheet for each character with **registered feet, pelvis and palm landmarks**. Keep the approved standing and walking art unchanged. New complete frames must preserve the same head/body scale, facial features, clothing, outline and transparent canvas alignment. Add enough transition poses for weight shift, seated contact, bend, lift and return. Do not interpolate anatomy by stretching a single sprite or revive the cut-out rig.
2. Build an additive layered chair asset with measured seat height, back and front edge. Draw back/seat, then the seated character at a calibrated pelvis contact point, then the front edge where it should hide the thighs. The seated art must show bent knees and feet reaching the floor from that seat. Validate Max and Maxine at more than one scene depth.
3. Add per-frame palm anchors to the existing scene evaluator/render path. Keep the toy on the floor until the reaching palm meets it; follow the palm through lift/carry/lower; release at the chosen floor point. Preserve the existing scene object and save format. A carrying side-walk requires matching whole-body walk frames before it can be called visually natural.
4. For the sofa, prepare a **separate, non-destructive layered scene asset** aligned to the existing room or a new approved room variant. The original Living Room pixels must remain untouched. Require visual inspection of the sofa back, cushion and front overlap with a seated Maxine before enabling this option.
5. Export and inspect full Max chair, Maxine sofa, both object interactions and the combined sequence from the same canvas renderer used for episodes. Check real frame contact, scale, turns and transition timing. Karl's explicit visual approval is the only acceptance gate.

**Current repair blocker:** the existing seated and carrying art does not depict the physical contacts needed for a credible result. Renderer registration alone cannot supply missing bent-leg, gripping and side-carry artwork. No corrected animation video exists yet; the linked videos above are evidence of the rejection, not acceptance.

## Review gate verification

The production build and **197/197 tests pass** after the Scene Maker review gate. A disposable headless Chrome session loaded an existing Batch 3 scene and confirmed that all four rejected action buttons and new toy creation are disabled, approved Wave, Clap, Point, Nod, Shake head, Jump and Excited bounce remain enabled, the saved scene is readable, its rejection warning is visible, and the renderer reports no console exception or error entry. [Browser screenshot](rejection-audit/browser-gate.png), [machine result](rejection-audit/browser-gate.json) and [repeatable check](rejection-audit/browser-gate-check.mjs). This verifies the gate only; it does not repair or approve the animation.

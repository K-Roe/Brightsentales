# Frame actions batch 3 — provisional review

**Gate: REJECTED by Karl on 21 October 2026 in entirety.** No Batch 3 action is approved for production. The exported chair, toy and combined sequences fail Karl's cartoon animation standard. The [rejection audit](REJECTION_AUDIT.md) records full-video contact sheets, geometry causes, the proposed repair and the missing artwork. Scene Maker no longer permits adding new Batch 3 actions; existing saved scenes remain readable for review. Batch 4 is closed.

## Acceptance checklist

- [x] Max and Maxine have separate complete sit-lowering, seated, object-reach, object-lift and object-carry frames; a separate provisional chair is available. Approved sprite packs and the Living Room image were not edited.
- [ ] Sit down and Stand up show natural seat contact and weight transfer. **Failed visual review:** persistence and floor coordinates work in code, but the characters appear in front of the chair and switch poses abruptly.
- [ ] Pick up, carry and put down show believable hand contact and continuous motion. **Failed visual review:** ball offsets are hardcoded and the front-to-side carry transition snaps.
- [x] Before rejection, Scene Maker offered all four controls; five scenes were saved, reopened and exported in disposable Chrome. The combined scene was also exported as an episode. **After rejection, new Batch 3 controls are disabled while saved scenes remain readable.**
- [x] Full frontend suite: **197/197 tests passed**. Production build passed. Browser console exceptions and error log entries: **0**.
- [ ] Maxine sits naturally on the approved sofa. **Failed:** the sofa is flattened into the Living Room background, so there is no separate front/seat layer for correct overlap. Repainting a strip of the unchanged room image over Maxine hid her torso and disconnected her legs; moving her in front of the sofa left her sitting on the rug. The attempted overlay was removed, and Scene Maker now rejects sofa seating. A separately layered, visually approved sofa asset is needed.
- [ ] Karl's visual acceptance of any Batch 3 artwork or motion. **Rejected on 21 October 2026.** The frames remain provisional and unavailable as new Scene Maker actions during repair.

## Audit and implementation

`timedScenes.ts` remains the only timed action evaluator; `scenePreview.ts` remains the single canvas renderer for Scene Maker, scene WebM, Episode Maker and episode WebM. The earlier walking, waving and Bright Speak paths were not edited. Batch 3 adds four action types and optional `objects` to the version 1 timed scene record. Old scenes without `objects` retain their storage shape and validation. `objectAt` evaluates toy ownership and position from actions at the requested scene time, so seeking and export agree. Invalid pickup distance, repeated ownership, putdown without possession, walking while seated and unsupported sofa seating are reported by validation. The toy is a small vector drawing in the existing canvas, not another scene engine.

The ten character PNGs and chair PNG under `public/art/provisional-actions/` were generated as **transparent provisional whole-body pose artwork** with the image tool, referencing each approved idle character image for clothing, colours and proportions. Prompts specified bent knees for seating, a floor-reaching hand, an intermediate lift, an open carrying palm and no toy baked into character pixels. The chair was generated separately. These assets are additive and can be replaced after review; they are not approved redraws.

Scene Maker offers a provisional chair for Sit down and Stand up, a toy ball with editable starting floor coordinates, and a toy selector and floor release point for Pick up and Put down. Existing action blocks control order and duration. The `provisional-v1` marker limits these frames to Max and Maxine in original outfits. Other outfits and custom Brightlings cannot select them; changing an outfit after saving shows the standing fallback and a warning. The painted Living Room sofa option is explicitly unavailable.

## Rendered evidence

The rejected implementation's videos were exported with Scene Maker in a disposable Chrome profile using [the repeatable browser script](browser-check.mjs) with `--working-only`. Its [run record](browser-check.json) confirms scene reload, four controls visible at that time, scene export, episode export and no browser errors. FFprobe decoded these video streams. **The single-frame observations below do not establish visual acceptance; see the full-motion [rejection audit](REJECTION_AUDIT.md).**

| Demonstration | Video | Decoded frames | Visual observation |
| --- | --- | ---: | --- |
| Max sits and stands on chair | [7 s WebM](videos/B3_Max_Chair.webm) | 172 | [Seated frame](max-chair-seated.png): knees bent, shoes at floor line, chair behind body. |
| Maxine sits and stands on chair | [7 s WebM](videos/B3_Maxine_Chair.webm) | 172 | [Seated frame](maxine-chair-final.png): body and feet align with separate chair. This is **not** the requested sofa. |
| Max picks up, carries and puts down toy | [9 s WebM](videos/B3_Max_Toy.webm) | 220 | [Hand contact](max-lift.png), [walking hold](max-carry-walk.png), [release](max-toy-released.png). |
| Maxine picks up, carries and puts down toy | [9 s WebM](videos/B3_Maxine_Toy.webm) | 220 | [Walking hold](maxine-carry-walk.png) and [released toy](maxine-toy-released.png). |
| Walk, wave, sit, stand, walk, pick up, carry, put down, wave | [17 s WebM](videos/B3_Walk_Wave_Sit_Toy.webm) | 411 | [Sitting](combined-sit-final.png), [carrying](combined-carry-final.png); approved walk/wave frames continue playing. |
| Same combined scene in Episode Maker | [17 s episode WebM](videos/B3_Episode_Export.webm) | 412 | Same scene renderer and action state. |

[Scene Maker controls screenshot](scene-maker-controls.png) shows the four actions and toy control. Browser export used a real pointer click to unlock the audio context. The browser run created and reopened the scenes in its isolated localStorage; it did not read or modify Karl's normal browser profile. The scene/episode videos are VP9 WebM with Opus audio track.

## Failed sofa evidence and remaining limits

The [sofa attempt video](sofa-failure/B3_Maxine_Sofa.webm) and [decoded seated frame](sofa-failure/sofa-seated.png) show the overlap failure. The final product no longer draws the failed foreground strip or offers sofa seating. A sofa with separate back, seat and front layers is required for Maxine to sit with connected legs and sensible depth. This is an artwork/scene layering task requiring Karl's approval because the Living Room is approved artwork.

The provisional complete frames switch at timed pose boundaries; they do not interpolate anatomy between frames. Facial/linework differences from the approved originals remain possible. The toy is one illustrated ball type with **hardcoded approximate** hand offsets, not verified per-frame grip anchors. Two-character prop overlap, arbitrary objects, other outfits, other furniture and phone-plus-toy in the same hand were not visually verified. **None of the previously described working subset passed Karl's visual review.** The videos in this report document the rejected implementation. No corrected video or renewed visual acceptance exists.

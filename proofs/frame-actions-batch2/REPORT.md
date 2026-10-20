# Frame actions, batch 2 â€” provisional gesture review

**Requested actions:** Clap, point, nod and shake head. **Gate:** Batch 1 approved by Karl on 20 October 2026. Karl authorised provisional whole-body artwork for Max and Maxine. Batch 2 is implemented for review; **Karl has not visually approved it**.

## Acceptance checklist

- [x] Browser-rendered frames show pointing arms, clapping hands meeting and separating, lowered heads for nods, and heads turned sideways for shakes on Max and Maxine.
- [x] Original sprite files and their walking, waving and Bright Speak renderer paths are untouched. Foot lines were visually inspected in the rendered scene frames; the provisional poses retain their clothes and colours.
- [x] New actions use the shared Scene Maker and episode renderer, retain timing on save/reload and can sequence with other actions.
- [x] A real browser-rendered scene and episode video were decoded and inspected.
- [ ] Karl approves the visual result before the next batch.

## Audit

The existing `point`, `nod`, `shake` and `clap` action types are already saved and selectable in Scene Maker. Their current `expressionAt` implementations transform the whole idle image: point rotates it once, nod rotates it repeatedly, shake rotates it more quickly and clap changes its width. None moves a hand or head independently. The active sprite packs contain idle, side-walk and wave frames, but no pointing, clapping or head-motion poses for Max, Maxine, their other outfits or custom Brightlings. The earlier AC-01 cut-outs are stopped and cannot provide clean motion.

## Browser-rendered baseline

- [10 second Scene Maker WebM](downloads/Batch_2_Existing_Actions_Baseline.webm) shows all four existing action types on Max and Maxine. It was exported with the application's Scene Maker WebM button in an isolated headless Chrome profile.
- [Scene Maker controls](scene-maker-actions.png) and decoded frames for [point](point-baseline.png), [nod](nod-baseline.png), [shake](shake-baseline.png) and [clap](clap-baseline.png).
- [Repeatable browser script](browser-check.mjs) and [scene and console record](browser-check.json). Chrome reported zero console errors. FFmpeg decoded 229 video frames and Opus audio through approximately 10.16 s. WebM SHA-256: `20F7621EEFE0246657D173632898FC4F6CB8BEB10CF899FEFD8162DC47360C2E`.

**Visual result: failed.** In the pointing segment, the hands remain at the characters' sides. Clapping never brings the hands together. Nod and shake move the entire character rather than the head. Whole-sprite rotation also tips the shoes away from the ground line. These are existing actions, so the video is diagnostic evidence, not a Batch 2 demonstration of new working animation. No Batch 2 product code or approved artwork was changed.

## Provisional implementation

Twelve new transparent whole-body PNGs live under `public/art/provisional-actions/{max,maxine}/`, separate from the approved sprite packs. They were generated with the image tool using each approved idle as the reference, then selected by visual inspection. The six poses per character are `point`, `clap-open`, `clap-contact`, `nod-down`, `shake-left` and `shake-right`. No approved original was edited. The generated frames are close to the approved design, but are provisional redraws rather than pixel-identical edits; Karl needs to judge facial and linework consistency.

`TimedAction.artwork: 'provisional-v1'` opts a gesture into these frames. Existing saved actions without the field keep the old expression behavior. `gestureFrameAt` selects complete frames from scene time, starting and ending on approved idle; the renderer uses the existing idle size and measured ground line. Scene Maker exposes the four controls for Max and Maxine in their original outfits, and can opt older actions into the provisional frames. Episode preview/export load the same selected frames and call the same scene evaluator and renderer. While Bright Speak is held, its existing illustrated or composite pose takes priority over these gestures so the prop stays attached to its established hand placement.

## Rendered evidence

- [Scene Maker video: all four gestures on both characters](provisional-downloads/Batch_2_Provisional_Gestures.webm), 10.10 seconds, 107 decoded video frames, VP9/Opus. SHA-256: `70A01CA14159CF17D25BFF794F792715E53F0C6CFDA504A97103B0DB661EEFAD`.
- [Episode video using the same saved scene](provisional-downloads/Batch_2_Provisional_Episode.webm). 10.17 seconds, 228 decoded video frames, VP9/Opus. SHA-256: `AD1F6F70AD1B031E208A80F8FB15594C5EC022E8DC7D151C83535AA25653A5E8`.
- Sampled rendered frames: [point](provisional-scene-point.png), [nod](provisional-scene-nod.png), [Max shaking](provisional-max-shake.png), [Maxine shaking](provisional-scene-shake.png), [Max clapping](provisional-scene-clap.png), [Maxine's hands touching](provisional-maxine-clap-contact.png), plus [Scene Maker controls](provisional-scene-maker.png). [Browser run record](provisional-browser-check.json) and [repeatable isolated Chrome script](provisional-browser-check.mjs). In the video Max points at 0–2 s, nods at 2–4 s, shakes at 4–6 s and claps at 6–8 s; Maxine follows each action one second later.
- Isolated Chrome reported zero console exceptions. The script saved the scene and reloaded the application; the provisional markers survived. It then exported the same scene as an episode. Finally, it selected Point in Scene Maker and verified that Save Scene stored a new `provisional-v1` action. The first automated episode attempt stalled at 0% because a synthetic JavaScript click did not unlock the browser audio context; a real CDP pointer click completed the export. No normal browser profile was used.
- Focused tests, the full frontend suite (195/195) and production build passed. Tests cover frame timing, old action compatibility, validation and save/decode. They do not establish Karl's visual approval.

## Visual observations and limits

Both characters visibly point; the clap poses alternate between separated and touching hands. Nod and shake change the head rather than rotating the full sprite. In the inspected frames, the shoes stay at the same stage floor line while the heads and hands move, and the body silhouette is complete. Scene and episode sampled frames matched. Motion uses stepped whole-frame changes, so the transition from approved idle to a generated pose can show small linework and facial differences. The shake is subtler on Max than Maxine. Left/right pointing variants are not included. The test clip has no dialogue or simultaneous Bright Speak interaction, so those combined situations are not visually verified here.

The generated frames cover only Max and Maxine in original outfits. Other outfits and custom Brightlings retain their appearance and cannot select new provisional gestures; if an outfit is changed after a scene is saved, the action displays that outfit's standing frame and the editor shows a warning. The app has no automatic method yet to produce style-locked, outfit-aware pose art for every Brightling. The isolated Chrome Scene Maker recording captured only 107 frames over 10.10 seconds under headless load; the episode recording captured 228 frames over 10.17 seconds and is the smoother review copy. Batch 3 remains closed pending Karl's review.

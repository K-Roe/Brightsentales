# Frame actions, batch 1 — approved by Karl

**Date:** 20 October 2026  
**Scope:** Jump and excited bounce on the existing timed scene renderer. AC-01 skeletal editing is stopped and its navigation entry is hidden. Its saved local definitions and files were not deleted. **Karl officially approved Batch 1 on 20 October 2026.**

## Audit and acceptance checklist

The canonical `TimedAction` schedule in `timedScenes.ts` drives `stateAt`. `scenePreview.ts` selects intact idle, five walk and three wave frames from `previewPack`; Scene Maker, scene WebM export and episodes call this renderer. Saved scenes are local version 1 data. Max, Maxine and custom Brightlings use the same evaluation path. No approved sit, point, clap, hug, pickup or other articulated frames exist in the active sprite packs. The old `point`, `nod`, `shake` and `clap` entries are whole-sprite transforms, not independent body animation.

Checklist for this batch:

- [x] Add ready-made Jump and Excited bounce controls in Scene Maker and its timeline.
- [x] Keep the approved sprite intact and return to idle at each action end.
- [x] Use the measured foot anchor at takeoff, landing and between bounce beats.
- [x] Sequence saved Walk → Wave → Jump → Excited bounce in a version 1 scene.
- [x] Render a scene WebM through the actual browser export, with Max and Maxine.
- [x] Keep phone, walking and waving code paths unchanged; full test suite and build pass.
- [x] Karl visual approval, recorded on 20 October 2026.

## Rendered evidence

- [8 second scene WebM](downloads/Frame_Actions_Batch_1.webm) — exported from the Scene Maker button in disposable headless Chrome. Max walks 0–2 s, waves 2–4 s, jumps 4–5 s and bounces 5–6.5 s. Maxine jumps 1–2 s and bounces 3–4.5 s. Both return to idle.
- [Scene Maker controls](scene-maker-actions.png) — actual browser screenshot, including Jump and Excited bounce.
- [Maxine airborne](maxine-jump.png), [existing Max wave](existing-wave.png), [Max airborne](jump-airborne.png), [Max bounce](excited-grounded.png), [return to idle](return-idle.png) — decoded frames from that WebM.
- [Browser check record](browser-check.json) and [repeatable CDP check](browser-check.mjs). The script requires local Vite on 4174 and a disposable Chrome profile on debugging port 9237; it seeds only that profile.

Chrome reported zero console exceptions/errors during this check. FFmpeg decoded 188 video frames and Opus audio through approximately 8.15 s. `npm test -- --run`: **194/194 passed**. `npm run build`: **passed**. The recording shows intact approved characters and distinct flight versus floor contact. The video has silent audio because this test scene has no audio clips.

WebM SHA-256: `ABA9396C3AB4577BAFAC34339A00C46B324AA18B65C90C04E493D8CECF3072E4`.

## Limits and next approval gate

Jump and excited bounce reuse the approved whole-body idle artwork with vertical motion. The limbs and face do not change pose. The fixed ground shadow remains under the takeoff point during flight. Other outfits and custom Brightlings use the same whole-frame transformation, but this browser recording shows only Max and Maxine in their original outfits. This is a scene export; a separate full episode containing the new actions has not been visually checked. The episode renderer shares `drawScenePreview`.

Sitting, standing, pointing, clapping, object handling, hugging, carrying and natural talking gestures require approved whole-body frames or approved prop/composite designs per character template. They were not represented by distorted copies of the idle sprite. This batch stops here for Karl's review before any of those actions are attempted.

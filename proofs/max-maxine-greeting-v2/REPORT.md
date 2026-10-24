# Max and Maxine Greeting V2 — review candidate

**Status: REJECTED by Karl after visual review.** This report preserves the V2 technical evidence; see the [V3 frame-by-frame root-cause investigation](../max-maxine-greeting-v3/REPORT.md). Its earlier technical checks did not establish visual acceptance.

## Cause of the V1 turn problem

`stateAt` ended each walk by returning the front-facing idle sprite. The old Turn action then scaled that front sprite horizontally to 65% width and back. It never selected a side-to-front turning drawing, so the body snapped from profile to front and briefly looked squeezed. The existing approved wave frames are also front-facing. Those frames cannot show a sustained face-to-face exchange.

## V2 scope and acceptance checklist

- [x] Max and Maxine start on opposite sides and walk inward using the unchanged approved walk timing and frames.
- [x] They stop at (690, 790) and (980, 790), remain in the approved side-standing pose, and face each other through the idle gaps.
- [x] Max waves at 3.6–5.22 seconds; Maxine replies at 5.45–7.07 seconds. The existing wave clock selects three separate side-wave **candidate** frames per character. They finish in side-standing idle.
- [x] All six candidate frames are 500 × 724 transparent PNGs. Their pixels from y=565 through the shoe line are identical to each character's approved side-standing frame. Original art files were read only.
- [x] Scene Maker saved and reopened the V2 scene; Episode Maker saved and exported the one-scene episode. A Studio Backup v8 exported from the disposable profile validated and restored in a test with the candidate marker intact.
- [x] Rejected Batch 3 controls remained disabled; no sitting or new animation engine was introduced.
- [x] Complete scene and episode videos decoded at 200 video frames each, 1672 × 941 VP9, with last video timestamps of approximately 8.3 seconds. Episode frame intervals had median 47 ms, maximum 69 ms, and no gap over 100 ms.
- [ ] Karl's visual approval of motion and the side-wave artwork.

## Review evidence

- [V2 Scene Maker recording](greeting-scene.webm) and [complete exported episode clip](greeting-episode.webm).
- [Scene Maker screenshot](scene-maker.png), [walking](frame-2.9.png), [stopped in profile](frame-3.2.png), [Max wave](frame-4.1.png), [Maxine wave](frame-5.8.png), and [side-facing idle](frame-7.8.png) decoded from the episode.
- [Editable scene](greeting-scene.json), [episode](greeting-episode.json), and [Studio Backup v8](greeting-studio-backup.json). Restoring a Studio Backup replaces saved libraries; review it in a separate browser profile or export current work first.
- [Disposable-browser check](browser-check.json), [repeatable browser script](browser-check.mjs), and [local artwork assembly script](build_side_wave.py).

The side-wave frames are local, deterministic composites of copies of each character's approved side-standing and front-wave art. They are stored separately under `public/art/provisional-actions/greeting-v2/`; the originals were not modified. The opt-in `greeting-side-v2` marker is limited to Max/Maxine walk and wave actions in the existing `TimedAction`/`stateAt`/`drawScenePreview` path. Other saved scenes keep their earlier evaluation. If an outfit lacks these candidate frames, Scene Maker and Episode Maker show a warning and refuse export instead of silently treating it as approved artwork.

## Visual limits and verification boundary

The side-wave composites retain the approved profile faces, clothes and foot pixels, but the raised-arm joins and hand position are new artwork studies. Max's raised hand passes near his face; Maxine's lifted sleeve edge may read as a pasted piece at full size. Karl should judge those seams and the wave rhythm in the complete video. The decoded samples show the shoes on the same floor line and no apparent position jump at the stop, but automated position checks and sampled frames do not replace his full-motion judgment. The silent Opus track is expected because this scene has no audio clips.

Focused tests passed 4/4; full suite passed **203/203**; production build passed with the existing bundle-size advisory. The production-browser check reported no console errors. No later milestone has started.

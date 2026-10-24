# Camera System V1 — technical review cut

**Status: APPROVED by Karl on 22 October 2026.** Karl approved adding the demonstrated Camera System V1 and Scene Maker UI for regular use. This approval does not cover Greeting V3, rejected Batch 3 actions or deferred sitting. Camera V2 and introduction rebuilding have not started.

## Review files

- [13-second scene WebM](camera-demo.webm) and [episode WebM](camera-demo-episode.webm). Both use the same saved scene and shared renderer.
- [Saved demonstration scene](camera-demo-scene.json) and [Studio Backup v8](camera-demo-studio-backup.json). The latter was exported through the Studio after scene and episode saves.
- [Wide opening](preview-0.png), [Max medium wave](preview-5-5.png), [pan toward Maxine](preview-8.png), [Maxine medium wave](preview-9-5.png), [wide ending](preview-12-5.png), and [temporary Close-Up control preview](close-up-preview.png). The close-up was restored to Medium before the demonstration scene was saved.
- [Browser check](browser-results.json) and its [repeatable disposable-profile script](browser-check.mjs).

## Architecture and scope

The default camera is Wide. Optional keyframes in the existing version 1 timed scene model select Wide (1×), Medium (1.4×), or Close-Up (2.7×). Medium may focus Max, Maxine, all scene Brightlings, or a custom scene point; Close-Up focuses an individual or custom point. Follow mode uses `stateAt` at the requested scene time. Smoothstep interpolation changes camera centre and zoom over an adjustable duration. Viewport clamping prevents blank edges. Validation rejects overlaps, invalid targets and very fast pan/zoom transitions. Keyframes have a dedicated lane and may be dragged or resized; the Camera panel exposes exact start and duration fields. Changes to an existing keyframe update the preview immediately, while a new shot can be previewed before adding it.

The transform is applied inside `drawScenePreview`, after scene timing has been resolved. The character, prop, place, phone, audio and episode clocks are unchanged. Scene Maker, scene export, Episode Maker and episode export call that shared renderer. Scenes without keyframes remain on the original Wide path and retain their version 1 IDs and saved shape. Studio Backup v8 needs no format change because it already stores timed scenes. The built-in available background is the protected Living Room; Bedroom and Garden exist in the catalog without bundled art, while custom/imported Places depend on a user's saved artwork. This demo uses the protected Living Room image. Max and Maxine use original approved outfit sprites and existing walk/wave timing. No artwork or animation action was added.

## Demonstration clock

| Seconds | Character action | Camera |
| --- | --- | --- |
| 0–3 | Both appear; Max walks from 0.4–2.5 | Wide |
| 3–5 | Both idle | Ease to Medium on Max |
| 5–7 | Max waves, 5–6.7 | Hold Medium on Max |
| 7–9 | Both idle | Ease across to Medium on Maxine |
| 9–11 | Maxine waves, 9–10.7 | Hold Medium on Maxine |
| 11–13 | Both idle | Ease back to Wide |

## Verification

- Focused camera tests: 3/3 pass. Full `npm test -- --run`: **208/208 pass**. `npm run build`: **pass**, with Vite's large-chunk advisory.
- Disposable Chrome: the Camera lane showed three keyframes; selecting one opened its timing controls; switching it temporarily to Close-Up rendered the preview; Scene Maker save/reload retained the camera data exactly; scene and episode WebM exports completed; Studio Backup retained all three keys and the episode. A separate UI check then added a Close-Up keyframe through Scene Maker, saved and reloaded it, and confirmed four persisted camera keys. The review exports and Backup were captured before that extra UI check. Zero captured console errors.
- FFmpeg decoded both WebMs without errors. Final video packet timestamps were **13.097 s** for the scene and **13.106 s** for the episode; both are VP9 1672×941 with an Opus stream. At the settled Maxine wave (9.5 s), decoded scene and episode frames differed from the Scene Maker preview by about **1–3 RGB values per channel on average**, consistent with lossy encoding.
- I visually inspected the opening, Max wave, Maxine wave, wide return, temporary Close-Up, and decoded video frames. Both waves use the existing approved whole-body artwork. The Close-Up deliberately crops the lower body to frame Max's face and upper body without stretching.

## Limits and Karl's check

The demo is silent because it has no audio clips; it verifies that the camera follows the existing scene clock but does not exercise simultaneous speech or music. Follow mode has a focused test; group focus and custom points were code reviewed but not separately browser-recorded. A fresh-profile restore of the exported Studio Backup was not performed; backup export and saved-scene reload were verified. MediaRecorder timestamps can drift slightly relative to the editable playhead during movement, so exact transitional-frame equality is not claimed. The existing approved walk can still cut from a side pose to frontal idle at its stop; Greeting V3 remains blocked on separate artwork.

Karl approved Camera System V1 after the review cut was delivered. The listed verification limits remain in force; they do not change the scope of that approval.

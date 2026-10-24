# Living World V1 — visual review

**Status: visually approved by Karl in the Living World V1.1 request on 23 October 2026.** No commit was made. V1.1 has a separate visual approval gate; Living World V2 has not started.

## What changed

`livingWorld.ts` schedules independent, deterministic quiet pauses, approved side-walk cycles and occasional approaches from the scene ID, character ID and scene time. Max defaults to a calmer activity probability; Maxine explores and approaches more often. A scene may override activity, curiosity and sociability probabilities per Brightling in its saved `livingWorld.preferences`; Scene Maker intentionally has only one ON/OFF switch. These defaults are experimental, not permanent character canon.

The controller works only in the approved Living Room. Walking feet stay in a conservative foreground corridor, targets are selected from simple room points of interest, and candidate paths are checked against the other characters' planned or scripted positions. It uses no physics, AI, cloud service, new props or new artwork. The renderer composes Living World below director actions and Brightling Life V2. Each free interval ends at the scripted anchor before the next directed action begins, so scripted walk/wave timing is unchanged. Camera follow, Scene Maker preview, scene export and episode export read the same world state. Existing scenes without `livingWorld` retain their previous behaviour.

## Review media

| File | Purpose |
| --- | --- |
| [Living World ON episode](living-world-on-episode.mp4) | Complete 30-second episode, H.264 at 30 FPS. |
| [Living World OFF comparison](living-world-off-comparison.mp4) | Same scene and Brightling Life V2, with autonomy disabled. |
| [Side-by-side OFF / ON](side-by-side-off-on.mp4) | OFF left, ON right; easiest timing comparison. |
| [Scene Maker export](living-world-on-scene.mp4) | The editable scene rendered through Scene Maker. |
| [Editable scenes](demo-scenes.json) | Existing timed-library format with ON and OFF scenes. |
| [Studio Backup](living-world-studio-backup.json) | Restorable scenes and episode for a disposable Studio profile. |
| [Browser checks](browser-results.json) and [restore checks](restore-results.json) | Save/reopen, export and fresh-profile restore evidence. |

The scene starts with independent unscripted behaviour for 10 seconds. Max's directed walk runs exactly from 10 to 15 seconds while Maxine remains autonomous. Maxine's directed wave runs from 15 to 16.7 seconds; both characters are autonomous again after it. Both retain V2 blinking and breathing throughout compatible poses. The demonstration has no authored narration, music or effects, so the audio track is silent.

## Verification

- Focused Living World tests: **5 passed**. Full suite: **220/220 passed** across 32 files. `npm run build` passed with Vite's existing large-chunk advisory.
- Disposable Chrome saved and reopened the ON scene, exported the ON and OFF scene WebMs and the complete episode, and exported a Studio Backup. A fresh disposable Chrome profile restored the Backup through the UI, reopened the ON scene and confirmed both ON/OFF settings and the episode. Both runs reported no browser console errors.
- All native WebMs and H.264 MP4 review files decoded fully in FFmpeg. The ON episode is 30.16 seconds with 1672 × 942 H.264 video at constant 30 FPS and AAC audio. The source was 1672 × 941; one bottom pixel was padded for H.264 without cropping or stretching. The OFF comparison is 30.15 seconds. Exported wave and preview frames were inspected.
- The first browser-check run hit a **proof-script download selection error**: a zero-byte leftover scene download was selected ahead of the complete episode download. The complete episode file was recovered and decoded, the collector was corrected, and a fresh disposable run completed the remaining save/reopen/Backup checks. The Studio export itself completed successfully.

## Visual limits and approval gate

The approved whole-body sprites cannot independently aim eyes or turn a head. In this version, observing means pausing near a room point; acknowledging another Brightling means approaching and pausing nearby, without claiming eye contact. Approved side-walk art still cuts to the front-facing idle frame at a stop. The Living Room is flattened artwork, so the safe walking corridor stays in front of the furniture and does not simulate occlusion or prop interaction. For unusual starting positions or larger casts, the planner may choose a quiet pause instead of an unsafe walk. Karl approved this V1 foundation in the V1.1 request; the V1.1 polish remains subject to separate visual review.

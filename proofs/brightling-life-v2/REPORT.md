# Brightling Life System V2 — visual review

**Status: approved by Karl in the Living World V1 request on 23 October 2026.** No commit was made. Cartoon Life V1 remains selectable for comparison.

## Audit and design

V1 used one repeating list of blink intervals with a fixed Max/Maxine offset. Its blink image replaced the idle sprite only; walk, wave, expressions and phone poses suppressed it. Body movement also paused whenever another action owned the pose. That made the characters' quiet moments look coordinated and stopped their life motion during the moments that needed it most.

V2 uses the character's stable ID to seed independent blink and breath channels. The blink schedule varies its intervals and occasionally makes a gentle double blink. The controller computes its result from scene time, so seeking, playback and export use the same answer. The body channel remains small during walks, waves and phone holding; it composes after the approved pose and never edits action timing or sprite files. There are no new timeline actions.

The whole-body artwork has no separate eyelid files. V2's smallest experimental artwork addition is a temporary transparent eye-region Canvas layer for each supported pose. It samples face colours from the already selected sprite, draws only the closed eyelids, and follows the sprite's existing transform. The original full-body frame stays underneath unchanged. Registrations cover the original and recoloured male/female template idle, side-walk and wave frames, plus Max's approved illustrated phone frames. Custom Brightlings use their template's recoloured sprites and the same registration path. Other provisional gesture art has no reviewed eye registration, so V2 leaves those eyes unchanged for now rather than placing an incorrect eyelid.

## Review media

| File | What to inspect |
| --- | --- |
| [Complete V2 episode](brightling-life-v2-episode.mp4) | Watch the 16-second H.264 MP4 episode at 30 FPS. |
| [Side-by-side V1 and V2](side-by-side-v1-v2.webm) | V1 is left; V2 is right. Same scene, character actions and phone timing. |
| [V1 baseline scene](cartoon-life-v1-comparison.webm) | Original toggle mode on the same demonstration. |
| [V2 Scene Maker export](brightling-life-v2-scene.mp4) | Watch the matching scene export as a 30 FPS H.264 MP4. |
| [Editable Studio Backup](brightling-life-v2-studio-backup.json) | Restore into a separate/disposable profile to reopen both scenes and the episode. |
| [Saved scenes](demo-scenes.json) | The V2 scene and V1 comparison scene in the existing timed library format. |

The V2 scene shows both characters standing with separate early blinks, Max waving while Maxine stays alive, Max blinking during his approved walk, Maxine blinking while she holds the existing generic Bright Speak phone composite, and Maxine blinking during her approved wave. [Max walking blink](export-walk-blink.png), [Maxine phone blink](export-phone-blink.png), and [Maxine wave blink](export-wave-blink.png) are frames taken from the **exported episode**. The generic Maxine phone still has the existing hand-contact limitations; this milestone did not redraw or approve phone artwork.

## Verification

- Focused V1/V2 life tests passed. Full `npm test -- --run`: **215/215 passed** across 31 files. `npm run build`: passed with Vite's existing large-chunk advisory. `git diff --check`: passed.
- Disposable Chrome showed both opt-in modes, previewed the independent blinks, saved/reopened the V2 scene, exported both scene WebMs and the full episode, and exported Studio Backup. No console errors. [Browser results](browser-results.json).
- A fresh disposable Chrome profile restored that Backup through the UI and reopened the V2 scene. Both modes, the episode and Maxine's phone actions survived. No console errors. [Restore results](restore-results.json).
- The Studio's WebM episode and scene exports were converted to review MP4s with H.264 video at constant 30 FPS and AAC audio. One bottom pixel was padded to make the original 1672 × 941 frame H.264-compatible; no artwork was cropped or stretched. Both MP4s decoded fully without errors. The episode is 16.18 seconds and the scene is 16.20 seconds. The demonstration has no authored audio clips, so the audio tracks are silent. Exported frames were inspected at the walk, phone and wave blinks.

## Approval boundary

Karl approved the V2 life behaviour in his Living World V1 request. The V2 system remains opt-in (`life.mode: "v2"`) while V1 stays available and existing saved scenes retain their original behaviour. The approval does not cover new head turns, eye gaze, lip movement, the side-walk-to-front pose transition, or Living World V1.

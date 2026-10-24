# Cartoon Life V1 — experimental review

**Status: technically verified; awaiting Karl's visual and listening decision.** No artwork or new action is approved by this report. No commit or freeze was made.

## Why the earlier output felt stiff

The renderer selects complete standing, walking and waving PNGs at fixed times. Between actions, a character is usually still. The approved side walk ends by returning to the front standing frame, so its orientation changes abruptly. The Living Room is one flattened image: curtains, plants and window scenery cannot move independently without new reviewed layers. Existing generic expression transforms scale or rotate the whole character rather than articulating the head, eyes, arms or face. Camera V1 helps composition but does not solve those pose changes.

## Implemented

- Optional `life` setting on the existing version 1 timed scene model, with one **Cartoon Life experimental** checkbox in Scene Maker. Unmarked legacy scenes keep their original renderer path.
- Sparse, deterministic idle blinks for Max and Maxine's original approved standing sprites. The closed-eye study is drawn into a temporary Canvas at runtime; original PNGs are untouched. This visual variation is experimental and requires Karl's review.
- Restrained foot-anchored breathing with rest periods, 0.3-second anticipation before walk/wave, a walk bob of at most 2.2 stage pixels, and a short damped settling motion after walk/wave. Existing approved action timing and pose frames are unchanged.
- Subtle optional Living Room window light and three slow motes, clipped to the window area. The painted background is unchanged.
- Scene Maker preview and video export, Episode Maker preview and video export all use `drawScenePreview` and the same absolute scene-time calculations. Camera V1 remains the only camera system.

The 18.5-second story uses the approved Max and Maxine standing/walk/wave frames and Karl-approved Batch 2 nod frames. Max remains non-verbal. A low-volume original instrumental and two soft chimes were imported as ordinary Audio Library assets and timed in the scene; no new audio engine was added.

## Review files

| File | Purpose |
| --- | --- |
| [Complete episode](cartoon-life-episode.webm) | Watch and listen to this first. One complete 18.5-second scene, VP9 picture and Opus stereo soundtrack. |
| [Baseline scene](baseline-scene.webm) | Same staging, camera, approved actions and audio with Cartoon Life off. |
| [Enabled scene](cartoon-life-scene.webm) | Scene Maker export with Cartoon Life on. |
| [Studio Backup](cartoon-life-studio-backup.json) | Import into a separate/disposable Studio profile to reopen both editable scenes, episode and audio assets. |
| [Saved scenes](saved-scenes.json) | Timed scene data; the backup is the complete editable transfer. |
| [Episode contact sheet](episode-contact-sheet.png) | Broad visual timing check. |
| [Before](baseline-preview-2-3.png) / [after](life-preview-2-3.png) | Same early wide shot; Max's experimental blink is visible in the after frame. |
| [Blink study](blink-study.png) | Approved originals beside isolated closed-eye Canvas variants at source size. |

The editable scene is the first item in the imported Scene Maker library, **A Little Hello - Cartoon Life study**. The second is its off baseline. The episode is **A Little Hello - Cartoon Life V1**. A starter scene without audio IDs is also retained in [demo-scene.json](demo-scene.json); use the Backup for the full demonstration.

## Verification

- Focused Cartoon Life tests: 4 passed. Full `npm test -- --run`: **212/212 passed** across 30 files. `npm run build`: passed (existing Vite large-chunk advisory).
- Disposable Chrome: imported both WAV assets through Audio Library; opened the on/off scenes; showed all three camera blocks; saved and reopened the enabled scene; exported both scene WebMs, the episode WebM and Studio Backup. No console errors. [Results](browser-results.json).
- Fresh disposable Chrome profile: restored the Studio Backup through the UI, then reopened the enabled scene. Both scenes, one episode, three scene audio clips and two Audio Library assets survived. No console errors. [Restore results](restore-results.json).
- FFmpeg decoded the complete episode and both scene videos without errors. The episode's last video packet is at **18.592 s**; it contains 1672 × 941 VP9 and 48 kHz stereo Opus. The audio stream is non-silent (mean −33.4 dB, peak −18.6 dB). Export frames were inspected at the blink, walk, wave and closing camera states. Sampled preview and exported frames show the same poses and framing; the MediaRecorder video packet timing has a small start offset, so frame-exact audio to picture alignment was not established.

## Current visual limits and decision

This is a modest improvement, not yet proof of broadcast-quality character acting. The approved whole-body art still cannot turn a head independently, direct the pupils toward another character, form a new emotional expression, or smoothly connect the side walk to the front standing/waving pose. The nod and camera framing suggest attention, but do not create true eye contact. The window treatment is faint; independently moving curtains or outdoor scenery needs reviewed layered artwork. There are no flashes or shake; motion is optional and gentle.

Karl should watch the complete episode, compare the baseline, and decide **APPROVE**, **CHANGES** or **REJECT** for Cartoon Life V1. In particular, inspect the runtime blink artwork, the walk stop at about 8.2 seconds, the feel of the quiet soundtrack and whether the overall scene genuinely feels more alive. Until then, the new behaviour and media remain experimental. Greeting V3, rejected Batch 3 and sitting remain untouched.

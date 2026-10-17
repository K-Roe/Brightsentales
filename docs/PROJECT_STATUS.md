# Project status

Updated 17 October 2026 after a repository audit. Start here when resuming work; verify the code and Git state before acting.

## Current gate

- **Current milestone:** M6.6, Credits Maker.
- **Status:** IN PROGRESS under Karl's temporary batch development authorisation.
- **Last explicitly approved milestone:** F1 Unsaved Episode Changes Protection, approved by Karl in the F2 brief. M6.3 was approved in the F1 brief. Earlier approval is limited to the particular artwork/workflows Karl named; do not assume every historical proof report was accepted.
- **Karl's approval required:** Yes, at the batch review. F2, F3, F4, M6.4 and M6.5 are implemented but unapproved. Batch work may continue sequentially after technical verification; no result is pre-approved.
- **Current acceptance checklist:** M6.6 builds reusable saved end credits with creator, character, production and music credit lines, acknowledgements, static or scrolling presentation, a place background, music, duration, preview and save, reusing the same production model as M6.5.

## Implemented now

- React 19, TypeScript and Vite local web application with Characters, Places, Scenes, Episodes, Audio and Playground sections.
- Protected Max and Maxine sprites; original and approved alternative outfits for each; shared nine-pose idle/side/walk/wave sprite mapping. Custom Brightlings use approved Max/Maxine source frames and reusable recolouring masks for body, hair and clothing. Custom Brightlings currently use original outfits.
- Character library with create/edit/delete, stable IDs, local save, library-only JSON import/export, previews and Playground addition.
- Places library with protected Living Room, one-level folders, move controls and user artwork upload for other places. Bedroom and Garden do not ship with approved production artwork.
- Playground with placement, click-to-walk, wave, depth sorting, save/reopen/reset.
- Timed Scene Maker with deterministic state at arbitrary time, stage placement, action timeline and Appear/Walk To/Wait/Wave/Disappear.
- Episode Maker with saved scene references, reorder/repeat, global seek/play/pause/restart and missing-scene warning.
- F1 episode draft comparison and Save/Discard/Cancel protection for Back, Edit Scene and sidebar navigation; browser beforeunload protection while dirty.
- M6.3 Audio Library in IndexedDB; scene/episode music and effect clips, trims, volume, music fades, and playback tied to scene/episode clocks. Studio Backup v5 includes audio bytes and checksums.
- M6.4 Speech & narration audio kind with optional Brightling/narrator attribution, a Voices lane, per-clip speaker selection, speech-aware default volume, and validation that blocks a voice clip running past its scene or episode end. Attribution is metadata only; no mouth or talking animation and no AI voice generation.
- M6.5 Intros section: reusable saved intros with series/episode titles, Plain or Banner style, an approved place background, Brightling entrance actions on the existing timeline, Audio Library music, preview, save and stable-ID reuse. An intro is a timed scene plus title text, so there is one animation engine and one audio clock.
- Studio Backup **version 6** now includes intros. Versions 1–5 remain readable; restoring an older backup keeps existing intros rather than clearing them.
- Complete Studio Backup export/import for current local data; older backup versions remain accepted. Browser storage can be cleared, so keep downloaded backups separately.

## Known bugs, limits and unverified work

- F1 protects episode drafts. Other editors do not yet have broader unsaved-change protection or undo/redo; that remains M7.7. The current Episode Maker has no visible in-editor switch to a different episode, though its opening helper is guarded.
- F2 exercised real MP3, OGG/Vorbis and OGG/Opus in isolated Chrome, including browser-graph sound capture. Karl's physical speakers, other browsers and subjective audio quality remain unverified.
- F4 now recovers normal interrupted restores across IndexedDB audio and localStorage before the editor mounts. Persistent storage or hardware failure still requires a separately downloaded Studio Backup.
- Global Max/Maxine outfit selection comes from the saved Playground scene; timed scenes have no per-scene outfit override. Custom Brightlings cannot yet use the flattened alternative outfit art while retaining their personal recolouring.
- The proposed five-outfit collection was not delivered. Only each default character's original and T-shirt alternative are integrated. Additional garments and poses need artwork review.
- Only the Living Room ships as an approved background. New uploaded backgrounds are user supplied; preview does not certify their artwork quality.
- Current Scene Maker has horizontal facing poses. Near-vertical travel retains the last horizontal facing direction. Its timeline is deliberately lightweight.
- M6.4 attribution carries no lip-sync or talking animation, and only Audio Library file formats are accepted; there is no in-app recording, text-to-speech or voice cleanup.
- M6.5 titles are canvas text only: no fonts, letter animation, logos or per-line styling. The intro action palette omits Disappear, so a character cannot yet walk off screen during an intro. Length is capped at 600s and titles at 120 characters.
- No credits, finished-video export, BrightBeats, camera, props, or broad undo/redo is implemented.
- F1 browser checks cover draft navigation and existing episode playback, not a new subjective review of animation or audio quality.

## Verification and evidence

- M6.4 on 17 October 2026: `npm test -- --run` **74/74 passed** across 15 files; `npm run build` **passed**. Isolated Chrome independently re-verified the full workflow against the production build: two genuine WAV voice fixtures imported as Speech & narration, Max dialogue with trim/volume in a scene, episode narration spanning both scenes, four playback samples each showing exactly one active player and zero at the 12.0s end, captured speech measured mean −24.5 dB / max −5.9 dB over 13.56s, reload retention, and a Studio Backup v5 round-trip into a second empty profile preserving both attributions. Zero console errors and failed assets; both disposable profiles removed. [M6.4 report](../proofs/m6-4/REPORT.md), [recording with sound](../proofs/m6-4/dialogue-episode.mp4), [browser observations](../proofs/m6-4/browser-results.json). Karl's batch review remains pending.
- M6.5 on 17 October 2026: `npm test -- --run` **89/89 passed** across 16 files; `npm run build` **passed**. Isolated Chrome verified the full intro workflow against the production build: titles and Banner style, both Brightlings with a Wave action, Audio Library music, four playback samples each with one active player until the 7.36s music ended, captured sound at mean −29.7 dB / max −12.1 dB, reload retention, and a Studio Backup v6 round-trip into an empty profile. Zero console/asset errors; both profiles removed. One UX defect (titles invisible at 0.0s) was found and fixed during verification. [M6.5 report](../proofs/m6-5/REPORT.md), [recording with sound](../proofs/m6-5/intro-playback.mp4), [browser observations](../proofs/m6-5/browser-results.json). Karl's batch review remains pending.
- Audit baseline on 17 October 2026: `npm test -- --run` **63/63 passed** across 13 files; `npm run build` **passed**. Git working tree was clean before these documentation edits. No Karl browser profile or saved data was touched in this audit.
- F1 on 17 October 2026: `npm test -- --run` **65/65 passed** across 14 files; `npm run build` **passed**; isolated Chrome profile removed; zero captured console errors or failed assets. [F1 report](../proofs/f1/REPORT.md), [desktop dialog](../proofs/f1/navigation-dialog.png), [mobile dialog](../proofs/f1/navigation-dialog-mobile.png), [browser observations](../proofs/f1/browser-results.json).
- F2 on 17 October 2026: genuine encoded MP3 (mono/stereo), OGG/Vorbis (mono/stereo) and OGG/Opus (mono) passed Chrome 155 import, preview, IndexedDB reload, scene/episode playback, normal Studio Backup export and fresh-profile UI restore. Invalid files were rejected; captured sound shows scheduled tones; zero console errors or failed assets; both profiles removed. `npm test -- --run` **65/65 passed** across 14 files and `npm run build` **passed**. [F2 report](../proofs/f2/REPORT.md), [recording with sound](../proofs/f2/episode-with-audio.mp4), [browser observations](../proofs/f2/browser-results.json). Karl's review remains pending.
- F3 on 17 October 2026: README/architecture/workflows audited, [user guide](USER_GUIDE.md) added, 46 local links checked with none missing, 65/65 tests and production build passed. Isolated Chrome opened all six sections with zero console/asset errors, empty storage and profile removed. [F3 report](../proofs/f3/REPORT.md), [browser observations](../proofs/f3/browser-results.json). Karl's batch review remains pending.
- F4 on 17 October 2026: cross-store restore coordinator added, [three interrupted browser cases](../proofs/f4/interrupted-results.json) recovered consistently with real MP3/OGG and episode references, and [normal browser UI backup restore](../proofs/f4/browser-results.json) passed with five real audio assets. Focused and full tests/build passed; zero console/asset errors; disposable profiles removed. [F4 report](../proofs/f4/REPORT.md). Karl's batch review remains pending.
- [M6.3 report](../proofs/m6-3/REPORT.md), [captured playback with sound](../proofs/m6-3/episode-with-audio.mp4), [browser observations](../proofs/m6-3/browser-results.json). Its isolated browser run recorded zero console errors and failed assets; Karl has now approved M6.3.
- [M6.2 report](../proofs/m6-2/REPORT.md), [M6.1 report](../proofs/m6-1/REPORT.md), [timed Scene Maker report](../proofs/m6/REPORT.md), and [wardrobe integration report](../proofs/milestone5b-final/REPORT.md) preserve earlier evidence and limitations.

## Handoff rule

Read [ROADMAP.md](ROADMAP.md), [ARCHITECTURE.md](ARCHITECTURE.md), [BATCH_REVIEW.md](BATCH_REVIEW.md), `AGENTS.md`, and the relevant proof report. Check `git status` before edits and preserve unrelated changes. Update this file after each milestone with actual status, tests, evidence, blockers and approval state. Continue only as Karl's temporary batch authorisation and technical verification allow.

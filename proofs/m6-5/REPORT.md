# M6.5 — Intro Maker

17 October 2026. **IMPLEMENTED — AWAITING KARL'S BATCH REVIEW.** Technical verification only; Karl's visual and listening acceptance is pending.

## Implementation summary

A new **Intros** Studio section creates reusable opening titles. An intro is stored as a timed scene plus title text, so it reuses the existing animation engine (`stateAt`), the existing Canvas preview renderer, the existing audio lanes and the existing playback clock. No parallel scene or animation engine was introduced.

- **Titles.** Series title and episode title, each up to 120 characters, plus a **Title style** of Plain or Banner. Titles are visible from the first frame so the editor never opens on a blank stage, and ease out over the final 0.8s.
- **Background.** Any place that has artwork, chosen from the existing Places library. The Living Room production image remains untouched and no new artwork was generated.
- **Characters.** Any Brightling can be added, dragged to a starting position at 0.0s, and given Appear / Walk In / Wait / Wave actions on the existing visual timeline. Disappear is deliberately omitted from the intro action palette to keep an intro from feeling like an ordinary scene.
- **Music.** The existing Audio Library Music lane, with drag-to-place start, trimming, fades and volume.
- **Reuse.** Intros are saved, listed with Open / Duplicate / Delete, and referenced by stable UUIDs so M6.7 assembly can attach the same intro to many episodes.

## Changed files

- `src/introductions.ts`: intro model, validation, storage key, title opacity.
- `src/IntroMaker.tsx`: the Intros library and editor.
- `src/scenePreview.ts`: `drawIntroPreview`, which wraps the existing `drawScenePreview` and adds title text.
- `src/studioBackup.ts`: **Studio Backup version 6** with an `intros` field and journal version 5.
- `src/App.tsx`: Intros section, `saveIntros`, intro/audio reference cleanup, backup export and import.
- `src/introductions.test.ts`, `src/style.css`, `.gitignore`, `proofs/m6-5/`.

## Backup compatibility

Studio Backup is now **version 6**. Version 1–5 backups remain readable and are not rewritten. A version 5 or older backup carries no intros, so restoring one **keeps** the intros already in the browser rather than clearing them; this is covered by a test. F4's crash-safe restore journal was extended to version 5 so an interrupted intro restore rolls back with the rest of the data.

## Test results

Full suite: **89/89 passed** across 16 files; `npm run build` **passed** (58 modules, 371.11 kB JS / 41.52 kB CSS). New coverage includes title and length validation, delegation of place/position/action/audio rules to the shared scene validator, voice-clip truncation refusal, title opacity, duplicate-id rejection, invalid-JSON handling, intro round-trip through a v6 backup, acceptance of a v5 backup, intro preservation when restoring a v5 backup, and rejection of an intro referencing a missing Brightling or audio file.

## Browser evidence

Isolated headless Chrome against the production build at `127.0.0.1:4177`. Full results in [browser-results.json](browser-results.json).

- Imported a genuine local WAV theme (ffprobe-confirmed `pcm_s16le`, 7.36s) into the Audio Library.
- Created an intro titled **The Little Living Room / Episode One: The New Sofa**, Banner style, 8 seconds, Living Room.
- Added Max and Maxine and gave Max a Wave action; all three actions persisted.
- Added the music clip; the Music lane, clip block, inspector and status all updated ([screenshot](intro-editor-full.png)).
- Saved, returned to the library, and confirmed the saved card ([screenshot](intro-library-saved.png)); reopened with all fields, cast and clips intact.
- Playback sampled at 1.0s, 3.0s, 5.0s and 7.5s, showing exactly one active audio player until the 7.36s music ended and zero at the 8.0s end. Captured output measured **mean −29.7 dB, max −12.1 dB**, confirming real browser sound.
- [Recording with sound](intro-playback.mp4) — H.264 + AAC stereo, 9.9s, showing titles over both approved Brightlings mid-playback. Source capture [intro-browser.webm](intro-browser.webm).
- Reload retained the intro; Studio Backup **version 6** carried the intro and its audio asset; import into a second **empty** profile restored the intro with its cast intact ([screenshot](intro-restored.png)).
- Zero console errors, zero failed asset requests, both disposable profiles removed. Karl's normal browser profile and saved data were untouched.

## Defect found and fixed during verification

The first implementation faded titles in from zero opacity, so opening a saved intro at 0.0s showed a blank stage — confusing for a beginner. Titles are now fully visible from the first frame and only ease out at the end. The regression test `shows titles from the first frame and eases them out at the end` locks this in.

## Known limitations

- Titles are canvas text only. There are no fonts, letter animations, logos, textures or per-line styling.
- No lip-sync or talking animation; intros use existing approved sprites unchanged.
- Intro length is capped at 600 seconds and titles at 120 characters.
- The intro action palette omits Disappear; an intro cannot yet animate a character off screen.
- One global outfit comes from the saved Playground scene, as with timed scenes. There is no per-intro outfit override.
- Subjective appearance of the titles and audio quality on Karl's speakers remain unverified.

## What Karl needs to check personally

1. Create an intro and confirm the titles, Banner and Plain styles read clearly for a child.
2. Confirm the title sizes and placement look right over the Living Room artwork.
3. Listen to [the recorded intro](intro-playback.mp4) and check music timing and volume.
4. Confirm the Intros section is easy to find and understand next to Scenes and Episodes.
5. Confirm the action choices (Appear / Walk In / Wait / Wave) are sufficient for an intro.

## Approval status

**AWAITING KARL'S REVIEW.** Technical verification is not Karl's approval.
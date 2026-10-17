# M6.6 — Credits Maker

17 October 2026. **IMPLEMENTED — AWAITING KARL'S REVIEW.** Technical verification only; Karl's visual and listening acceptance is pending.

## Implementation summary

A new **Credits** Studio section creates reusable end credits. It follows the M6.5 production model exactly: credits are presented to the existing scene renderer and the existing audio clock, so there is still one animation engine, one renderer and one clock in the app.

- **Credit lines.** Each line has an optional **heading**, a **name** and an optional **role/detail** — enough for creator and production credits, character and voice credits, music attribution and acknowledgements. Lines can be added, edited, deleted and reordered (Move up / Move down), with stable UUIDs so a saved credits sequence can be reused.
- **Beginner aids.** A "Add credit line" button, one-tap heading suggestions (Created by, Produced by, Characters, Voices, Music, Sound Effects, Places, Thanks to) and a line list that shows each entry as heading + name · role.
- **Presentation.** **Static** centres the credit list; **Scrolling** moves it upward at an adjustable speed (0.2–8 lines/s). Duration is adjustable (2–900s). Text is drawn on a darkened gradient band with a dark outline so it stays readable over any place artwork, with headings in gold, names in white and roles in a lighter tint.
- **Smart scroll.** If the requested speed would push the final credit off screen before the sequence ends, the speed is reduced automatically so the last credit always finishes on stage. A short credits list that already fits simply stays centred rather than drifting.
- **Background and music.** Any place with artwork; the existing Audio Library Music lane with trim, fades and volume, played on the credits clock.
- **Unsaved-edit protection.** A Saved / Unsaved changes indicator, a `beforeunload` guard, and a confirm prompt when leaving the Credits section with unsaved edits.
- **Reuse.** Saved credits are listed with Open / Duplicate / Delete and carry stable IDs, ready for M6.7 assembly.

## Changed files

- `src/credits.ts`: credits model, validation, storage key, scrolling/timing maths.
- `src/CreditsMaker.tsx`: the Credits library and editor.
- `src/scenePreview.ts`: `drawCreditsPreview`, which wraps the existing `drawScenePreview` background pass and adds the credit text.
- `src/studioBackup.ts`: **Studio Backup version 7** with a `credits` field; journal version 6.
- `src/App.tsx`: Credits section, `saveCredits`, credits/audio reference cleanup, backup export and import.
- `src/Characters.tsx`: restore confirmation now reports credits and intros.
- `src/credits.test.ts`, `src/style.css`, `.gitignore`, `proofs/m6-6/`.

## Backup compatibility

Studio Backup is now **version 7**. Versions 1–6 remain readable. A version 6 or older backup carries no credits, so restoring one **keeps** existing credits rather than clearing them (covered by a test). F4's crash-safe journal was extended to version 6 so an interrupted credits restore rolls back with the rest of the data.

## Test results

Full suite: **112/112 passed** across 17 files; `npm run build` **passed** (60 modules, 386.50 kB JS / 42.79 kB CSS). 23 new M6.6 tests cover credit-line validation, the requirement for at least one named line, duplicate line IDs, the line cap, duration and scroll-speed ranges, background availability, shared audio clip rules, duplicate saved IDs, invalid JSON, empty-storage handling, the scene-model hand-off, static centring, short-list hold, upward scroll, automatic slowing, row ordering and role omission, plus credits round-trip, older-backup acceptance, older-backup credits preservation and audio-reference rejection.

## Defect found and fixed during verification

The first implementation counted one row per credit line, but the renderer draws a heading row *and* a name row (two), so long credits scrolled with wrong timing maths. The row count now matches the renderer, and the "moves long scrolling credits upward over time" test fails against the old value.

## Browser evidence

Isolated headless Chrome against the production build at `127.0.0.1:4177`. Full results in [browser-results.json](browser-results.json).

- Imported a genuine local WAV theme (ffprobe-confirmed `pcm_s16le`, 5.22s).
- Created credits titled **Closing Credits / Thank You**, 12s, Living Room.
- Built four credit lines through the real UI — Created by / Voices / Music / Thanks to ([screenshot](credits-editor-static.png)).
- **Reorder verified:** moving the third line up changed the list from `Created by, Voices, Music, Thanks to` to `Created by, Music, Voices, Thanks to`.
- Added credits music at start 0; the Music lane and clip inspector updated ([screenshot](credits-editor-music.png)).
- **Static playback:** six samples each showing one active audio player, ending cleanly when the 5.22s music finished. Captured sound **mean −28.6 dB, max −12.0 dB**. [Recording](static-credits.mp4).
- **Scrolling playback:** same audio result (**mean −28.6 dB, max −12.1 dB**), with the credit list visibly moving upward between the [2.5s](credits-scroll-early.png) and [5.5s](credits-scroll-late.png) frames. [Recording](scroll-credits.mp4).
- Saved, returned to the library and reopened with all four lines, the music clip and the Saved indicator intact ([screenshot](credits-library-saved.png)).
- **Unsaved-edit protection verified:** editing the title showed **Unsaved changes**; attempting to leave with the confirmation cancelled kept the editor open with the edit intact ([screenshot](credits-unsaved-guard.png)); saving returned the indicator to **Saved** and then left cleanly without a prompt.
- Reload retained the credits; Studio Backup **version 7** carried the credits and audio asset; import into a second **empty** profile restored the credits with all four lines and its music clip ([screenshot](credits-restored.png)).
- Zero console errors, zero failed asset requests, both disposable profiles removed. Karl's normal browser profile and saved data were untouched.

## Known limitations

- Text only. There are no fonts, per-line colours, logos, images, star wipes or individual line animations.
- Scroll speed is uniform across the whole list; there is no easing in/out at the ends.
- Line height shrinks automatically on very long lists so text still fits; a very large list is therefore shown more compactly.
- Credits have no characters. A credits sequence cannot show a Brightling waving while credits scroll.
- Credits are not yet attached to an episode; that assembly is M6.7.
- Subjective appearance and audio quality on Karl's speakers remain unverified.

## What Karl needs to check personally

1. Create credits and confirm the credit line editor is easy to understand for a child.
2. Try Static and Scrolling, and check text size and readability over the Living Room artwork.
3. Listen to [the recorded credits](scroll-credits.mp4) and check music timing and volume.
4. Confirm the heading suggestions cover the credits Karl actually wants.
5. Confirm the unsaved-changes warning feels right rather than annoying.

## Approval status

**AWAITING KARL'S REVIEW.** Technical verification is not Karl's approval.
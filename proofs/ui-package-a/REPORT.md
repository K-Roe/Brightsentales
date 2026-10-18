# Music Studio polish — Package A

18 October 2026. Implemented under Karl's explicit approval. Technical checks passed; Karl's visual and listening acceptance is pending.

## Changes

- The Music Studio main area uses the available desktop width. A 340px instrument rail sits beside the editor when space permits and stacks below 1200px.
- Instrument controls collapse independently; selecting a track still opens its notes. The editor has a persistent selected-note inspector, keyboard-reachable note list, pitch/start/length/velocity fields, and note-only Undo/Redo buttons and shortcuts. Pointer drags commit one history entry at release. History is in memory and does not enter the song schema.
- The transport reports Preparing, Playing, Paused and Stopped. A project edit stops a stale preview; it still renders a WAV through the existing HTMLAudioElement path.
- No changes were made to `instruments.ts`, `musicRender.ts`, `musicProject.ts`, `musicAssets.ts`, `wav.ts`, `studioBackup.ts`, or their saved formats.

## Verification

- Before Package B, the focused note-history tests passed 2/2, the full suite passed 149/149, and the production build passed.
- In disposable headless Chrome at a 1600px window, the [browser script](verify.mjs) checked collapse/expand, note creation, Undo/Redo, drag grouping (beat 6.25 to 7.25 and one undo back to 6.25), save/reopen, playback entering Playing, export to the Audio Library, and a Studio Backup v8 UI export/import with one editable song and one WAV asset. The page did not overflow. See the [editor screenshot](editor-dark.png).
- The final full suite after both packages passed 151/151; the production build passed.

## Limits

- Browser playback reached Playing and WAV export completed. This follow-up did not capture loopback sound or obtain Karl's listening review.
- The Backup v8 UI round-trip used the same disposable browser profile; existing backup tests cover version compatibility. A fresh-profile round-trip was not repeated in this package.
- The song SHA-256 equality issue predates this work and remains unresolved; see the [Package B report](../ui-package-b/REPORT.md).

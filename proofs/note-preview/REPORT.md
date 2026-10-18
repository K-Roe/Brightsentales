# Beginner Note Preview — implementation review

18 October 2026. Scope: approved Music Studio usability feature only. Karl's listening acceptance is pending.

## Delivered

- Piano keys audition immediately with the selected track's instrument. Focus the roll, use Up/Down to choose a key, and Enter/Space to hear it. The active key lights up briefly. The instrument picker has a separate Try button for every instrument, available before any notes are added.
- Adding a note auditions it. Moving a note vertically changes pitch and previews each new pitch at a limited rate; the completed drag remains one note-history action. The selected-note inspector has a Hear note button. Pitch-field edits also audition changed pitches.
- One live audition voice plays at a time. The previous output fades in 15 ms, and the preview disconnects after 750 ms. Starting song playback stops an audition; auditions are suppressed while the song is preparing or playing. Live auditions use `scheduleNote` from the existing instrument engine. No audio engine, project model, save schema or backup format changed.
- The keyboard labels all chromatic notes with sharp/flat equivalents, marks middle C, and shows the selected note's full name and octave. Optional scale guidance starts at C major; C major, G major, F major and A minor are available. The guide can be switched off and never blocks a note.

## Verification

- `npm test`: 153/153 passed across 21 files.
- `npm run build`: passed, including TypeScript and Vite.
- Isolated Chrome script `verify.mjs`: C4 click and keyboard audition, Piano/Guitar timbre difference in picker and after track switch, instant add preview, vertical drag preview, drag Undo/Redo, selected-note audition, scale shading on/off, saved-state unchanged by audition, save/reopen, song playback, generated Audio Library WAV, Studio Backup v8 export/import, and zero captured console errors. [Raw observations](browser-result.json).
- [Dark screenshot](dark.png) and [Light screenshot](light.png) show the piano roll, note labels and theme treatment. Both were captured from a disposable browser profile.
- The older Package A browser script uses a fixed click coordinate and fails after the guidance row changes editor height. The current feature script targets the roll directly and passes the same save/play/export/backup regressions.

## Limits and acceptance

- Chrome automation verifies Web Audio voice creation and UI behavior, not sound heard through Karl's speakers. Karl needs to listen to C4, change instruments, add and drag notes, then accept the sound and volume.
- Existing song SHA-256 byte equality remains unresolved; the offline audio engine was not changed here.
- M6.7 and Beat Blocks were not started.

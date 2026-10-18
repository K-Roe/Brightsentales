# M6.6B — Music Studio UI redesign

17 October 2026. **Implemented; awaiting Karl's visual and listening review.** M6.7 and Beat Blocks were not started. Beat Blocks remain in M7.0 BrightBeats.

## Implemented

- Scoped dark and light Music Studio themes, dark by default, with a locally saved preference. Both themes cover Music Maker, Sound Effects Maker, mixer, instrument picker, confirmation overlay, forms, scrollbars, focus states and tooltips.
- Colourful inline SVG instrument and effect icons; instrument-coloured cards and piano-roll notes; visible keys, named drum rows, beat divisions and Compact/Normal/Big zoom.
- Larger transport with playhead, pause/resume and stop. The preview still uses the existing rendered WAV and `HTMLAudioElement`; no synthesis, mixer, saved-project or Backup schema code changed.
- Confirmation before a starter melody or drum pattern replaces existing notes. Save state now reflects the stored song.

## Verification

- `npm test -- --run`: **147/147 passed** across 18 files. `npm run build`: **passed**. Documentation link check: **92 local links, none missing**.
- Isolated Chrome browser check: **passed**, with zero console errors or failed assets and both disposable profiles removed. It reopened an M6.6A-format song, edited notes by mouse, previewed a piano key and a song, tested pause/stop/loop, mixer controls, all three zoom levels, cancel/confirm for preset replacement, render to Audio Library and replay, sound-effect preview/export, theme persistence, focus and reduced motion, narrow layout, and a fresh-profile Studio Backup v8 restore of editable projects and WAV assets. See [browser observations](browser-results.json).
- Review screenshots: [dark studio](02-legacy-song-dark.png), [dark drum roll](03-drum-track-dark.png), [dark piano roll](05-note-added-dark.png), [dark picker](08-instrument-picker-dark.png), [dark confirmation](09-overwrite-confirm-dark.png), [light Sound Effects Maker](13-effects-light.png), [light piano roll](14b-roll-light.png), [light picker](15-picker-light.png), [narrow light layout](16-narrow-light.png).
- Audio comparison used the same musical settings before and after; randomly generated project/note IDs differ but all other project fields match. The effect WAV was **byte-identical**: SHA-256 `4ee18aeffd8c1c4eba7b72f1a603a9d3743e282bbccc871abfba3e3eda95f8fc` before and after. The song WAV was **not byte-identical**: SHA-256 `86ddbe58fa70d742df50be28e102e15d157ba69b53860b87f4f3e99176838a52` before and `bd1be98b8296787825b6f90c88cacca6f997d30def4bab6d25a794d4eb3c156a` after. Of 1,023,120 PCM samples, 278 differ by at most one 16-bit step (0.027%). Two independent redesigned-build renders also differed by at most one step in 590 samples (0.058%). This repeat variation means the required song SHA-256 equality **failed**; the UI change cannot be certified byte-identical from these renders. See [comparison](compare_renders.py) and `render-*.wav`/`audio-hash-*.json` here. The audio engine was preserved as directed.

Karl's final visual and listening acceptance is pending. The exact-byte song rendering requirement remains unresolved within the authorised UI scope.

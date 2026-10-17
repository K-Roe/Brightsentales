# M6.6A — BrightTales Music & Sound Effects Studio

17 October 2026. **IMPLEMENTED — AWAITING KARL'S REVIEW.** Technical verification only; Karl's listening and visual acceptance is pending.

## Implementation summary

The Audio Library is extended by a new **Music Studio** section. Everything is synthesised locally with browser-native Web Audio, stored offline, and finished compositions become ordinary Audio Library assets, so they work everywhere the Audio Library already works.

### Music Maker

- **Piano-roll editor** with multiple tracks. Click empty space to add a note, drag a note to move it, drag its right edge to resize, and delete it from the note editor. Pitch, length and velocity are all adjustable.
- **Eight instruments:** piano, guitar, violin, flute, xylophone, bass, drums and synth. Each is synthesised from oscillators, filters and envelopes — no bundled samples, no downloads.
- **Tempo, bars, looping, master volume** and per-track **volume, pan, mute and solo**.
- **Play, pause and stop**, plus **click a pitch label to audition** that note on the current instrument.
- **Beginner starters:** four melodies (Twinkle melody, Up and down, Happy bouncy, Calm and slow) and three drum patterns (Steady beat, Marching, Kick and clap).

### Sound Effects Maker

- Seven presets: **footstep, pop, bounce, sparkle, whoosh, bell and cartoon transition**, each built from oscillators, deterministic noise and envelopes.
- Adjustable **pitch, length, volume, tail (decay) and a noise layer**, with preview.

### Multi-track mixer

- Layers instruments, mixes them with independent per-track level and pan, mute and solo, plus a master volume.
- **Soft limiter:** samples below the threshold pass through completely unchanged, so levels the user dialled in are preserved; louder peaks ease toward full scale instead of hard-clipping. A `DynamicsCompressor` catches the remainder.
- The rendered result is checked for audibility before being offered to the Audio Library, and the measured peak is shown in the UI.

### Save, reuse and backup

- Songs and effects save with names and stable IDs; both support reopen, edit, duplicate, rename and delete.
- **Add to Audio Library** renders the project to a 16-bit PCM WAV and stores it as a normal `AudioAsset`, ready for scenes, intros, credits and future episode assembly.
- Editable source projects are included in Studio Backup as **version 8**.

## Changed files

- `src/wav.ts`: deterministic PCM WAV encoder/decoder, mono mixdown, peak metering.
- `src/instruments.ts`: the eight instrument voices, MIDI/frequency mapping and the shared deterministic noise buffer.
- `src/musicProject.ts`: project, track and note model, validation, beat/tempo maths, mute/solo rules and beginner starters.
- `src/musicRender.ts`: offline `OfflineAudioContext` rendering, soft limiter and sound-effect synthesis.
- `src/musicAssets.ts`: renders a project into a normal Audio Library asset.
- `src/MusicStudio.tsx`, `src/previewPlayer.tsx`: the Music Studio UI and preview transport.
- `src/studioBackup.ts`: **Studio Backup version 8** with a `projects` field; journal version 7.
- `src/App.tsx`: Music Studio section, project storage, rendered-asset storage.
- `src/musicProject.test.ts`, `src/style.css`, `.gitignore`, `proofs/m6-6a/`.

## Architecture and reuse

- **No new playback engine.** A rendered composition is a standard `audio/wav` `AudioAsset`, played by the existing audio clock in scenes, episodes, intros and credits. The in-studio preview plays the *same* rendered bytes through an `HTMLAudioElement`, which is the same element type the existing clock uses.
- **Deterministic rendering.** Rendering always uses `OfflineAudioContext` at a fixed 44100 Hz, and the noise source is a seeded LCG rather than `Math.random`. The future video exporter can therefore re-render byte-identical audio instead of re-synthesising live.
- Everything is local. No cloud, no AI, no bundled sample packs, no network calls.

## Test results

Full suite: **147/147 passed** across 18 files (32 new M6.6A tests); production build **passed** (67 modules, 421.27 kB JS / 46.27 kB CSS); 80 documentation links valid.

New coverage includes: WAV stereo round-trip, header correctness, clamping instead of wrapping, mono/peak metering; the eight instruments, pitch/frequency mapping both ways, note naming, note tails; project validation (tempo, bars, name, loop, track cap, duplicate track IDs, notes outside the bar range, bad pitch/velocity/duration, unknown instrument, volume and pan ranges, duplicate note IDs); effect validation (unknown preset, pitch, duration, decay); library handling (missing storage, invalid JSON, duplicate IDs across music and effects); beat/second conversion; mute and solo semantics; snapping and clamping; transpose limits; starter content; the soft limiter (never exceeds ±1, leaves a quiet mix untouched, compresses loud peaks without inverting them); and Studio Backup round-trip, v7 acceptance, older-backup project preservation and malformed-project rejection.

## Browser evidence

Isolated headless Chrome against the production build at `127.0.0.1:4177`. Full results in [browser-results.json](browser-results.json). Audio levels are measured from the browser's own output graph, not from UI state.

- **Original multi-instrument melody created through the real UI.** "Living Room Theme", 104 BPM, 4 bars, three tracks: Piano (7 notes, "Happy bouncy"), Bass (9 notes, "Up and down"), Drums (4 notes, "Kick and clap") — [screenshot](music-maker-tracks.png) and [piano roll](music-piano-roll.png). The piano roll was verified by reading its pixels: 320 note pixels present, and the drum notes are confirmed drawn at C2/C#2 after the range fix below.
- **Independent levels:** bass volume set to 0.35 and piano pan to −0.3 were confirmed in the mixer state.
- **Audible preview:** mean **−31.1 dB**, peak **−8.5 dB**, one active player at all six samples — real sound, not silence.
- **Saved, then rendered into the Audio Library:** "Living Room Theme", 11.2s, `audio/wav`, measured render peak **0.38** (well below clipping) — [screenshot](music-rendered.png).
- **Custom sound effect created and saved:** "Cartoon Door Slam" from the bounce preset, pitch −3, 0.9s, volume 0.6 — [screenshot](effects-editor.png). Preview measured mean **−31.1 dB**, peak **−6.4 dB**.
- **Both play through the existing Audio Library integration.** Previewing each generated asset from the Audio Library page produced mean **−30.5 dB / peak −8.4 dB** for the song and **−31.1 dB / peak −6.4 dB** for the effect, confirming they are ordinary library assets.
- **Mixer verified end to end:** muting the Drums track changed its row to `silenced`, its label to "Drums · 4 notes · muted", and the saved project recorded `muted: 1`.
- **Reload then edit:** the saved song was reopened after reload, the tempo was changed to 120 and the drums muted, and both changes persisted.
- **Backup v8 round trip:** the backup carried the editable song (3 tracks, 20 notes), the effect, and both generated WAV assets. Import into a second **empty** profile restored all of them; the restored song was reopened and previewed at mean **−33.4 dB**, peak **−17.0 dB** — [screenshot](music-restored.png).
- Zero console errors, zero failed asset requests, both disposable profiles removed, script exit code 0. Karl's normal browser profile and saved data were untouched.

## Defects found and fixed during verification

1. **Drum notes were invisible in the piano roll.** The visible pitch window started at MIDI 48, but drum notes sit at 36–38, so every drum pattern was drawn off-canvas and a drum track always looked empty. The window now starts at 36, and the roll auto-scrolls to the selected track's notes.
2. **Auto-scroll initially did nothing.** The effect keyed only on the track id, so adding notes to the selected track did not trigger it. It now also depends on the note count. Verified `scrollTop` moves from 0 to 264.
3. **The soft limiter was boosting quiet audio by ~31%.** Normalising by `tanh(drive)` changed the level a user had deliberately set. The limiter is now transparent below a 0.7 threshold; a test asserts a quiet mix is bit-for-bit unchanged.
4. **Studio layout clashed with existing styles.** Reusing the Scene Maker's setup grid produced cramped labels and an oversized Loop checkbox. The studio now has its own `music-setup` grid.

## Known limitations

- **Layering imported or previously rendered audio inside the studio is not implemented.** The mixer mixes the project's own instrument tracks. Placing finished or imported audio on a timeline with trim, fades and looping is already provided by the existing Audio Panel in every scene, intro, episode and credits, so generated and imported audio can be combined there — but not inside the Music Studio's own timeline.
- The studio's timeline arranges **notes**, not audio files. There is no audio-file track type.
- Instruments are synthesised approximations, not sampled instruments. They are recognisable and consistent, but a Karl will hear them as simple cartoon tones.
- Rendered WAV files are uncompressed, so a long song uses significant browser storage (a 11.2s stereo render is about 1.9 MB). No MP3/AAC compression is applied to generated audio.
- Maximum 12 tracks per song, 64 bars, 2000 notes per track.
- The piano roll shows MIDI 36–84; notes outside that window are placed but not visible without editing values.
- Sound effect presets are fixed algorithms; only pitch, length, volume, decay and a noise toggle are adjustable.
- Solo affects every track at once; there is no per-track level meter in the UI.
- Loop is an on/off toggle for preview and render length; there is no loop-region selection.
- Subjective musical quality and audio quality on Karl's speakers remain unverified.

## What Karl needs to check personally

1. Create a song using the starter melodies, then try clicking out a rhythm of your own.
2. Listen to each instrument and confirm the eight sound acceptable as cartoon music.
3. Try the Sound Effects presets and adjust pitch and length.
4. Mix two tracks with volume, pan, mute and solo, and confirm the levels behave as expected.
5. Render a song, then place it in a scene, intro or credits and confirm it works there.
6. Confirm the Music Studio is understandable for a child or beginner.

## Approval status

**AWAITING KARL'S REVIEW.** Technical verification is not Karl's approval.
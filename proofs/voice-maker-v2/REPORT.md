# Voice Maker V2 - Verification Report

**Date:** 2026-10-26
**Repository:** `C:\Users\karlr\repos\brightsenappstales`
**Branch:** `main`
**Status:** Technically verified by automated checks; Karl's microphone, visual and physical listening acceptance remains pending.

## Implementation

Voice Maker V2 extends the existing Record Voice tab and editor.

- Microphone selection, browser permission/device errors, recording timer, level meter, explicit Record/Stop/Play/Record again controls, finalization state, size/duration bounds and cleanup for media tracks, AudioContext and object URLs.
- Interactive waveform with a playback cursor, click/drag selection and visible handles. Exact keyboard-editable selection times are available alongside the existing trim fields.
- Selection playback, Trim to selection, Cut selection, Reset selection, Undo, Redo and Reset edits reuse the original-time `trimStart`, `trimEnd` and `cuts` effect fields.
- Preview requests are asynchronous, local and revision-gated; edits invalidate old results. The saved original is separate from the processed preview.
- Optional 0-1 noise-reduction strength maps to FFmpeg's existing local `afftdn` filter. It is previewed with the rest of the existing effect chain and is not live or destructive to the original.
- Save Voice creates a separate speech AudioAsset with the chosen Narrator/Brightling speaker ID, through the existing Audio Library path. Existing scene references and Backup v1-v8 formats are unchanged.
- Older custom presets that predate `noiseReduction` remain valid and default to no noise reduction.

Key files: `src/VoiceMaker.tsx`, `src/voiceEditing.ts`, `src/voiceAssets.ts`, `src/voiceSettings.ts`, `src/voice-studio.css`, `voice_local.py`, `test_voice_local.py` and their tests.

## Automated results

| Command | Result |
|---|---|
| `npm test -- --run` | **377/377 passed**, 55 test files |
| `npm run test:service` | **17/17 passed** (voice lifecycle, audio relay and Unity Editor control). The busy-but-healthy case took 29.43s and passed; total 47.04s. |
| `npm run build` | **Passed**. Vite reports the existing advisory for the approximately 704 kB JavaScript chunk. |
| `py -3.12 test_voice_local.py` | **7/7 passed**, including optional denoise bounds, source-byte preservation and duration. |

The new Studio tests cover selection boundaries, timeline mapping, trim/cut behavior, recording MIME/empty chunks, stopping capture and releasing all tracks, stale processing rejection, separate original/edit asset IDs and Audio Library limits. Existing Backup tests also passed in the complete suite.

## WAV inspection

A deterministic synthetic speech-like sine plus seeded noise was processed locally at noise-reduction strength 0.5. FFprobe reported:

- Input: PCM signed 16-bit little-endian, mono, 44.1 kHz, 2.000000 seconds.
- Output: PCM signed 16-bit little-endian, mono, 44.1 kHz, 1.997279 seconds.

Metadata and SHA-256 values are in [`noise-reduction-ffprobe.json`](noise-reduction-ffprobe.json). The input and output WAVs are explicitly synthetic test fixtures, not a microphone capture or Studio GUI recording: [input](noise-reduction-input-synthetic.wav), [output](noise-reduction-output-synthetic.wav). The measured 2.7 ms duration difference is FFmpeg filter timing precision for this synthetic clip; no human audio quality conclusion is drawn.

## Browser and human verification

An isolated disposable-browser workflow was not available in this environment, and microphone hardware/access was not exercised. Therefore this report does not claim a GUI recording/save/reopen run, screenshots, microphone acceptance or physical listening. The shared Browser controller requires a Node REPL JavaScript tool that was not available in this session. Karl should complete the steps below in his normal Studio launch after reviewing the browser permissions prompt.

## Manual review steps for Karl

1. Start BrightTales normally with `npm run dev` (or the production launcher `npm start`) and open **Voice Maker > Record Voice**.
2. Choose a microphone and speaker, press **Record**, speak for a few seconds, confirm the timer/level meter, press **Stop**, then press **Play recording**.
3. Press **Continue to edit**. Drag-select an unwanted phrase and press **Cut selection**; use exact selection fields to check keyboard access. Try **Undo**, **Redo**, **Reset selection** and **Reset edits**.
4. Set a mild noise-reduction strength and another effect. Press **Preview edited voice** and compare **Play original** with **Play edited** through speakers or headphones.
5. Choose a speaker, name the edit, press **Save Voice**, confirm the original and separate edited asset appear in Voice Library, then reload Studio and confirm both still appear and can be previewed.
6. If desired, assign the saved speech asset to a scene or episode using the existing Audio Library controls. Export/import a Studio Backup to confirm both assets survive Backup v8.
7. Optionally deny microphone permission or disconnect the microphone; confirm the plain guidance appears, then restore permission/reconnect and retry. With the local service unavailable, confirm recording and original playback still work while effect preview explains the service requirement.

## Known limitations and acceptance gates

- Browser-level MediaRecorder/device behavior and browser-specific MIME support still need Karl's application review; automated helper tests are not hardware verification.
- Noise reduction uses FFmpeg `afftdn` automatic noise-floor tracking and offers a strength control. It is intended for steady background noise; it is not a trained speech-restoration model, and the source cannot be heard here for quality acceptance.
- Processing effects are asynchronous. There is no claim of real-time effect playback.
- No cloud voices, cloning, voice training, model downloads, new renderer or new storage schema were introduced.
- Karl's microphone, visual and physical listening acceptance is **PENDING**. Existing Voice Maker V1/V1.1 review gates remain pending as well.

## Git

The implementation is on canonical Studio `main`. Implementation commit: `39226eb` (`feat: improve voice recording and editing`). The report and project documentation are committed separately so this report can identify the implementation checkpoint. No Unity repository or unrelated local files were modified.

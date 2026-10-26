# Voice Maker V2 - Recording and Editing Studio

**Status:** Implemented on Studio `main`; automated technical verification passed. Karl's microphone, visual and listening acceptance is pending.

## Existing architecture reused

- `VoiceMaker.tsx` remains the single owner of the three existing tabs, browser recording, waveform/editor controls, AI generation and Audio Library view.
- `MediaRecorder` and `getUserMedia` capture directly in the browser. Stream tracks, analyser `AudioContext`, animation frame and playback object URLs are stopped or revoked on stop, failure and unmount.
- `voiceEditing.ts` contains bounded timeline selection, trim/cut application, recording MIME selection, empty-capture rejection, track cleanup and async revision gating.
- `voiceSettings.ts` keeps the existing effect/preset model. `noiseReduction` is an optional 0-1 setting for legacy persisted presets and defaults to zero.
- `voice_local.py` applies FFmpeg `afftdn` during existing asynchronous local effect processing. No second processing path or cloud service was added.
- `voiceAssets.ts` validates and constructs new bounded speech `AudioAsset` records. Original blobs are not mutated; both original and edit use the existing IndexedDB Audio Library and Backup v8 mechanisms.

## Editing and safety behaviour

Waveform drag selects time on the original recording clock. Numeric start/end fields provide precise keyboard-accessible editing. The same selection can be played, applied as trim, or added to the existing cuts list. Trim/cut, settings changes, Undo/Redo and source changes invalidate earlier processing tickets and stop stale preview playback. Settings changes clear the old processed preview. Reset Edits creates a normal undoable edit; it never changes the source.

Recording uses a selected/default microphone, elapsed timer and RMS level meter where AudioContext permits. It stops at ten minutes or twenty MB, validates non-empty supported encoded chunks, reports permission/device/encoding/decode failures, and prevents replacing an unsaved take without an explicit Record again action. Recording and original playback remain available while the managed Python voice service is unavailable; effects and noise reduction require that service and run only when preview is requested.

## Verification checklist

- Full Vitest suite and production build.
- Voice service, audio relay and Unity Editor service regressions.
- Python FFmpeg effect suite, including noise reduction bounds, output duration, output difference and source preservation.
- Backup v8 and old custom-effect-preset compatibility through the full Studio tests.
- Synthetic WAV metadata inspection using FFprobe.
- Isolated browser microphone UI/save/reopen workflow: not run because an isolated browser-control runtime and microphone session were unavailable. No GUI screenshot or human listening result is claimed.

See [`proofs/voice-maker-v2/REPORT.md`](../proofs/voice-maker-v2/REPORT.md) for exact commands, outputs, limitations and Karl's review steps.

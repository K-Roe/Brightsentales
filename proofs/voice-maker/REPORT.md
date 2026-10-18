# Voice Maker V1 - technical evidence

18 October 2026. Scope: `brightsenappstales` only. Implemented for Karl's visual, microphone and speaker review; Karl has not accepted the feature yet. [Audit and plan](../../docs/VOICE_MAKER_V1_AUDIT.md).

## Delivered

- Three Voice Maker tabs: local AI speech, microphone recording or WAV/MP3/OGG import, and a waveform editor. The local service discovers installed Piper/Kokoro models; no model was downloaded. British Piper `en_GB-alan-medium` and Kokoro `bf_alice` each generated real WAV samples.
- The editor preserves original assets and saves a separate processed WAV. It supports trim, multiple cuts with short join crossfades, independent pitch and tempo, EQ tone, volume, normalization, start/end fades, echo, reverb, robot modulation, effect presets and editor Undo/Redo. Seven built-in presets have different settings; custom presets are validated, persisted and usable on later imports.
- Speech assets use the existing IndexedDB Audio Library, attributed scene clips, scene playback and Backup v8. Optional narrator/Brightling default voice and effect settings live in validated local settings. Older v8 backups without these settings retain existing voice preferences.
- Speech can automatically extend a scene (up to one hour). Scene-only WebM export draws through the existing scene preview and mixes saved voice/music/effect clips on the scene clock through a shared output limiter.
- The Voice Maker uses the shared Dark/Light/System tokens. No Music Studio synthesis, song schema, M6.7 assembly, Chatterbox, cloning, training or new lip-sync path was changed.

## Files changed

- Voice generation/editor: `voice_local.py`, `src/VoiceMaker.tsx`, `src/voiceApi.ts`, `src/voiceSettings.ts`, `src/voice-studio.css`, `vite.config.ts`.
- Existing Studio integration: `src/App.tsx`, `src/AudioPanel.tsx`, `src/SceneMaker.tsx`, `src/sceneVideoExport.ts`, `src/audio.ts`, `src/studioBackup.ts`, `src/main.tsx`.
- Verification/continuity: `test_voice_local.py`, `src/voiceSettings.test.ts`, `src/studioBackup.test.ts`, `proofs/voice-maker/`, `README.md`, `AGENTS.md`, `docs/VOICE_MAKER_V1_AUDIT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/PROJECT_STATUS.md`, `docs/BATCH_REVIEW.md`.

## Verification

| Check | Result |
| --- | --- |
| Vitest | 156/156 passed across 22 files, including preset validation and Backup v8 voice settings compatibility. |
| Python audio tests | 5/5 passed: separate/overlapping cuts, click-reducing join, independent pitch/speed and measured pitch change, plus distinct PCM output for all seven effect families. |
| Production build | `npm run build` passed, 79 modules transformed. |
| Installed synthesis | Real Piper and Kokoro British voice WAVs generated. The browser flow generated Max dialogue with Piper. |
| Isolated Chrome flow | Generated/saved speech; imported an original; saved, previewed, duplicated, deleted and reused a custom preset on that second source; edited pitch, speed and tone; Undo/Redo; saved new speech; added music and two attributed voice clips; played/saved the scene; exported a WebM; exported/restored Backup v8; simulated microphone denial and saw a clear error. Disposable Chrome profile removed. Zero captured renderer exceptions/log errors. [Machine-readable result](browser-results.json). |
| Director/scene audio | Max speech retained `speakerId=max` and extended a one-second scene to four seconds. The Scene Maker playback clock advanced; the final scene has background music plus generated and edited dialogue. |
| Rendered media | [Scene WebM](scene-with-voices.webm) decoded fully with FFmpeg: VP9 video 196 frames; Opus audio 136 frames, 8.16 seconds decoded audio. [Extracted audio](scene-audio.wav) had nonzero RMS in every second, including the music tail; PCM peak 0.831 of full scale. [Frame at 1 s](scene-frame-1s.png) and [frame at 5 s](scene-frame-5s.png) were inspected. |
| Themes | [Dark](voice-dark.png) and [Light](voice-light.png) screenshots inspected; System resolved to Light in the isolated browser. |

## Review files

- [Generated Piper speech](Max_dialogue.wav), [edited imported speech](piper-british-sample_cartoon.wav), [Kokoro British sample](kokoro-british-sample.wav), [scene audio](scene-audio.wav).
- [Scene audio timeline screenshot](scene-voices.png), [Dark Voice Maker](voice-dark.png), [Light Voice Maker](voice-light.png).
- `verify.mjs` reproduces the isolated browser path; `test_voice_local.py` and `src/voiceSettings.test.ts`/`src/studioBackup.test.ts` cover the processing and storage seams.

## Limits and Karl's manual acceptance

- A real microphone and physical speaker were unavailable to this automated run. Karl should start `py -3.12 voice_local.py`, open the Studio, record his own voice, stop/retry, compare original and processed playback, and listen to each built-in preset. He should listen to the generated Piper/Kokoro lines and the rendered WebM on his speakers. Simulated microphone permission denial passed; hardware/device selection was not exercised.
- The target repository has a Scene Maker director panel, not the separate Python BrightTales Director. Integration and rendered evidence cover this repository's scene production path. Full episode assembly/export remains M6.7/M6.8; the new scene export is limited to 120 seconds and browser WebM support. No mouth animation exists here.
- Only Chrome and representative Piper/Kokoro models were exercised. Other installed models and browsers are listed but were not individually synthesized. The local service and installed Python packages/models/FFmpeg must be present for generation and effects; no cloud fallback exists.
- MediaRecorder WebM may omit container duration metadata in some players; FFmpeg decoded all frames and audio, but seeking in other players was not verified.

**Acceptance:** technical workflows verified; Karl's visual, microphone and listening checks are pending.

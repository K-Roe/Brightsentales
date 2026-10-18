# Voice Maker V1 audit and implementation plan

18 October 2026. Approved scope: `C:\Users\karlr\repos\brightsenappstales` only. No Chatterbox, cloning, training or imitation.

## Current architecture

- This repository is a browser-based React/Vite 2D Studio. It is separate from `C:\Users\karlr\repos\BrightTales`, whose Python Voice Maker/Director implements Piper and Kokoro. No Piper/Kokoro call, local service, microphone workflow, voice editor or final video export exists here today.
- On this machine, Python 3.12 has `piper`, `kokoro_onnx` and `onnxruntime`; `piper.exe` and FFmpeg/FFprobe are on PATH. The sibling BrightTales model directory has 53 Piper ONNX models, 11 British English models including male/female names, and `kokoro-v1.0.onnx` plus `voices-v1.0.bin`. No model download is needed. Availability must be checked again at runtime; a file's presence alone does not prove synthesis works.
- No required Piper configuration pair or Kokoro model/bank is missing from the discovered local inventory. Voices absent from that inventory are unavailable in V1; the picker lists only locally discoverable entries. Representative British voices were synthesized in verification, while the other installed models were not individually exercised.
- `audio.ts` defines `AudioAsset` and attributed `AudioClip`; `audioStore.ts` persists blobs in IndexedDB and includes them in checksum-verified Studio Backup v8 through `restoreCoordinator.ts`. `AudioLibrary.tsx` previews/imports/deletes assets. `AudioPanel.tsx` adds speech clips with narrator or Brightling targeting; `audioPlayback.ts` mixes scene and episode clips on the current clock.
- `TimedScene` stores duration, character actions and optional audio. The current scene validator rejects attributed speech extending beyond the scene rather than extending duration. `SceneMaker.tsx` previews through `drawScenePreview` and `useAudioPlayback`. This repository has no mouth animation and no production video exporter; M6.8 remains unstarted.
- The app uses shared `--ui-*` semantic tokens with Dark/Light/System preference; new UI must use those tokens. Brightling records currently contain identity/colour only, so voice defaults need a compatible optional field or adjacent validated settings keyed by stable character ID.
- `validAudioInfo` caps an asset at 20 MB and Backup v8 at 100 assets. Recording/render lengths and error states must respect these limits.

## Implementation sequence

1. Add a narrow loopback voice service in this repository. It uses the already installed Piper/Kokoro Python libraries and existing model files read-only, lists installed models with their configuration files, serves the built app, and accepts bounded synthesis/processing requests. No download or external account. The app shows explicit unavailable/model-error states when it is run without the service.
2. Add Voice Maker tabs for AI Voices, Record Voice and Voice Editor. Capture microphone audio with permission/device handling; import supported files; save originals to the existing speech asset store. Use FFmpeg locally for trim/cuts, independent pitch/tempo, EQ, echo/reverb, fades, normalisation and limiting; preview and save processed WAV as a new asset. Keep edit state undoable and originals immutable.
3. Add built-in audible presets and validated user presets with persistence and Backup v8 compatibility. Add Voice Library actions through the existing Audio Library asset path, including edit/duplicate/delete without mutating originals. Add optional Brightling voice/preset defaults and narrator selection without forcing speech or lip animation.
4. Extend the scene audio workflow to generate/attach speech with the chosen speaker and extend scene duration when needed. Keep speaker IDs and music/effect mix on the existing clip path. Add a bounded scene video export that draws frames through the existing scene renderer and includes the same clips in the exported audio track; do not create a second scene model.
5. Verify Piper and Kokoro with installed British voices, real recording or import, transformed WAV data, preset persistence, IndexedDB reload, Backup v8 export/restore, Dark/Light/System, zero browser errors, and a decoded isolated scene video with audible generated and edited dialogue. Mark physical microphone/speaker quality checks for Karl.

## Main risks

- The target app cannot invoke local models from a static web page. The loopback service is required for TTS and FFmpeg processing; source remains in this repository and models stay in their existing location.
- Video export is missing in the target app. A scene-only export is necessary for this milestone; full episode assembly/export remains M6.7/M6.8.
- Playback capture, microphone permissions, codec support, model inference time, and storage quota need browser and OS-level verification. No existing lip-sync path is available to reuse here.

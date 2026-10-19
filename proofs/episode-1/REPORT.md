# Episode 1 production acceptance — in progress

Date: 19 October 2026. **Complete first cut: produced; Karl and Astra review pending.** The six-scene episode was assembled and exported through Studio. Lily is the provisional British narrator; her naturalness has not been approved. Karl visually approved all five [Episode 1 backgrounds](background-candidates/PROMPTS.md) without changes; the artwork gate is **PASSED**. All five were imported through Studio Places and the protected Living Room remains available. This location verification does not grant narrator or full episode acceptance.

All five approved source PNGs are 1672×941. Their prompts and intended uses are recorded beside the files. The source PNGs and protected Living Room were not modified.

## Approved Places import and render verification

Karl's human visual approval of Max's bedroom, Maxine's bedroom, Kitchen, Garden and the front of Max's house is recorded as **PASSED without changes**. [UI import run](background-import/results.json) used the visible Places form to upload each approved PNG. The unused default Bedroom artwork placeholder was removed through Places so Scene Maker offers exactly six ready locations: the five approved imports plus the protected Living Room. Studio stores uploaded artwork as WebP at quality 0.82; this is its existing import behavior. The five approved PNG files remain byte unchanged.

The Places heading no longer claims Bedroom and Garden still need artwork after the library has been updated.

The same Studio UI reloaded the saved Places, offered all six locations in Scene Maker, and rendered a 2-second test scene at each place with both approved Native2D Brightlings. All six scenes exported through Scene Maker. [Exported frames](background-import/max-s-bedroom-export.png), [Maxine's bedroom](background-import/maxine-s-bedroom-export.png), [Kitchen](background-import/kitchen-export.png), [Garden](background-import/garden-export.png), [house front](background-import/front-of-max-s-house-export.png), and [Living Room](background-import/living-room-export.png) were visually inspected: the locations remain recognizable and complete, and both characters appear at consistent scale without clipping. The [source and saved artwork hashes](background-import/results.json) stayed identical before and after scene export. [Fidelity measurements](background-import/fidelity-results.json) show upper-frame source-to-Studio-preview differences averaging 2.9–3.4 RGB levels per channel for imported images; preview to decoded WebM averaged 6.0–6.7 levels. Each export matched its selected background much more closely than any other location. FFmpeg decoded all six complete test videos. This is visual/content preservation, not byte-identical exported video pixels.

The [editable Studio Backup v8](background-import/approved-episode-1-places-studio-backup.json) was exported from Characters through the UI. A [fresh browser restored it through the UI](background-import/restore-results.json) and found the same six ready Scene Maker locations. The backup contains the approved Places and no finished Episode 1. Disposable test browser profiles were removed. Karl's existing browser data was not overwritten; import this backup through Characters → Import Studio Backup to use these locations in that browser, after first backing up any data he wishes to retain.

## Voice audit and samples

- Studio's managed local service reports Ready and exposes 61 installed Piper/Kokoro voices, including four British female Kokoro options and British male alternatives. Voice Maker already supports microphone recording, import, non-destructive editing, speed/pitch/tone/volume controls, preview, Audio Library saves and Backup v8.
- Through disposable Chrome and the visible Voice Maker UI, generated the same requested opening line at 0.90×: [Alice](narrator-bf_alice.wav), [Emma](narrator-bf_emma.wav), [Isabella](narrator-bf_isabella.wav), and [Lily](narrator-bf_lily.wav). The WAVs last 6.10–6.46 seconds. [UI screenshot](voice-maker-samples.png) and [automation record](voice-samples-results.json) show the Ready service and saved UI assets. These are technical samples, **not a naturalness verdict**. This agent environment has no audio listening capability. Karl has been asked to listen and select or reject them.
- The synthesis code now appends a 250 ms quiet tail so scene edits and cuts have room after the final phoneme. Voice Maker saves a selected voice and speaking pace per speaker, including Narrator, and uses the saved choice next time; the disposable UI check reloaded a saved Lily 0.90× choice successfully. Generated speech assets now include speaker, voice and text excerpt in their names. Existing editing/recording paths remain intact. The live managed service must reload the Python module before the tail change affects new samples.
- No new speech engine, model or dependency was added. If Karl rejects all four voices, the existing engines are insufficient for the requested subjective quality; a replacement proposal needs separate approval.

## UI assembly and export check

`episode-export-smoke.mjs` used disposable Chrome against the real Studio UI to create and save a reusable intro, generate and save local narration, create a Max scene, add that narration to the Scene audio lane, create and save credits, assemble and save an episode with intro/credits references, preview all three sections, export WebM, reload and reopen the episode, and download a Studio Backup v8. The scene automatically extended from 3 to 7 seconds for narration. [Run record](episode-export-smoke-results.json), [editable smoke backup](technical-smoke-backup.json), [exported smoke video](episode-export-smoke.webm), and extracted [intro](export-intro.png), [scene](export-scene.png), [credits](export-credits.png) frames are available. These use the Living Room to test the UI/export seam; they are **not** Episode 1.

The exported smoke WebM has 1672×941 VP9 video and stereo Opus audio. FFprobe decoded 315 video frames and 185 audio frames; FFmpeg decoded the file with one non-monotonic DTS warning on a video packet near the end. Audio measured −23.8 dB mean and −2.7 dB peak. Video timestamps run through about 13.1 seconds. Silence detection found narration from roughly 3.24 to 9.44 seconds, within the automatically extended scene from 3 to 10 seconds, without a cut at the shot boundary. The intro, Max scene, and credits were inspected in actual exported frames. Playback/listening through physical speakers remains unverified. The WebM has no container Duration field, inherited from browser MediaRecorder; packet timestamps and decoding show playback data. A complete 3–5 minute Episode 1 export with its full soundtrack has not been tested.

A separate **186-second duration stress check** repeated the real UI workflow with a 180-second Max scene between intro and credits. The [long WebM](long-export-smoke.webm) is 49.2 MB. FFprobe counted 4,457 VP9 frames at 1672×941, with the last video packet at 186.096 seconds (about 24 frames/second). FFmpeg decoded the whole file without reported errors. [Mid-scene](long-export-mid.png) and [ending credits](long-export-credits.png) frames extracted from the video were inspected. [Run record](long-export-smoke-results.json) shows save, export, reopen, Backup v8 and disposable-browser cleanup with zero captured browser errors. Its narration is short and the rest is silent, so this proves long export duration and section rendering, **not** a three-minute finished soundtrack or Episode 1 acceptance.

## Checks

- `npm test -- --run`: **186/186 passed** across 23 files.
- `npm run test:service`: **11/11 passed**.
- `py -3.12 test_voice_local.py`: **6/6 passed**.
- `npm run build`: **passed**.
- Disposable browser UI smoke: **passed** with zero captured browser errors; save/reopen and Backup v8 references verified.
- Approved Places UI import, six Scene Maker previews/exports, full video decode, unchanged artwork hashes, fresh-profile UI Backup restore: **passed** with zero captured browser errors. The 186/186 frontend tests and production build were rerun after import documentation was updated and passed.

## Current production evidence

See [the production cut report](PRODUCTION_CUT_REPORT.md) for the six-scene export, editable backup, visual inspection, timing checks and known limitations. Karl and Astra review is pending.

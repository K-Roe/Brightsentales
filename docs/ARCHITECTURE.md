# Application architecture

This is a local React/TypeScript/Vite application. `scripts/studio.cjs` launches it: it serves the app (Vite in development, the built `dist/` in production) and manages the loopback Python voice service used by Voice Maker for installed Piper/Kokoro models and FFmpeg processing, so users never start Python themselves. There is no cloud requirement. `src/main.tsx` mounts `src/App.tsx`, which owns Studio navigation, shared saved libraries, Playground state and Studio Backup commands. Most editor state lives in the relevant React component until Save.

## Main modules

| Area | Files and responsibilities |
| --- | --- |
| Characters | `maker.ts` validates character specifications and recolours approved source PNG frames through reusable masks; `library.ts` handles character-only import/export; `Characters.tsx` owns the library and Maker UI. The older `brightling.ts` procedural Oliver path remains for compatibility, not the current Maker's production artwork pipeline. |
| Places | `placeCatalog.ts` describes built-in places; `placeFolders.ts` validates stable folder/place IDs, assignments and uploaded artwork data; `placeArtwork.ts` prepares user images; `Places.tsx` manages the UI. The Living Room production image is protected. |
| Playground | `App.tsx` uses `scene.ts` for the legacy placement save, `walking.ts` and `wave.ts` for approved timing, and `outfit.ts` for built-in sprite selection. It is separate from timed scenes. |
| Timed scenes | `timedScenes.ts` validates scene schedules and computes each Brightling's visibility, location and pose with `stateAt(scene, id, time)`. `SceneMaker.tsx`, `SceneTimeline.tsx`, `timelineEditing.ts` and `scenePreview.ts` provide editing and Canvas preview. Scenes carry optional `phone` interactions and a `phoneIn` hand, so scenes saved before Max's phone existed still load unchanged. |
| Episodes | `episodes.ts` stores ordered stable scene IDs and maps global time to a scene index and local time. `EpisodeMaker.tsx` edits the sequence and reuses `drawScenePreview` rather than creating a second character animation engine. |
| Intros | `introductions.ts` stores reusable intros as a `TimedScene` plus series/episode title text and a title style, so intros reuse the single `stateAt` animation engine, `drawIntroPreview`, the audio lanes and the playback clock. `IntroMaker.tsx` provides the library and editor. |
| Credits | `credits.ts` stores reusable credits as ordered heading/name/role lines plus background, duration, style, scroll speed and audio. `creditsAsScene` presents credits to the shared scene renderer, so `drawCreditsPreview` reuses `drawScenePreview` and the same audio clock. Timing maths (`creditsOffset`, `creditRowsAt`) is a pure function of time, so preview, assembly and export agree. `CreditsMaker.tsx` provides the library and editor. |
| Music Studio | `musicProject.ts` stores editable songs (tempo, bars, looping, master volume, tracks of notes with instrument, volume, pan, mute, solo) and sound-effect projects. `instruments.ts` synthesises eight instrument voices from oscillators, filters and envelopes. `musicRender.ts` renders with `OfflineAudioContext` at a fixed 44100 Hz and a seeded noise buffer, then `wav.ts` encodes deterministic 16-bit PCM WAV. `musicAssets.ts` turns a render into a normal `AudioAsset`, so generated audio uses the existing Audio Library and audio clock with no second player. `MusicStudio.tsx` and `previewPlayer.tsx` provide the UI. |
| Audio | `audio.ts` defines clip/asset records and validation; `audioStore.ts` stores blobs in IndexedDB and packs/checks backup bytes; `AudioLibrary.tsx` imports/previews/deletes; `AudioPanel.tsx` edits scene/episode lanes; `audioPlayback.ts` maps the existing clocks to HTMLAudioElements. Scene music volume is halved while episode music is active. |
| Voice Maker | `VoiceMaker.tsx` records/imports, edits and saves original/new speech assets through the same audio store, and shows the engine's Starting/Ready/Unavailable/Error status with a controlled Retry. `voiceSettings.ts` validates speaker defaults and reusable effect presets. `voiceApi.ts` calls the voice service on the app's own origin for installed Piper/Kokoro synthesis and FFmpeg transformations. `sceneVideoExport.ts` draws the existing scene preview and mixes saved scene clips into a scene-only WebM. |
| Launcher and voice service lifecycle | `scripts/studio.cjs` is the single application entry point for both `npm run dev` and `npm start`. It serves the app and mounts `scripts/voice-lifecycle.cjs` as middleware, so `/voice-api/*` and `/voice-manager/*` are same-origin on every request. `VoiceServiceManager` finds a compatible running service or starts `voice_local.py --port <n>` as its own child, polls the versioned `/voice-api/health` endpoint instead of waiting a fixed time, tolerates a busy-but-healthy service, restarts a crashed child within a bounded budget, and stops only the child it owns. `voice_local.py` answers `/voice-api/health` with a service name and protocol version and accepts `/voice-api/owner/shutdown` only with the per-launch owner token. |
| Phone & Bright Speak | `phone.ts` holds the interaction model: the `take-out`/`hold`/`tap`/`communicate`/`put-away` actions, validation with beginner-friendly reasons, `phoneStateAt(scene, id, time)` as a pure function of scene time, hand anchors measured from the approved sprite frames, pop-up placement, and `syncPhoneClip` which keeps the device's speech clip aligned with its interaction. `phoneArt.ts` draws the phone, nine communication symbols and the pop-up as vectors. Brightlings are whole-body frames rather than a rig, so the phone is composited at the measured hand anchor for each pose and frame (mirrored while walking) and never floats where the far hand has no artwork. It is drawn by `drawScenePreview`, so preview, playback and the WebM export agree. |
| Backups | `studioBackup.ts` validates versioned complete Studio Backups and journals localStorage restores. `restoreCoordinator.ts` coordinates the audio and localStorage transaction with a durable pending/committed marker. `App.tsx` applies restored data; `main.tsx` recovers before mounting the app. `Characters.tsx` presents export/import. |

## Artwork and rendering

- Approved original Max/Maxine PNGs, alternative built-in outfit PNGs and Living Room artwork live under `public/art/`. Do not modify them without a separate approved artwork milestone.
- Custom Brightlings keep stable IDs, names, template and three colours. `maker.ts` recolours the template's original nine PNG poses using masks under `public/recolour-masks/`; it does not redraw the body or generate runtime AI art.
- Timed previews use a 1672×941 Canvas. `scenePreview.ts` draws the place background, evaluates each character at the requested time, sorts visible characters by foot Y for depth, and selects original/custom outfit sprite packs. Side frames mirror for leftward travel. The scene clock determines walk and wave poses, so seeking does not need previous frames.
- The Playground has its own existing movement/render loop in `App.tsx`. Preserve its established behaviour when extending the timed editor.

## Local data and compatibility

| Data | Storage |
| --- | --- |
| Custom Brightlings | `localStorage`: `brightsenappstales.brightlings.v1` |
| Playground starts/destinations and built-in outfit choices | `localStorage`: `brightsenappstales.scene.v1` |
| Place folders, assignments and user background data | `localStorage`: `brightsenappstales.place-folders.v1` |
| Timed scenes with optional audio clip metadata | `localStorage`: `brightsenappstales.timed-scenes.v1` |
| Episodes with ordered scene IDs and optional global audio clips | `localStorage`: `brightsenappstales.episodes.v1` |
| Reusable intros (timed scene + titles) | `localStorage`: `brightsenappstales.introductions.v1` |
| Reusable credits (lines + presentation + audio) | `localStorage`: `brightsenappstales.credits.v1` |
| Editable music and sound-effect projects | `localStorage`: `brightsenappstales.music-projects.v1` |
| Imported audio files and metadata | IndexedDB: `brightsenappstales.audio.v1`, `assets` store |
| Voice presets and optional speaker defaults | `localStorage`: `brightsenappstales.voice-settings.v1` |
| Pending localStorage backup restore | `localStorage`: `brightsenappstales.restore.v1` journal |
| Cross-store audio restore | `localStorage`: `brightsenappstales.audio-restore.v1` marker; IndexedDB `restore-recovery` snapshot store in database version 2 |

Studio Backup format **8** contains character definitions, legacy Playground scene, Places organisation, timed scenes, episodes, intros, credits, editable music projects and audio files as base64 plus SHA-256. It does not duplicate built-in artwork. Older backup versions are validated and normalised; older scenes and characters retain their IDs. Restoring a version 5 or older backup carries no intros, a version 6 or older backup carries no credits, and a version 7 or older backup carries no music projects, so existing local intros, credits and music projects are preserved rather than cleared. Character-only **Export Library** is not a complete Studio backup. Browser site-data clearing still removes live local data, so a downloaded Studio Backup is the separate recovery copy.

F4 coordinates restores across IndexedDB and localStorage: one IndexedDB transaction snapshots old audio and installs new audio; a pending/committed localStorage marker determines whether startup rolls both stores back or keeps the new state. Recovery runs before React mounts. The snapshot temporarily needs extra browser storage. On persistent storage failure the app blocks editing rather than loading mismatched data. A downloaded backup remains essential against browser site-data loss.

Voice Maker retains Backup v8 and adds an optional validated `voiceSettings` field. Its localStorage settings are part of the same restore journal as the saved projects; older backups without the field retain current voice settings. Original and edited recordings are separate existing `AudioAsset` records. Scene-only WebM export is bounded to two minutes and does not implement M6.7 episode assembly or M6.8 full-production export.

## Timing and future extension seams

- Timed scenes store action seconds relative to the scene; an episode stores scene references and uses a global clock. `episodePosition` converts global time to scene-local time. `episodePlaybackClips` offsets scene audio at each occurrence, including repeated scene IDs, while episode music retains its global clock.
- Speech in M6.4 adds attributed audio clips through the existing asset/clock/backup path and keeps non-verbal Brightlings valid. M6.5 introduces intros as a timed scene plus titles and M6.6 introduces credits as ordered lines presented through `creditsAsScene`; neither adds a second scene format or renderer. M6.7 assembly should compose intro, scenes and credits by stable reference on one global production clock, preserving all three existing formats.
- Complete production export in M6.8 must validate a playable file with picture and sound. Voice Maker V1 provides a verified scene-only WebM through the existing scene renderer and saved audio assets; it does not assemble episodes. M6.6A music projects should reuse rendered Audio Library WAV assets until the one-step PCM re-render variation is resolved.

## Verification boundaries

`npm test -- --run` and `npm run build` are baseline gates. Browser checks must use disposable profiles and report console errors and missing assets. Screenshots show layout; playback recordings show timing; audio-output capture shows whether sound was produced by the browser. None of these substitutes for Karl's visual and listening approval. The project evidence reports are under `proofs/`.

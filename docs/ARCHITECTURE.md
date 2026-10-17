# Application architecture

This is a local React/TypeScript/Vite application. It has no backend, cloud requirement or AI service. `src/main.tsx` mounts `src/App.tsx`, which owns Studio navigation, shared saved libraries, Playground state and Studio Backup commands. Most editor state lives in the relevant React component until Save.

## Main modules

| Area | Files and responsibilities |
| --- | --- |
| Characters | `maker.ts` validates character specifications and recolours approved source PNG frames through reusable masks; `library.ts` handles character-only import/export; `Characters.tsx` owns the library and Maker UI. The older `brightling.ts` procedural Oliver path remains for compatibility, not the current Maker's production artwork pipeline. |
| Places | `placeCatalog.ts` describes built-in places; `placeFolders.ts` validates stable folder/place IDs, assignments and uploaded artwork data; `placeArtwork.ts` prepares user images; `Places.tsx` manages the UI. The Living Room production image is protected. |
| Playground | `App.tsx` uses `scene.ts` for the legacy placement save, `walking.ts` and `wave.ts` for approved timing, and `outfit.ts` for built-in sprite selection. It is separate from timed scenes. |
| Timed scenes | `timedScenes.ts` validates scene schedules and computes each Brightling's visibility, location and pose with `stateAt(scene, id, time)`. `SceneMaker.tsx`, `SceneTimeline.tsx`, `timelineEditing.ts` and `scenePreview.ts` provide editing and Canvas preview. |
| Episodes | `episodes.ts` stores ordered stable scene IDs and maps global time to a scene index and local time. `EpisodeMaker.tsx` edits the sequence and reuses `drawScenePreview` rather than creating a second character animation engine. |
| Intros | `introductions.ts` stores reusable intros as a `TimedScene` plus series/episode title text and a title style, so intros reuse the single `stateAt` animation engine, `drawIntroPreview`, the audio lanes and the playback clock. `IntroMaker.tsx` provides the library and editor. |
| Credits | `credits.ts` stores reusable credits as ordered heading/name/role lines plus background, duration, style, scroll speed and audio. `creditsAsScene` presents credits to the shared scene renderer, so `drawCreditsPreview` reuses `drawScenePreview` and the same audio clock. Timing maths (`creditsOffset`, `creditRowsAt`) is a pure function of time, so preview, assembly and export agree. `CreditsMaker.tsx` provides the library and editor. |
| Audio | `audio.ts` defines clip/asset records and validation; `audioStore.ts` stores blobs in IndexedDB and packs/checks backup bytes; `AudioLibrary.tsx` imports/previews/deletes; `AudioPanel.tsx` edits scene/episode lanes; `audioPlayback.ts` maps the existing clocks to HTMLAudioElements. Scene music volume is halved while episode music is active. |
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
| Imported audio files and metadata | IndexedDB: `brightsenappstales.audio.v1`, `assets` store |
| Pending localStorage backup restore | `localStorage`: `brightsenappstales.restore.v1` journal |
| Cross-store audio restore | `localStorage`: `brightsenappstales.audio-restore.v1` marker; IndexedDB `restore-recovery` snapshot store in database version 2 |

Studio Backup format **7** contains character definitions, legacy Playground scene, Places organisation, timed scenes, episodes, intros, credits and audio files as base64 plus SHA-256. It does not duplicate built-in artwork. Older backup versions are validated and normalised; older scenes and characters retain their IDs. Restoring a version 5 or older backup carries no intros, and a version 6 or older backup carries no credits, so existing local intros and credits are preserved rather than cleared. Character-only **Export Library** is not a complete Studio backup. Browser site-data clearing still removes live local data, so a downloaded Studio Backup is the separate recovery copy.

F4 coordinates restores across IndexedDB and localStorage: one IndexedDB transaction snapshots old audio and installs new audio; a pending/committed localStorage marker determines whether startup rolls both stores back or keeps the new state. Recovery runs before React mounts. The snapshot temporarily needs extra browser storage. On persistent storage failure the app blocks editing rather than loading mismatched data. A downloaded backup remains essential against browser site-data loss.

## Timing and future extension seams

- Timed scenes store action seconds relative to the scene; an episode stores scene references and uses a global clock. `episodePosition` converts global time to scene-local time. `episodePlaybackClips` offsets scene audio at each occurrence, including repeated scene IDs, while episode music retains its global clock.
- Speech in M6.4 adds attributed audio clips through the existing asset/clock/backup path and keeps non-verbal Brightlings valid. M6.5 introduces intros as a timed scene plus titles and M6.6 introduces credits as ordered lines presented through `creditsAsScene`; neither adds a second scene format or renderer. M6.7 assembly should compose intro, scenes and credits by stable reference on one global production clock, preserving all three existing formats.
- Video export in M6.8 must validate a complete playable file with picture and sound. Browser preview or a passing build alone is insufficient evidence.

## Verification boundaries

`npm test -- --run` and `npm run build` are baseline gates. Browser checks must use disposable profiles and report console errors and missing assets. Screenshots show layout; playback recordings show timing; audio-output capture shows whether sound was produced by the browser. None of these substitutes for Karl's visual and listening approval. The project evidence reports are under `proofs/`.

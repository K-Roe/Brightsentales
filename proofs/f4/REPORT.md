# F4 — crash-safe Studio Backup restore across audio and scene storage

17 October 2026. **IMPLEMENTED — AWAITING KARL'S BATCH REVIEW.** F4 changes restore coordination only; the Studio Backup file format remains version 5 and older backup versions still use the existing compatibility path.

## Defect and correction

Before F4, Studio Backup import replaced audio in IndexedDB and only then wrote characters, scenes and episodes to localStorage. A browser crash between those operations could leave new audio paired with old scene/episode references. The existing localStorage journal could not recover the audio store.

The Audio Library database upgrades in place from version 1 to version 2, adding a small restore-recovery object store. The old audio library is snapshotted in the **same IndexedDB transaction** that installs restored audio. A localStorage marker records whether the cross-store restore is pending or committed. The existing localStorage restore journal stays pending until the audio replacement and all localStorage writes finish. On startup, the Studio resolves that marker **before mounting any editor**:

- Pending restore: roll back localStorage and atomically restore the audio snapshot.
- Committed restore: keep both new stores and finish journal/snapshot cleanup.
- Recovery failure: show a blocking recovery message and leave the marker available for retry; editors do not open on uncertain data.

The imported backup, character IDs, timed scene actions, episode references, audio clips and artwork are unchanged. No migration of existing saved content is required. The additional IndexedDB snapshot temporarily needs space for the previous audio library; a quota failure aborts the atomic transaction and keeps the previous data.

## Changed files

- `src/audioStore.ts`: IndexedDB v2 recovery store and atomic snapshot/replace, rollback and cleanup operations.
- `src/restoreCoordinator.ts`: cross-store marker, restore ordering and startup recovery.
- `src/studioBackup.ts`: optional deferred journal commit and finalisation while keeping the existing synchronous restore API for older paths.
- `src/App.tsx`, `src/main.tsx`: use the coordinator for backups containing audio and recover before rendering.
- `src/restoreCoordinator.test.ts`: interruption, success, failure and retry tests.
- `proofs/f4/`: disposable browser scripts, results, screenshots and sound recording. `.gitignore` excludes generated backup downloads, temporary frames and decoded WAV inspection files.

## Verification

- Focused restore tests: **18/18 passed** across `restoreCoordinator.test.ts` and `studioBackup.test.ts` after the final failure case was added.
- Full suite: **71/71 passed** across 15 files; production build passed. See the final command record in `docs/PROJECT_STATUS.md`.
- [Interrupted Chrome run](interrupted-results.json): real FFmpeg-encoded MP3 (old library) and OGG/Vorbis (new library) were decoded and stored in IndexedDB. Reload after an audio swap but before local writes restored old MP3 and empty old scene/episode libraries. Reload after local writes but before commit did the same. Reload after commit but before cleanup kept new OGG, its timed scene and episode. Markers were cleared. [Recovered Audio Library screenshot](recovered-audio-library.png).
- [Normal UI restore run](browser-results.json): genuine MP3, OGG/Vorbis and OGG/Opus assets, three scenes and a 33-second episode exported through the visible Studio Backup UI and imported in a second empty isolated profile. All five files previewed after restore; scene/episode clip references remained. [Restored library screenshot](backup-restored-audio.png), [browser recording with sound](episode-with-audio.mp4).
- Both browser runs recorded zero console errors and failed assets. All three disposable Chrome profiles were removed. Karl's normal profile and saved work were not touched.
- Existing localStorage-only restore tests, including older backup compatibility, still pass.

## Limits and Karl's check

The interrupted-browser cases simulate process termination by leaving a durable restore mid-flight and reloading the app. They do not cut power to a physical device or force an actual OS process kill at every machine instruction. Browser storage eviction and persistent hardware failure cannot be solved by a local transaction protocol; keep a downloaded Studio Backup separately. If recovery cannot write to IndexedDB or localStorage, the Studio intentionally blocks editing until a retry succeeds.

Karl should review the normal import flow and, if desired, listen to the [recorded episode](episode-with-audio.mp4) after restore. Technical verification does not constitute his functional or listening approval.

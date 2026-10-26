# Embedded Cartoon Preview V1

**Date:** 2026-10-26
**Status:** Implemented; automated verification passed. Real browser playback and Karl's visual/audio acceptance remain pending.

## Implementation

Cartoon Preview now plays saved scenes directly inside BrightTales Studio. It uses the existing `drawScenePreview` renderer shared with Scene Maker and WebM export, plus the canonical timed-scene clock and `useAudioPlayback`. This avoids introducing a second rendering engine or requiring a Unity WebGL build. Existing Unity Editor and runtime bridge controls remain available in the development/testing disclosure.

The player provides saved-scene selection, loading and error feedback, Play, Pause, Restart, and timeline scrubbing. It loads the saved place art and character packs, then draws the saved camera, character actions and existing audio against the same scene time. Playback state is local to the preview and does not save or modify the scene.

Before loading or playing, readiness uses `validateTimedLibrary` and `validateAudioReferences`, then checks that the scene's place art and custom Brightling identities are available. Missing resources are reported instead of silently substituted.

## Verification

- `npm test -- --run src/embeddedCartoonPreview.test.ts`: **4/4 passed**.
- `npm test -- --run`: **392/392 passed**, 57 test files.
- `npm run build`: passed. Vite emitted the existing advisory that the main JavaScript chunk exceeds 500 kB.
- Unity source and bridge contracts were not changed; no Unity test run was needed.
- `git diff --check`: passed.

The four focused cases cover valid saved scenes, a missing custom Brightling, a location without artwork, and invalid scene duration/camera data. Existing Scene Maker rendering and audio integration tests remain included in the full suite.

## GUI and acceptance boundary

**NOT VERIFIED:** the in-app browser control runtime was unavailable in this session, so no real browser click-through or application screenshot was captured. The saved modular episode manifest at `proofs/cartoon-foundation-p11/demo-episode.json` is a transfer fixture rather than a Studio browser storage database, so it was not represented as a live UI playback test. Automated tests and a production build do not establish visual equivalence, audio output quality, or Karl's acceptance.

## Manual review

1. Start Studio using the existing `Start-BrightTales-Review.cmd` or `npm run dev`.
2. Open **Cartoon Preview** from the Studio navigation.
3. Choose a saved scene in **Saved scene**. Wait for the location and Brightling artwork to load.
4. Press **Play**. Confirm character actions and camera movement appear in the panel and supported audio plays. Use **Pause**, **Restart**, and the position slider.
5. Switch to Scene Maker and confirm the saved scene still has its original content. Return to Cartoon Preview and select it again.
6. For Unity development verification, expand **Unity Editor and bridge tools (development and testing)**. This remains optional for normal Studio preview.

Review Studio appearance and physical audio separately. No human acceptance is inferred.

## Git

Studio canonical branch: `main`. Implementation commit: `cb9d546` (full hash recorded by Git). Unity canonical branch: `cartoon-foundation`; no Unity files changed.

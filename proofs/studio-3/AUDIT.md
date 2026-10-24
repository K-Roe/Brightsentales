# Studio 3.0 source audit and acceptance plan — 2026-10-24

## Source and authority

Worktree `C:\Users\karlr\repos\BrightTalesStudio3` is branch `studio-3-experimental` at Studio Phase 2 checkpoint `db63024`, from the same Git repository as primary `main` (`39e089d`). `main` has not received the Phase 2 integration. The verified Phase 2 Studio and Unity worktrees remain separate; Unity `cartoon-foundation-phase2` at `9997d9e` has two unrelated generated ProjectSettings edits. The frozen V1.1 branches and primary main remain untouched. Phase 2 proof is at `proofs/cartoon-foundation-phase2/REPORT.md`, with the Unity counterpart in `CartoonFoundationP2Review/REPORT.md`.

## Existing architecture

- `App.tsx` owns local libraries, scene and episode state, appearance, backup handlers and navigation. It renders existing React tools with shared props. The sidebar currently opens Characters. Scene Maker, Episode Maker and Credits already have some local unsaved-change handling.
- `SceneMaker.tsx` owns the editable timed scene, validation, Canvas stage, playback, CameraPanel, SceneTimeline and AudioPanel. `timedScenes.ts` owns stable IDs and action semantics; `scenePreview.ts` is the shared browser renderer. `episodes.ts` and `sceneVideoExport.ts` already support browser playback/export.
- `appearance.ts` is the sole application theme preference. `studioBackup.ts` owns v8 and older backup validation; `restoreCoordinator.ts` coordinates localStorage and IndexedDB recovery. UI workspace preference must be a separate local key, outside backup and scene schemas.
- `scripts/studio.cjs` is the sole launch path and owns the optional local Piper/Kokoro voice service. Music Studio uses the existing Audio Library path; no tool service or rendering engine needs replacing.
- Phase 2 `StudioSceneUnityPanel.tsx` and `studioSceneBridge.ts` validate and hash a supported saved-scene subset, then send `studio.*` commands over the existing `unityBridge.ts` loopback connection. Unity `BrightTalesBridgeV0.cs` routes to isolated `StudioScenePlayer.cs`, preserving look-at, gentle walk, Calm Life v2, camera keyframes, reset and replay. Unity is an optional preview; no embedded Game view, Unity audio, episode transfer or in-app Unity MP4 exporter exists.

## Implementation boundary

Add a presentation preference and two shells within the existing `App` state owner. Keep one component instance for the active tool while switching workspaces. Preserve the Classic navigation and its tool components; scope Studio 3.0 styles to a root workspace class. Reflow the existing Scene Maker DOM and add a hierarchy view for professional mode, using the same scene state and callbacks. Keep CameraPanel, SceneTimeline and the established Unity panel and bridge. Guard navigation away from unsaved scenes. Do not alter artwork, action timings, backup schemas, approved branches or Unity source.

## Acceptance checklist

- [x] First launch defaults to Unity Studio 3.0; preferred workspace persists and opens on reload; settings can switch without server restart.
- [x] Switching workspaces keeps the active editor state and warns before any navigation that would discard unsaved work.
- [x] Classic navigation, Playground canvas and browser Scene Maker playback remain usable; Studio 3.0 reuses the same scene, camera, timeline and audio models.
- [x] Studio 3.0 exposes navigation to the current tools and truthful optional Unity preview status.
- [x] Save/reopen/edit and Backup v8 UI restore pass; legacy backup compatibility, Voice Maker and Music Studio retain their paths and pass the existing automated checks. Voice generation and Music rendering were not interactively exercised here.
- [x] Focused and full tests, build, disposable-browser UI/restore/Unity checks, screenshots and a 14-second UI walkthrough video pass.
- [x] Commit and push only the experimental branch, then stop for Karl's visual decision.

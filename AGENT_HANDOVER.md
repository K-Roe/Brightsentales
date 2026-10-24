# Cartoon foundation agent handover — 2026-10-24

**Live continuation (later 2026-10-24):** Phase 1 saved-scene transfer is present in both `cartoon-foundation` worktrees. Unity implementation and synthetic proof are checkpointed at `e250346722617722747bfc933b5aa8cb758ceb4b`; the Studio checkpoint is recorded in the Git section below. Studio `src/studioSceneBridge.ts`, `src/StudioSceneUnityPanel.tsx`, `src/UnityConnection.tsx` and `src/App.tsx` use the existing saved `TimedScene` library and localhost bridge. Unity `Assets/CartoonFoundationExperimental/StudioScenePlayer.cs`, `Assets/Scenes/StudioLivingRoomExperimental.unity`, `Assets/BrightTalesBridgeV0.cs` and the Play mode test provide the experimental receiver and shared clock. Focused Unity Play mode passed 1/1 after the scene-ID validation change; Studio focused test passed 3/3, full suite 287/287 and build passed. Read `proofs/cartoon-foundation-phase1/REPORT.md`. Do not describe Phase 1 as end-to-end verified. The next task is a disposable-profile Studio save/reopen/edit/send/play/reset check against the isolated scene. The normal Unity Editor is open on the original worktree; do not stop or repoint it.

## Read first

Read `AGENTS.md`, `docs/CARTOON_FOUNDATION_AUDIT.md`, `TODO.md`, `CURRENT_STATE.md`, `DECISIONS.md`, `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/BATCH_REVIEW.md`, and the V1.1 approval records before editing. Karl's latest mission authorizes isolated implementation branches, verified commits and safe backup pushes. It does not authorize a main merge or visual approval. Preserve untracked files in the original Unity worktree.

## Exact repositories and refs

| Project | Original repository | Active isolated worktree / branch | Approved recovery commit |
| --- | --- | --- | --- |
| Studio | `C:\Users\karlr\repos\brightsenappstales` (`main` at `39e089d88fa90a7efe1002789c3df779651e95b1`) | `C:\Users\karlr\repos\BrightTalesCartoonFoundationStudio` / `cartoon-foundation` | `137219da60565a780995c44201834ce820d41544` on `cartoon-engine-v1-1-approved` |
| Unity | `C:\Users\karlr\repos\BrightTalesUnityTest` | `C:\Users\karlr\repos\BrightTalesCartoonFoundationUnity` / `cartoon-foundation` | `9cf90954a54c66fd53d0a05890b18fa4cb7c0d21` on `cartoon-engine-v1-1-approved` |

Studio remote: `https://github.com/K-Roe/Brightsentales.git` (public). Unity remote: `https://github.com/K-Roe/BrightTalesUnityTest.git` (private). Both frozen approved branch refs were pushed and matched by `git ls-remote`. The Unity Git LFS download batch endpoint reported all 137 tracked objects available. No foundation implementation branch push or main merge has occurred at the time of this handover entry.

## Architecture and launch

Studio uses React/TypeScript/Vite/Canvas. `src/timedScenes.ts` owns scene data and action evaluation, `src/SceneMaker.tsx` and `src/SceneTimeline.tsx` edit it, `src/scenePreview.ts` renders it, `src/episodes.ts` maps episode time, `src/EpisodeMaker.tsx` edits/plays episodes, and `src/sceneVideoExport.ts` already exports complete episodes to WebM. Audio uses `src/audio.ts`, `src/audioStore.ts` and `src/audioPlayback.ts`; backup v8 and recovery use `src/studioBackup.ts` and `src/restoreCoordinator.ts`. `src/unityBridge.ts`, `src/UnityConnection.tsx` and `src/CartoonEngineV1Panel.tsx` are the existing localhost bridge UI.

Unity 6.6 uses `Assets/BrightTalesBridgeV0.cs` for loopback port 17843; it marshals commands to the main thread. `Assets/CartoonEngineV1_1Experimental/CartoonSceneV1_1.cs` and `Assets/Scenes/CartoonLivingRoomV1_1Experimental.unity` implement the approved fixed 26-second scene. `Assets/CartoonEngineV1Experimental/` contains the approved Max/Maxine/room sprite imports. The V1.1 scene and scripts must remain unchanged. Unity `Packages/manifest.json` lists Timeline and 2D packages; no Unity Recorder package is listed.

Start Studio from its active worktree with `npm run dev` (single launcher `scripts/studio.cjs`). Use its printed localhost URL. Open the **Unity Connection** tab. Open the Unity project in the active isolated Unity worktree with Unity Hub, open the experimental scene, and press Play. The approved fixed demo uses **Connect → V1.1 character polish → Send Scene to Unity → Play scene**. Director Controls and Blink Max remain available on suitable scenes. The current demo is not driven by saved Scene Maker data.

## Checks and evidence

Studio: focused tests `npm test -- --run src/unityBridge.test.ts`, then required full `npm test -- --run` and `npm run build` for actual source changes. Unity: focused compilation and Play mode checks after edits; use an isolated Editor when the normal Editor owns port 17843. The approved V1.1 visual proof is `C:\Users\karlr\repos\BrightTalesUnityTest\CartoonEngineV1_1Review\max-maxine-living-room-v1-1.mp4`; its review and approval docs are adjacent. `proofs/cartoon-engine-v1-1/APPROVAL.md` records Studio approval. No foundation visual/video verification exists yet.

## Supported and unsupported now

Supported through Unity: approved fixed V1.1 living-room scene, Director Controls Look At/Wave/Idle, Blink Max. Studio also has editable saved scenes/episodes, camera, audio and complete browser WebM export, but those saved objects are **not yet transferred generally to Unity**. Unity has no verified saved-scene/episode audio sync or MP4 export. Other places and custom Brightlings require a validated asset mapping; unavailable art must error. Whole-body turn cuts, absent Maxine blink layer and flattened-room occlusion are accepted V1.1 limits. Greeting V1/V2, Batch 3 actions and sitting are rejected/deferred; Portal V1 is experimental and excluded.

## Next task

Implement `TODO.md` P1 in the active isolated worktrees: versioned saved-scene payload, strict Studio/Unity validation, Max/Maxine/Living Room mapping, saved-scene selector and load/play/status/reset on one Unity clock. First prove a saved position and timing edit changes Unity playback. Keep approved V1.1 routing intact. Update this handover, status, test results and proof after each stage. Stop for Karl's visual approval before freezing or merging the completed foundation.

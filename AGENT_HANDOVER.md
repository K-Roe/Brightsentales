# Cartoon foundation agent handover — 2026-10-24

**Current continuation (2026-10-24):** Phase 1 is technically complete and awaiting Karl's visual review. A disposable browser created, saved, reopened, edited and sent a real `TimedScene` through the normal UI. Isolated Unity loaded the same scene ID and SHA-256 content revision, played Max and Maxine, reset and replayed with matching outcomes. The 22-second review MP4 combines actual UI screenshots and two continuous Unity Game-camera captures. See `proofs/cartoon-foundation-phase1/REPORT.md`. Do not start Phase 2, freeze this candidate or merge without Karl's visual decision. The normal Unity Editor is open on the original worktree; do not stop or repoint it.

## Latest verified state and next action

Worktrees: Studio `C:\Users\karlr\repos\BrightTalesCartoonFoundationStudio`; Unity `C:\Users\karlr\repos\BrightTalesCartoonFoundationUnity`; both on `cartoon-foundation`. Unity Phase 1 implementation/proof commit and verified remote ref: `ec3573c41d3ac5a8f4e936a8f27086472d36a01b`. Studio Phase 1 implementation/proof commit and verified remote ref: `14f9fbc85a097e1d9f2a3b6beb22f76f6ce85fab`. A documentation-only handover followup may be the Studio branch HEAD; use `git rev-parse HEAD` and `git ls-remote origin refs/heads/cartoon-foundation` for the latest ref. The approved recovery commits remain in the table below. Unity has unrelated Editor-generated settings changes in its isolated worktree; never stage them. No main merge occurred. The new Unity review MP4 is an LFS object; remote refetch and `git lfs fsck` passed.

The **Send a saved Scene Maker scene** section of Studio's Unity Connection tab supports Living Room, Max/Maxine, Appear/Walk/Wait/Wave/Disappear and load/play/status/reset. Camera, audio, phone, other actions, episodes and Unity export remain unsupported and must fail visibly. The normal Unity Editor owns port 17843; isolated proof used port 17844 via `VITE_UNITY_BRIDGE_PORT=17844` in Studio and the isolated Unity Play mode test. `proofs/cartoon-foundation-phase1/browser-workflow.mjs` drives disposable Chrome by the repository's CDP pattern, with no added browser dependency. It closes and reopens that same profile. `browser-webm-regression.mjs` is a separate UI export check using a second disposable profile seeded with the already UI-created scene; do not count that storage seeding as the main workflow. Keep browser WebM export intact.

## Read first

Read `AGENTS.md`, `docs/CARTOON_FOUNDATION_AUDIT.md`, `TODO.md`, `CURRENT_STATE.md`, `DECISIONS.md`, `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/BATCH_REVIEW.md`, and the V1.1 approval records before editing. Karl's latest mission authorizes isolated implementation branches, verified commits and safe backup pushes. It does not authorize a main merge or visual approval. Preserve untracked files in the original Unity worktree.

## Exact repositories and refs

| Project | Original repository | Active isolated worktree / branch | Approved recovery commit |
| --- | --- | --- | --- |
| Studio | `C:\Users\karlr\repos\brightsenappstales` (`main` at `39e089d88fa90a7efe1002789c3df779651e95b1`) | `C:\Users\karlr\repos\BrightTalesCartoonFoundationStudio` / `cartoon-foundation` | `137219da60565a780995c44201834ce820d41544` on `cartoon-engine-v1-1-approved` |
| Unity | `C:\Users\karlr\repos\BrightTalesUnityTest` | `C:\Users\karlr\repos\BrightTalesCartoonFoundationUnity` / `cartoon-foundation` | `9cf90954a54c66fd53d0a05890b18fa4cb7c0d21` on `cartoon-engine-v1-1-approved` |

Studio remote: `https://github.com/K-Roe/Brightsentales.git` (public). Unity remote: `https://github.com/K-Roe/BrightTalesUnityTest.git` (private). Both frozen approved branch refs were pushed and matched by `git ls-remote`. The Unity Git LFS download batch endpoint reported all 137 tracked baseline objects available. The experimental branches were pushed separately; no main merge occurred.

## Architecture and launch

Studio uses React/TypeScript/Vite/Canvas. `src/timedScenes.ts` owns scene data and action evaluation, `src/SceneMaker.tsx` and `src/SceneTimeline.tsx` edit it, `src/scenePreview.ts` renders it, `src/episodes.ts` maps episode time, `src/EpisodeMaker.tsx` edits/plays episodes, and `src/sceneVideoExport.ts` already exports complete episodes to WebM. Audio uses `src/audio.ts`, `src/audioStore.ts` and `src/audioPlayback.ts`; backup v8 and recovery use `src/studioBackup.ts` and `src/restoreCoordinator.ts`. `src/unityBridge.ts`, `src/UnityConnection.tsx` and `src/CartoonEngineV1Panel.tsx` are the existing localhost bridge UI.

Unity 6.6 uses `Assets/BrightTalesBridgeV0.cs` for loopback port 17843; it marshals commands to the main thread. `Assets/CartoonEngineV1_1Experimental/CartoonSceneV1_1.cs` and `Assets/Scenes/CartoonLivingRoomV1_1Experimental.unity` implement the approved fixed 26-second scene. `Assets/CartoonEngineV1Experimental/` contains the approved Max/Maxine/room sprite imports. The V1.1 scene and scripts must remain unchanged. Unity `Packages/manifest.json` lists Timeline and 2D packages; no Unity Recorder package is listed.

Start Studio from its active worktree with `npm run dev` (single launcher `scripts/studio.cjs`). Use its printed localhost URL. Open the **Unity Connection** tab. Open the Unity project in the active isolated Unity worktree with Unity Hub, open `Assets/Scenes/StudioLivingRoomExperimental.unity`, and press Play. Select a saved scene under **Send a saved Scene Maker scene**, then Connect, Send, Play, Reset and replay. For isolated automated proof, run Studio with `VITE_UNITY_BRIDGE_PORT=17844` and use `Assets/Tests/PlayMode/StudioSceneBrowserWorkflowTest.cs` in isolated Unity. The approved fixed V1.1 demo has separate controls and is not driven by saved Scene Maker data.

## Checks and evidence

Studio: focused tests passed 63/63; `npm test -- --run` passed 288/288; `npm run build` passed. Unity: focused `StudioScenePlayerPlayModeTest` passed 1/1 and browser-driven `StudioSceneBrowserWorkflowTest` passed 1/1 in isolated Play mode. The latter records 96 frames for each real UI-driven run and checks initial placement, rightward Max walk, action completion, reset and repeatability. Run `node proofs/cartoon-foundation-phase1/browser-workflow.mjs` with Studio ready on its printed localhost URL; see the script for isolated Unity batch invocation and environment. `node proofs/cartoon-foundation-phase1/browser-webm-regression.mjs` verifies existing scene WebM export separately. The proof report records FFmpeg decode and hashes. The approved V1.1 visual proof remains at `C:\Users\karlr\repos\BrightTalesUnityTest\CartoonEngineV1_1Review\max-maxine-living-room-v1-1.mp4`; its approval is separate.

## Supported and unsupported now

Supported through the isolated Phase 1 Unity scene: real saved Studio scenes with approved Living Room artwork, Max/Maxine, Appear/Walk/Wait/Wave/Disappear, starting positions and edited action timing/destinations. The SHA-256 scene revision is checked at load and in subsequent commands. Duplicate Play, invalid IDs, unsupported content and revision mismatch reject clearly. Studio also has editable episodes, camera, audio and complete browser WebM export, but those objects are **not transferred** to Unity by Phase 1. Unity has no verified audio sync, episode playback or saved-scene MP4 export. Other places and custom Brightlings require validated asset mapping. The separate fixed V1.1 scene retains Director Controls and Blink Max. Whole-body turn cuts, absent Maxine blink layer and flattened-room occlusion are known limits. Greeting V1/V2, Batch 3 actions and sitting are rejected/deferred; Portal V1 is excluded.

## Next task

Ask Karl to review `C:\Users\karlr\repos\BrightTalesCartoonFoundationUnity\CartoonFoundationP1Review\real-studio-unity-workflow.mp4` against the Phase 1 report, especially walk timing, waves, disappearance and replay consistency. It is a composite of actual browser screenshots and continuous Unity Game-camera clips, not a continuous desktop recording. Await **APPROVE / CHANGES / REJECT / PAUSE / SKIP** under the roadmap gate. Do not start Phase 2, freeze the foundation or merge before that visual decision. If Karl requests changes, update this experimental branch, rerun the real browser and Unity proof, and preserve the approved V1.1 baseline.

# Cartoon Preview Automatic Unity Startup V1

**Date:** 2026-10-26  
**Status:** Implemented; Studio automation and launcher tests pass. Unity Editor GUI startup, scene rendering, and Game-view acceptance remain for Karl.

## Repositories and commits

- Studio: `C:\Users\karlr\repos\brightsenappstales`, branch `main`, implementation commit `be5df2bdd8f57131d0319deec025cd6de27f7704`.
- Unity: `C:\Users\karlr\repos\BrightTalesUnityFoundationIntegration`, branch `cartoon-foundation`, implementation commit `3ebb70b6bc9289fbb09f40281a25bacd3d52c1ad`.
- Verified remotes before changes: Studio `K-Roe/Brightsentales` (`origin/main` at `4aa85eaa37632d41e95af4add279a31cbef7fbbe`); Unity `K-Roe/BrightTalesUnityTest` (`origin/cartoon-foundation` at `46e2b30a4807e699f81d42cea45132780c93c8c6`). Both local branches matched their remote checkpoints and were not divergent.
- Pushes and final remote parity are to be recorded after publication.

## Implementation

Studio's existing **Start Unity** action now calls a loopback-only startup endpoint served by `scripts/studio.cjs`. The endpoint requires a same-origin request and a per-process random token, accepts only a fixed `start` command, and single-flights duplicate requests. It invokes only `scripts/review/Start-BrightTalesReview.ps1 -UnityOnly -NoBrowser`; the browser cannot provide a Unity path or execute arbitrary commands.

The existing PowerShell review launcher verifies the exact Unity project process and port 17844 identity. It reuses the correct Editor when found and otherwise launches the configured Unity Editor with the canonical Unity project and port 17844. It does not terminate Unity processes or open a different project.

The Unity Editor-only controller on `127.0.0.1:17845` accepts an authenticated `openPreviewScene` command in addition to existing status/start/stop. On Unity's main thread it refuses to replace any dirty loaded scene, refuses to switch away from a different scene already in Play Mode, opens the fixed `Assets/Scenes/StudioLivingRoomExperimental.unity` scene otherwise, and returns the active scene path. Studio then requests Play Mode and connects to the unchanged runtime bridge on `127.0.0.1:17844`. The UI reports **Ready** only after Unity confirms Play Mode and bridge health. Bounded retries cover project startup, compile/import delay, and delayed bridge readiness; failures show detail and expose **Retry Start Unity**. Manual controls remain available.

## Verification

- `npm test -- --run`: **388 passed**, 56 files.
- Focused Unity startup/bridge tests: **73 passed**, 6 files. Includes correct project launch/reuse, fixed scene request, compile/import delay in Editor status, scene-open and Play Mode retries, delayed runtime readiness, timeout, launcher failure and retry, duplicate-click coalescing, and refusal to connect when the wrong scene is playing.
- `npm run test:service`: **22 passed**, including loopback/origin/token checks, launcher command validation, concurrent request coalescing and retry after launch failure.
- `scripts/review/Test-BrightTalesReviewLauncher.ps1`: **17 passed**, covering path quoting, exact-project process reuse, launch deduplication, port conflict, missing paths/tools and startup timeout.
- PowerShell parser check for `Start-BrightTalesReview.ps1`: passed.
- `npm run build`: passed. Vite retains its existing advisory that the main JavaScript bundle exceeds 500 kB.
- `git diff --check`: passed before commits.
- Unity 6000.6.7f1 and `Assets/Scenes/StudioLivingRoomExperimental.unity` were confirmed at their expected paths. The Unity Editor was not launched for this verification, so the changed C# controller has not been compiled in Unity in this run and no live GUI/button, Game-view, dirty-scene, or bridge startup was claimed.

## Manual review for Karl

1. Start Studio with `C:\Users\karlr\repos\brightsenappstales\Start-BrightTales-Review.cmd` and open **Cartoon Preview** in Studio.
2. With Unity closed, click **Start Unity**. Confirm the status advances through Launching Unity, Loading Project, Opening Scene, Entering Play Mode, Connecting, and Ready. In Unity, confirm the project is `BrightTalesUnityFoundationIntegration`, the active scene is `StudioLivingRoomExperimental`, and the Game view is visible.
3. With that project already open in Edit Mode, click **Start Unity** again. Confirm the same Editor is reused and the workflow reaches Ready without opening a duplicate Editor.
4. Make a harmless unsaved change in a disposable scene, leave it dirty, and click **Start Unity**. Confirm Studio asks you to save first and Unity leaves the dirty scene untouched. Save/revert the disposable change manually in Unity before continuing.
5. Stop Play Mode with **Stop Unity**. Retry startup after a temporary startup failure and confirm the error is actionable. Check bridge health/connection only after Studio displays Ready.
6. Confirm the preview scene and characters in Unity's Game view. Record visual acceptance separately; automated tests do not establish it.

## Preserved state and limits

The Unity worktree's pre-existing modifications to `ProjectSettings/Packages/com.unity.learn.iet-framework/Settings.json` and `ProjectSettings/ProjectAuditorSettings.asset` were left unstaged and unchanged. Studio's pre-existing `.playwright-mcp/*` files and P7 proof XML files were also left unstaged and unchanged. No screenshots or GUI recordings were generated because no live Unity/Studio GUI run was performed.

Karl's Unity visual acceptance remains pending. This report records technical implementation and automated verification only.

# BrightTales P8-P11 integration report

**Date:** 2026-10-26  
**Status:** Integrated locally and regression-verified. Karl's visual, Game-view and physical-audio acceptance remains pending.

## Source and target refs

| Repository | Source active-development head | Integration target before merge | Integration merge commit |
| --- | --- | --- | --- |
| Studio | `e7dd556781fbc4a0c06846925207a0f05ad5b042` | `main` `e483838085f4b2583bb5f90bc6bafb34680110eb` | `a68d58772a54a93682b204a87ccf34bcd49aa013` |
| Unity | `39a505fcc00c437860d0529a40e3fb9d96d0285d` | `cartoon-foundation` `0998a013fe5d33dd5c5d4c71a541564d49b28251` | `fa532c22d27e3cf71d4f539c911251b766dabb1d` |

Both target refs were strict ancestors of their source heads; there was no divergence. Studio had 19 incoming commits and Unity had 6. Each target was integrated with a normal `--no-ff` merge, preserving milestone history. Incoming Studio paths did not overlap its 29 pre-existing untracked browser/P7 proof files. Incoming Unity paths did not overlap the two modified settings files in its integration worktree or the five modified settings files in the active-development worktree. No historical branch or backup ref was deleted or rewritten.

## Verification

### Studio

- `npm test -- --run`: **342/342 passed**, 50 test files.
- `npm run build`: **passed**. Vite emitted its existing advisory for the approximately 656 kB main chunk.
- `npm run test:service`: **12/12 passed**.
- `scripts/review/Test-BrightTalesReviewLauncher.ps1`: **17/17 passed**, including integrated branch defaults, path quoting, readiness, repeat launch, missing dependencies, missing paths and port conflicts.
- `scripts/review/Test-BrightTalesReviewPreflight.ps1`: **13 pass, 1 warning, 0 blockers** on the integrated workspaces. The warning was that the optional local voice service was not running; Studio owns its startup.

### Unity focused regressions

On a clean detached test worktree at the Unity integration merge commit, six Play Mode fixtures completed: `BrightlingAutoBuilderPlayModeTest`, `BrightlingAutoBuilderBridgeWorkflowTest`, `BrightlingSceneCastPlayModeTest`, `StudioEpisodePlayModeTest`, `StudioScenePlayerPlayModeTest`, and `StudioSceneAudioPlayModeTest`.

- With `-nographics`: 11/12 passed. `SavedSceneBuildsAndDirectsTheExistingCustomActor` could not create its RenderTexture in Unity's null graphics device. This is an invalid mode for that camera capture test, not accepted as a product failure. The NUnit result is [`unity-focused-regressions-nographics.xml`](unity-focused-regressions-nographics.xml).
- Repeated with the graphics device enabled: **12/12 passed**, 0 failed, 0 skipped. NUnit evidence: [`unity-focused-regressions-graphics.xml`](unity-focused-regressions-graphics.xml); log: `unity-focused-regressions-graphics.log`.
- The broad Unity Play Mode suite was **not run**. Its existing browser-transfer test can wait for a live Studio request; no broad-suite pass is claimed.

The integration worktrees' modified Unity settings were not used for the test run. Their SHA-256 hashes were checked before and after; all five active-worktree edits and both integration-worktree edits were preserved. Tests ran in `C:\Users\karlr\AppData\Local\Temp\BrightTales P8-P11 Integration Unity Tests`.

## Bug polish

The integrated review launcher still expected both repositories to be on `brighttales-active-development` and defaulted Unity to the P10 development worktree. It would block Studio `main` and launch the wrong Unity checkout. The defaults now match integration: Studio `main` at `C:\Users\karlr\repos\brightsenappstales` and Unity `cartoon-foundation` at `C:\Users\karlr\repos\BrightTalesUnityFoundationIntegration`. The 17-case launcher suite verifies both branch identities. No other small reproducible P8-P11 bugs were found in this pass.

Integrated preflight confirmed the workspace paths and branch identities with 13 passes, one optional local voice-service warning and no blockers. It did not launch Unity or Studio during this verification pass. The target worktrees were left with their pre-existing untracked/modified files intact.

## Remaining manual acceptance

- P8 Studio camera visuals and timeline; Unity Game-view camera framing; physical audio listening.
- P9 Brightling construction/action appearance and update behavior in the live applications.
- P10 two modular Brightlings' appearance, persistence and Unity presentation.
- P11 live episode authoring, save/reopen, Unity playback and complete WebM export/play-through. The recorded P11 demo remains a manifest fixture, not a live saved/exported episode.

These gates remain pending Karl. The technical merge does not record or imply visual/audio acceptance. See [the review guide](../../docs/P8_P11_REVIEW_GUIDE.md) for the integrated launcher path and checklist.

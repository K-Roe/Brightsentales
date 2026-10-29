# BrightTales Project Directory Audit

**Audit date:** 2026-10-27  
**Scope:** Direct child folders of `C:\Users\karlr\repos` whose names match BrightTales/BrightSen Tales.  
**Mode:** Read-only inventory and source/document inspection. This report is the only new file. No application, Git metadata, project data, or existing evidence was changed.

## Executive findings

- There are **26 matching directories**. They are not 26 independent products or Git histories. Twelve Studio directories are Git worktrees from one Studio repository; twelve Unity Foundation directories are worktrees from one Unity repository. The standalone Python/Blender application and the frozen Unity V1.1 project are separate Git repositories.
- The strongest primary candidate for the current **2D Studio + Unity workflow** is `brightsenappstales` on `main`, with Unity `BrightTalesUnityFoundationIntegration` on `cartoon-foundation`. The Studio mainline contains the P8–P11 foundation integration and newer Studio additions. Current docs report passing automated suites/builds for those milestones; native visual, Game-view and physical listening approvals remain open. The working tree is dirty, and this audit did not rerun tests.
- `BrightTalesP10MakerStudio` / `BrightTalesP10MakerUnity` are useful development worktrees, but are not the newest complete application pair. The active Studio branch is behind the current mainline in features such as embedded preview, episode health checks/export reliability, Voice Maker V2 and automatic Unity preview startup. It also contains P8–P11 milestone work that is documented as integrated into main.
- `BrightTales` is a separate, substantial Python/vanilla-JS/Blender 5.2 production application. Its storyboard/Director, Blender shot build/render, BrightToons workflow, and Piper/Kokoro voices are unique relative to the React Studio. It is not a duplicate and should not be removed or silently folded into the 2D Studio. The two products have different rendering and data architectures.
- Unity Foundation worktrees contain approximately **13.77 GB** of logical Unity cache files (`Library`, `Temp`, `Logs`). Excluding the current integration checkout and the separate frozen V1.1 Unity checkout leaves about **11.06 GB** of potentially regenerable cache in other Foundation worktrees. Studio `node_modules` copies total roughly **1.1 GB** by per-directory inventory. These are estimates of logical file lengths, not verified NTFS allocated space. Potential cache/dependency recovery is therefore around **12 GB**, subject to preserving active review state and remeasurement before any cleanup.
- The active launcher has an exact path dependency on `C:\Users\karlr\repos\BrightTalesUnityFoundationIntegration` (environment override `BRIGHTTALES_UNITY_PROJECT_PATH` is supported). Several docs and scripts still contain historical P3–P10 paths. Any later relocation or directory removal must update and verify the live launcher/preflight references first.

## Inventory

`Studio worktree` and `Unity worktree` mean a checkout of a milestone branch sharing the parent repository's Git object database. “Dirty” counts are the read-only `git status --short` count from this audit; untracked review/proof material is included.

| Directory | Classification and purpose | Git / state |
|---|---|---|
| `brightsenappstales` | Primary React/Vite/TypeScript 2D Studio; Canvas scene renderer, character/place libraries, audio, episodes, browser export and optional Unity connection. | Studio worktree, `main`; **47 dirty entries** (includes in-progress Episode Library work and review artifacts). |
| `BrightTales` | Separate Python/vanilla-JS/Blender 5.2 production Studio. BrightToons, Storyboard, Director, saved voices and local 3D shot/render pipeline. | Independent Git repository, `main`; **8 modified files**. |
| `BrightTalesCartoonFoundationStudio` | Earlier Cartoon Foundation Phase 2 Studio checkout/proof baseline. | Studio worktree, `cartoon-foundation-phase2`; clean. |
| `BrightTalesCartoonFoundationUnity` | Phase 2 Unity project and experimental saved-scene player. | Unity worktree, `cartoon-foundation-phase2`; **2 modified settings files**. |
| `BrightTalesP3Audio` | P3 Studio milestone: local audio transfer/relay and Unity scene audio synchronization. | Studio worktree, `cartoon-foundation-p3-audio-sync`; clean. |
| `BrightTalesP3Unity` | P3 Unity receiver/player for validated local audio. | Unity worktree, matching P3 branch; clean. |
| `BrightTalesP4Episode` | P4 Studio episode playback/authoring bridge milestone. | Studio worktree, `cartoon-foundation-p4-episode-playback`; clean. |
| `BrightTalesP4Unity` | P4 Unity episode clock, repeated scenes and audio continuity. | Unity worktree, matching P4 branch; clean. |
| `BrightTalesP5Episode` | P5 Studio episode production workflow, scene sequence/timing and preview. | Studio worktree, `cartoon-foundation-p5-episode-production`; clean. |
| `BrightTalesP5Unity` | P5 Unity branch checkout; recorded no Unity source delta was needed for the milestone. | Unity worktree, matching P5 branch; clean; no sizeable Library cache detected. |
| `BrightTalesP6Episode` | P6 Studio scene occurrence timing and transitions. | Studio worktree, `cartoon-foundation-p6-scene-timing-transitions`; clean. |
| `BrightTalesP6Unity` | P6 Unity occurrence timing/fade playback. | Unity worktree, matching P6 branch; clean. |
| `BrightTalesP7Episode` | P7 Studio episode production/editor polish. | Studio worktree, `cartoon-foundation-p7-episode-production-polish`; clean. |
| `BrightTalesP7Unity` | P7 Unity regression/base checkout; no distinct P7 Unity source feature was required. | Unity worktree, matching P7 branch; clean. |
| `BrightTalesP8Camera` | P8 Studio episode camera/directing authoring and export. | Studio worktree, `cartoon-foundation-p8-camera-directing`; clean. |
| `BrightTalesP8Unity` | P8 Unity camera payload/player work. | Unity worktree, P8 branch; **5 modified settings files plus untracked `P8CameraReview/`**. Preserve review data. |
| `BrightTalesP9AutoBuilderStudio` | P9 Studio palette-based Brightling-to-Unity auto-builder. | Studio worktree, `cartoon-foundation-p9-brightling-auto-builder`; clean. |
| `BrightTalesP9AutoBuilderUnity` | P9 Unity auto-builder/bridge receiver. | Unity worktree, P9 branch; **6 modified settings files plus 2 untracked review bootstrap files**. |
| `BrightTalesP10MakerStudio` | P10 Maker V2 Studio and active-development branch; modular Brightling creation and later P11 work. | Studio worktree, `brighttales-active-development`; clean. |
| `BrightTalesP10MakerUnity` | Active-development Unity worktree for P10/P11 integration. | Unity worktree, `brighttales-active-development`; **6 modified Unity settings files**. |
| `BrightTalesStudio3` | Studio 3.0 experimental branch and associated proof checkout. | Studio worktree, `studio-3-experimental`; clean. |
| `BrightTalesStudio31` | Studio 3.1 direct-animation branch/proof baseline. | Studio worktree, `studio-3.1-direct-animation`; clean. |
| `BrightTalesStudio31UnityProof` | Detached Unity proof checkout at the Phase 2 revision; proof/capture purpose rather than a current integration target. | Unity worktree, detached; **5 modified settings files**. |
| `BrightTalesUnityFoundationIntegration` | Current Unity Cartoon Foundation integration project; review launcher target and P8–P11 integration branch. | Unity worktree, `cartoon-foundation`; **2 modified settings files**. This is the live configured Unity candidate. |
| `BrightTalesUnityTest` | Separate Unity repository for approved/frozen Cartoon Engine V1.1 and adjacent acting/bridge/rig experiments. | Independent Git repository, `cartoon-engine-v1-1-approved`; **14 untracked proof/review items**. Preserve approved baseline and experiments. |

## Active candidates and completeness

### Primary 2D Studio candidate

`C:\Users\karlr\repos\brightsenappstales` is the best primary candidate for the current React/Vite 2D Studio. Its `main` branch includes the merged P8–P11 foundation work per current project status, along with later Studio work including Voice Maker V2, episode health checks, embedded Canvas preview, Unity editor controls/startup, and the in-progress Episode Library/local-copy feature. Existing docs report automated tests/builds, but this audit did not rerun them and does not claim current UI, Game-view, audio or human acceptance. Its 47 dirty entries must be preserved before any future branch/cleanup operation.

### Primary Unity candidate

`C:\Users\karlr\repos\BrightTalesUnityFoundationIntegration` is the active Unity candidate because it is named in `scripts/studio.cjs`, `scripts/review/Start-BrightTalesReview.ps1`, the review preflight and current review guide. The configured scene is `Assets/Scenes/StudioLivingRoomExperimental.unity`; runtime bridge uses port 17844 and the editor-only control uses 17845. This project has two dirty Unity settings files. Unity `BrightTalesUnityTest` remains a separate approved/frozen V1.1 project, not a disposable duplicate.

### Separate 3D application

`BrightTales` is a working product candidate in its own right, with a different architecture and feature set. Current README describes a local Blender 5.2 pipeline, saved character/place/prop/voice libraries, deterministic Storyboard, Director working shots/previews, and BrightToons episode production. It includes Piper/Kokoro dependencies and its own runtime data and Blender assets. It has eight modified source/test files. Keep it intact and decide separately whether it is a supported companion production tool, a maintained legacy application, or a future migration source. The React Studio's current architecture explicitly uses Canvas and does not use Blender/3D, so treating the Python app as an obsolete duplicate would lose capability.

## Function comparison and older-only capabilities

| Capability | Current React Studio `main` | Older worktrees / distinct projects | Audit conclusion |
|---|---|---|---|
| Saved scenes, Canvas preview and browser export | Present; shared renderer is used by authoring/preview/export. | Studio 3/3.1 and Phase 2 worktrees are earlier snapshots. | No older Studio branch was identified as the unique home of the current scene engine. |
| Local scene audio / speech and episode playback | P3–P7 contracts are part of the mainline progression; current audio/episode paths extend them. | P3–P7 branches retain milestone checkpoints and proof. | Preserve proof and branch history; features are not a reason to keep every checkout active. |
| Episode timing, transitions, camera and production | P6/P7 timing and P8 camera/directing are documented as integrated; P11 adds modular episode workflow. | P4–P8 worktrees capture isolated milestone states. | Main is later, but check acceptance docs for limits (for example, crossfade remains unsupported). |
| Brightling Auto-Builder and Maker V2 | P9/P10 are in the integrated foundation path per current status and reports. | P9/P10 worktrees preserve isolated implementation and evidence. | Not unique to old branch based on current project status. |
| Episode health, embedded preview, Voice Maker V2, automatic Unity startup | Present in current mainline status/source inventory. | These are absent from the P10 active Studio snapshot relative to mainline. | A concrete regression risk if P10 active branch were mistaken for the current complete Studio. |
| Approved Cartoon Engine V1.1 / older animation experiments | Kept separate from the experimental saved-scene renderer. | `BrightTalesUnityTest` is the approved baseline and has experimental review folders. | Retain this project/history until a deliberate asset/behavior preservation review is complete. |
| Blender 3D production, deterministic Director, BrightToons, Piper/Kokoro | Not part of the React Studio's Canvas-only architecture. | Unique to standalone `BrightTales`. | No parity exists; preserve the app and its user data/artwork as a separate capability source. |

“Missing in newer versions” therefore has two answers: milestone features P3–P11 appear integrated into the current React Studio/Unity mainline according to project records; the standalone Blender application's production features are not in the newer React Studio and are not interchangeable. Before retiring any branch checkout, compare its source tree and user/evidence files against the target commit, particularly for dirty/untracked Unity review material. This audit did not execute historical branch test suites or prove feature parity by live UI use.

## Git and dependency findings

- Studio worktrees share the Studio repository/common Git store. Unity Foundation worktrees share the Unity Foundation repository/common store. P3–P10 directories are mostly branch-specific worktrees, not independent clones with independent histories.
- `BrightTales` and `BrightTalesUnityTest` have separate `.git` roots. Unity V1.1 and Blender project history must remain separate unless a deliberate migration is approved.
- Dirty state is present in: `brightsenappstales` (47 entries), `BrightTales` (8 modified files), `BrightTalesCartoonFoundationUnity` (2), `BrightTalesP10MakerUnity` (6), `BrightTalesP8Unity` (5 modified plus review folder), `BrightTalesP9AutoBuilderUnity` (6 modified plus 2 untracked), `BrightTalesStudio31UnityProof` (5), `BrightTalesUnityFoundationIntegration` (2), and `BrightTalesUnityTest` (14 untracked items). Do not reset, clean, delete or overwrite these during any later consolidation.
- React Studio worktrees each have an installed `node_modules` tree, typically about 0.07–0.10 GB. Repeated dependency trees are candidates for later removal/reinstall only after checkout and launch workflows no longer rely on those directories. Package manifests/locks should be kept as the dependency source of truth.
- Unity `Library` is regenerable cache, but it contains per-project import state and can make the next Editor launch slower. Measured logical cache total across the 12 Unity Foundation/V1.1 checkouts was 13.77 GB. Approximately 11.06 GB is in non-primary Foundation worktrees after excluding the configured integration project and the separate V1.1 project. Do not include source, assets, proofs, `.git` object stores, local story/episode data or user artwork in a cleanup estimate.

## Paths and integrations that depend on project locations

**Live defaults:**

- `scripts/studio.cjs`: defaults to `C:/Users/karlr/repos/BrightTalesUnityFoundationIntegration`; accepts `BRIGHTTALES_UNITY_PROJECT_PATH`, while its configuration health check currently expects the canonical exact path.
- `scripts/review/Start-BrightTalesReview.ps1` and `scripts/review/BrightTalesReview.psm1`: same Unity default; validate project structure, requested scene, Unity process identity and ports.
- `docs/ACTIVE_DEVELOPMENT.md` and `docs/P8_P11_REVIEW_GUIDE.md`: tell Karl to use the current Studio launcher and integration Unity checkout.
- Studio/Unity IPC depends on loopback ports 17844 (runtime) and 17845 (Editor control), the configured Studio origin, and the named review scene.

**Historical references:**

- `docs/ACTIVE_DEVELOPMENT.md` retains older P10 worktree launch instructions.
- Project status, roadmap, batch review and proof reports contain P3–P10 checkout paths, Unity executable paths, milestone evidence paths and older scene/manual launch steps.
- `BrightTales` itself has user-data/artwork conventions under `assets/`, local storyboards/Director projects, Blender files, voice models, and generated output; its README and `.gitignore` make these separate from source control. Preserve them if that project is later archived or relocated.

Any approved consolidation that changes locations should first update the live configuration and launch/preflight scripts, then search historical docs and clearly label retained historical paths. Verify the exact Unity project is launched before sending scene or episode payloads.

## Recommended consolidated structure

Keep the existing two canonical Git repositories and organize development through branches, not milestone-named sibling project folders:

```text
repos/
  brightsenappstales/                 # primary React/Vite Studio checkout
  BrightTalesUnityFoundationIntegration/ # primary Unity Foundation checkout
  BrightTales/                         # preserved Blender production capability; status to be decided
  BrightTalesUnityTest/                # protected approved Cartoon Engine V1.1 baseline
```

For future Studio/Unity milestones, create paired branches in the existing repositories, record the exact Studio and Unity commit IDs together, and use the canonical checkout when switching branches after its current dirty state has been safely resolved by Karl. Keep proofs under the relevant canonical repository's `proofs/` directory and record what was technically checked versus visually/listening approved. Do not make a new worktree per milestone unless isolation is specifically needed and its eventual retention is planned.

The Blender application should not be merged into the Canvas Studio as part of directory cleanup. Keep it intact as a separate capability until feature-by-feature migration is explicitly planned; its local character assets, Blender projects, storyboards, voices and rendered productions are valuable data and not duplicate dependencies.

## Risks and staged migration proposal

1. **Protect state first.** Review and checkpoint the dirty Studio, Blender and Unity worktrees without including unrelated changes. Inventory untracked review captures and local ignored data. No cleanup is authorized by this audit.
2. **Establish canonical refs.** Confirm the exact current Studio `main` and Unity `cartoon-foundation` refs/remotes, then record them with the current launcher target. Do not infer human acceptance from branch names or test records.
3. **Compare tree contents.** For every worktree proposed for retirement, compare source tree/commit ancestry with canonical refs and list unique tracked files plus all dirty/untracked/user data. Preserve proofs and the approved Unity V1.1 repository.
4. **Consolidate location references.** Only after deciding the final paths, update launcher environment defaults, exact-path checks, scripts, review docs and startup guides together; run preflight and verify launch selects the intended Unity project and scene.
5. **Prove capabilities.** Run the documented Studio suite/build and focused Unity tests; then manually review Studio rendering, Unity Game view, saved/reopened episodes, actual exports and audio. Separately smoke-test the Blender app and its local Piper/Kokoro/FFmpeg/Blender path if it remains supported.
6. **Recover cache space last.** Once no open Unity process or required test checkout uses an old `Library`, remove only explicitly approved regenerable caches/dependencies and remeasure. Preserve all source, Git history, assets, approvals, proof captures and user data.

### Approval boundary

This report recommends a structure; it does not authorize moving, renaming, deleting, merging, changing branches, cleaning caches, rewriting launcher configuration, or modifying either application. Those actions require Karl's approval after reviewing this inventory and resolving the intended long-term role of the separate Blender Studio.

## Evidence and limitations

Inventory used directory markers, Git branch/status/worktree listings, project documentation and source search. Directory sizes were obtained by recursive file-length sums; Unity cache totals were measured separately. These values are logical lengths and may differ from allocated disk usage. No app was launched, no test suite was run, no remote was contacted, and no visual/audio acceptance was attempted. Existing project reports are cited as recorded evidence, not independently revalidated in this audit.

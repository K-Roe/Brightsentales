# BrightTales Active Development

Updated 2026-10-26.

## Current workspaces

| Repository | Branch | Commit | Remote |
| --- | --- | --- | --- |
| Studio | `brighttales-active-development` | P11 implementation `5d2ba8ad3231fad7bc0b9cf1e05df852c4490835` (plus a later state-document refresh) | `origin/brighttales-active-development` |
| Unity | `brighttales-active-development` | P11 implementation `623a2651acd4a37c236467f8201a97d5454c0a48` | `origin/brighttales-active-development` |

P8, P9 and P10 are already in the P10 development ancestry. No duplicate merges or cherry-picks were needed. Studio's P10 implementation base is `63940ebc07413f17ea98aa5fa65e354ce929b56f`; the current Studio branch adds documentation/evidence commits. Backup refs for each P8/P9/P10 head are retained under `refs/backup/brighttales-active-development/` in both repositories. Historical milestone branches and protected integration branches remain unchanged. P8–P10 are not merged to Studio `main` or Unity `cartoon-foundation`.

## Launch tonight

Open PowerShell window 1 for Studio:

```powershell
Set-Location 'C:\Users\karlr\repos\BrightTalesP10MakerStudio'
$env:VITE_UNITY_BRIDGE_PORT = '17844'
npm start
```

Open PowerShell window 2 for the Unity Editor:

```powershell
Set-Location 'C:\Users\karlr\repos\BrightTalesP10MakerUnity'
$env:BRIGHTTALES_UNITY_BRIDGE_PORT = '17844'
& 'C:\Program Files\Unity\Hub\Editor\6000.6.7f1\Editor\Unity.exe' -projectPath 'C:\Users\karlr\repos\BrightTalesP10MakerUnity'
```

In Unity open `Assets/Scenes/StudioLivingRoomExperimental.unity`, then press **Play**. In Studio use the existing Unity connection panel / Brightling Maker **Send to Unity** workflow. Keep the Unity project open while Studio connects.

Unity's worktree still has five unrelated modified editor settings files. Leave those files alone. The original P8 review worktree and `P8CameraReview/` are also preserved.

## P10 verification baseline (historical)

- Studio `npm test -- --run`: **337/337 passed** (49 test files).
- Studio `npm run build`: **passed**. Vite reports the existing large-chunk advisory (main JS ~656 kB); build completes successfully.
- Unity P10 Brightling builder Play Mode tests: **2/2 passed**, including import/update/actions and three distinct modular characters with update-without-duplication. XML/log: `../proofs/cartoon-foundation-p10/active-unity-builder-tests.xml` and `.log`.
- The earlier P10 report records focused Studio/Unity bridge and saved scene/episode-cast checks and also documents failures in the broader headless Unity run. Prior P9 report records a real Maker-to-Unity walkthrough, but P10 Studio UI walkthrough, P10 app screenshots, and current integrated P8–P10 application workflow were not newly verified here.

Automated checks do not constitute Karl's visual or audio acceptance. Studio visuals, Unity Game-view visuals, and physical audio remain pending for the applicable P8–P10 work. Review P8 camera/audio first, then P9 transfer, then P10 modular characters. Evidence and exact limits: `../proofs/cartoon-foundation-p8/MANUAL_REVIEW.md` and the P8/P9/P10 reports.

## P11 Episode Production & Polish (2026-10-26)

Karl supplied and approved the full P11 specification; it is recorded in `../proofs/cartoon-foundation-p11/REPORT.md`. P11 extends the existing Episode Maker, canonical scene/episode clock, modular character definitions, camera director, audio cues, Unity bridge and scene player. Studio now displays saved modular Brightling names in camera targeting, labels the supported existing `wait` action as **Idle / Wait**, and clarifies Unity preview compatibility. Unity validates camera targets for modular cast IDs and its existing player builds the supported cast.

Verification: Studio focused episode/camera/bridge/demo tests **27/27**, full suite **342/342**, production build passed. Unity P11 modular two-character episode camera/action/replay test **1/1** and existing episode/audio/camera regression class **5/5** passed. A separate broad Play Mode run stalled in an existing browser-transfer test waiting for Studio and has no overall XML. The live browser authoring/save/reopen/replay, genuine episode transfer, complete WebM export and actual application screenshots were not captured. The P11 demo currently is a reviewable manifest fixture in `../proofs/cartoon-foundation-p11/demo-episode.json`, not a Studio-saved or exported episode. Karl's P8–P11 visual and physical-audio reviews remain pending; no protected-branch merge or P12 is authorized.

### Review sequence

1. Review P8 camera in Studio and Unity Game view; physically listen to its episode audio.
2. Review P9 automatic Brightling construction and the existing supported actions.
3. Review P10 modular character creation, saving/reopening and Unity appearance.
4. In Studio, create/select two modular Brightlings; add both to saved Living Room scenes, set positions, assign Idle / Wait, Walk and Wave, then compose an episode. Add two or more episode camera shots, target each character and choose supported movement. Add a supported episode/scene audio cue. Scrub, replay, save and reopen; then connect to Unity, send and play the episode; export the full WebM and verify it plays to the end.
5. Record explicit APPROVE / CHANGES / REJECT / PAUSE / SKIP decisions separately for each milestone and each visual/audio gate. Do not infer review acceptance from these automated checks.

## Next review actions

1. Review P8 Studio camera preview, Unity Game-view playback, and physically listen to its episode audio.
2. Review P9 Brightling transfer and Unity construction/actions.
3. Review P10 modular Brightling creation and Unity appearance/actions.
4. Follow the P11 episode workflow above and review its Studio/Unity behavior plus the exported episode.

P8–P11 technical test results do not imply human approval. No protected integration merge or P12 is authorized.
# P8-P11 review launcher (2026-10-26)

A one-click Windows launcher and reusable PowerShell preflight are available at `Start-BrightTales-Review.cmd`, `Check-BrightTales-Review.cmd`, and `scripts/review/`. The human review steps are in `docs/P8_P11_REVIEW_GUIDE.md`. The launcher targets Studio/Unity active-development workspaces, bridge 17844 and the StudioLivingRoomExperimental scene; it logs under `%LOCALAPPDATA%\BrightTales\ReviewLauncher` and never terminates processes or changes Unity settings.

Preflight checks workspace/tool/dependency/scene/branch/bridge identity, running app identity and local voice readiness. Existing Studio instances without the new health identity are blocked for manual close/retry rather than reused or killed. The live preflight passed 13 checks and found legacy servers at ports 4177 and 5173 without the launcher health identity. Consequently full GUI startup was not attempted; close both normally and retry. P8-P11 visual and physical audio approval remains pending.

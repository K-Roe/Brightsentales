# BrightTales Active Development

Updated 2026-10-26.

## Current workspaces

| Repository | Branch | Commit | Remote |
| --- | --- | --- | --- |
| Studio | `brighttales-active-development` | `8b692eb937637b59c91897ed6ac613b8b0d8d56f` | `origin/brighttales-active-development` |
| Unity | `brighttales-active-development` | `cea276c32ea1a8e7dd1e0dfc6ce240b8e5cc9285` | `origin/brighttales-active-development` |

P8, P9 and P10 are already in the P10 development ancestry. No duplicate merges or cherry-picks were needed. Studio's P10 implementation base is `63940ebc07413f17ea98aa5fa65e354ce929b56f`; the current Studio head adds this documentation/evidence commit. Backup refs for each P8/P9/P10 head are retained under `refs/backup/brighttales-active-development/` in both repositories. Historical milestone branches and protected integration branches remain unchanged. P8–P10 are not merged to Studio `main` or Unity `cartoon-foundation`.

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

## Technical verification checkpoint

- Studio `npm test -- --run`: **337/337 passed** (49 test files).
- Studio `npm run build`: **passed**. Vite reports the existing large-chunk advisory (main JS ~656 kB); build completes successfully.
- Unity P10 Brightling builder Play Mode tests: **2/2 passed**, including import/update/actions and three distinct modular characters with update-without-duplication. XML/log: `../proofs/cartoon-foundation-p10/active-unity-builder-tests.xml` and `.log`.
- The earlier P10 report records focused Studio/Unity bridge and saved scene/episode-cast checks and also documents failures in the broader headless Unity run. Prior P9 report records a real Maker-to-Unity walkthrough, but P10 Studio UI walkthrough, P10 app screenshots, and current integrated P8–P10 application workflow were not newly verified here.

Automated checks do not constitute Karl's visual or audio acceptance. Studio visuals, Unity Game-view visuals, and physical audio remain pending for the applicable P8–P10 work. Review P8 camera/audio first, then P9 transfer, then P10 modular characters. Evidence and exact limits: `../proofs/cartoon-foundation-p8/MANUAL_REVIEW.md` and the P8/P9/P10 reports.

## P11 scope gate

No P11 report, requirements checklist, or acceptance criteria were found in the repositories or existing handover documents. The current project TODO says “No P11.” Because “Episode Production & Polish” alone does not define the required behavior or acceptance boundaries, P11 implementation is waiting for Karl to provide the existing checklist or an approved scope. The active branches remain ready for that work; no speculative P11 feature changes were made.

## Next review actions

1. Review P8 Studio camera preview, Unity Game-view playback, and physically listen to its episode audio.
2. Review P9 Brightling transfer and Unity construction/actions.
3. Review P10 modular Brightling creation and Unity appearance/actions.
4. Provide/confirm P11 acceptance requirements; then implement and verify P11 on these active branches.

No approval of P8–P10 is implied by these tests. No P11 or P12 work is approved by silence.

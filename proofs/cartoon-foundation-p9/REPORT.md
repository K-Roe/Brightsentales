# Brightling Auto-Builder V1 — P9 technical report

**State (2026-10-26):** P9 direct Maker-to-Unity import, update, action commands and Unity application restart were exercised in the real applications, in addition to the automated checks. P9 remains isolated and unmerged. Karl's visual acceptance is pending; application screenshots are technical evidence, not human approval.

## Branches and bases

- Studio branch: `cartoon-foundation-p9-brightling-auto-builder`, based directly on P8 Studio `80f42abdb8f3c892d50fafe0672b16ca10ca6fed`.
- Unity branch: `cartoon-foundation-p9-brightling-auto-builder`, based directly on P8 Unity `52e79d72954ea071379abe498cfb80e4f383703f`.
- P8 remains unmerged; P7 integration remains Studio `main` `e483838085f4b2583bb5f90bc6bafb34680110eb` and Unity `cartoon-foundation` `0998a013fe5d33dd5c5d4c71a541564d49b28251`.
- Studio implementation: `c026d83d185ecac250939389b65993b6e74ae5b7`.
- Unity implementation: `fe40c5282e5e03ab6cb858a749a63926dcee8e81` (identical to P9 base because P9 Unity source was already committed).

## Implementation

Studio extends the existing Characters/Brightling Maker card. Its existing template, name and body/hair/clothing color editor remains the authoring path; save and reopen remain in the existing local library. A saved custom Brightling card now has **Send to Unity**. Studio first checks the existing Unity bridge, packages the nine supported poses, sends the definition and checks Unity's HTTP status and matching identity/revision acknowledgement. Only after acknowledged import does the card expose Idle, Blink, Walk and Wave action buttons.

Transfer schema `brighttales.brightling` version 1 is serialized with stable property/frame order. It includes stable ID, display name, template/version, palette, one whole-body part with layer/pivot/scale, supported actions, and the nine embedded PNGs with SHA-256 hashes. Studio validates identity and appearance, generated PNG signatures and per-image/total payload sizes. No code or executable data is transferred.

Unity extends `BrightTalesBridgeV0` with `brightling.import` and `brightling.action` on its existing local command queue. `BrightlingAutoBuilderV1` enforces schema/version, allow-listed properties, identity/name/template/palette/action limits, exact supported frame set, PNG MIME/signature, dimensions, payload bounds and hashes. It constructs one runtime GameObject/SpriteRenderer actor, replaces same-ID imports in place, persists the validated definition under `Application.persistentDataPath/brightlings-v1`, and restores saved characters when the builder starts. The actor adapts existing frame art to Idle, Blink, Walk and Wave; it does not add a parallel skeletal animation system or create persistent Unity prefab assets.

## Changed files

Studio:

- `src/brightlingTransfer.ts`, `src/brightlingTransfer.test.ts`, `src/Characters.tsx`
- P9 state/architecture/roadmap/decision/TODO/handover docs and this report
- Play Mode XML/log evidence below

Unity:

- `Assets/BrightTalesBridgeV0.cs`
- `Assets/CartoonFoundationExperimental/BrightlingAutoBuilderV1.cs` and `.meta`
- `Assets/Tests/PlayMode/BrightlingAutoBuilderPlayModeTest.cs` and `.meta`
- `Assets/Tests/PlayMode/BrightlingAutoBuilderBridgeWorkflowTest.cs` and `.meta`

The five editor-generated settings modifications in the P9 Unity worktree are unstaged and excluded from commits. The unrelated settings files and `P8CameraReview/` in the original P8 Unity worktree were not changed by this work.

## Automated verification

- Studio focused transfer tests: 5/5.
- Studio full test suite: `npm test -- --run`, 48 files / 330 tests passed.
- Studio production build: `npm run build` passed (existing Vite large-chunk advisory).
- Studio service/relay lifecycle: 12/12 passed in 48.85s. The known Windows Node/libuv assertion did not recur. No forced-exit flag was used; the prior P8 report records why `--test-force-exit` is unsafe.
- Unity builder Play Mode: 1/1 passed, including construction, four action registrations, hash rejection, stable-ID update, duplicate prevention, persistence and restore. See `unity-p9-playmode.xml` and `.log`.
- Unity real loopback bridge workflow: 1/1 passed for import, update and four acknowledged action commands. See `unity-p9-bridge.xml` and `.log`.
- P8 Unity episode/camera regression: 5/5 passed (`unity-episode.xml`); saved-scene player: 1/1 (`unity-player.xml`); scene audio: 1/1 (`unity-audio.xml`).
- Existing P8 browser-to-Unity V3 results remain in the P8 report. P9's separate Studio-browser-to-Unity workflow was not run to completion.

One earlier external-browser bridge test attempt timed out and is retained as `unity-p9-e2e.xml`/`.log`; it is superseded by the successful self-contained real HTTP loopback bridge test above. It is not counted as a pass.

## Application workflow and evidence

Using disposable Studio origin `http://localhost:4177`, the existing P9 Studio branch, Unity Editor 6.6 and bridge port 17844, the full direct Maker transfer path was exercised:

1. Created `P9 Testling` from the existing Maxine template and changed body, hair and clothing colours.
2. Saved, edited, and reopened the saved card in Studio.
3. Unity acknowledged `imported`; the character appeared in the Unity Game view.
4. Studio sent Idle, Blink, Walk and Wave commands; Unity returned matching action acknowledgements.
5. Changed body/clothing colours, saved and transferred again. Unity acknowledged `updated`, the same ID remained represented by one card, and the Game view showed the updated colours.
6. Restarted the Unity application. Its Game view showed the persisted `P9 Testling` with its updated appearance. The restart application's Unity bridge was not available after editor startup, so the post-restart bridge health check is **NOT VERIFIED**.

Real application screenshots are `studio-maker-preview.png`, `studio-saved-reopened.png`, `unity-game-view-p9.png`, `unity-game-view-p9-actions.png`, `unity-game-view-p9-updated.png`, and `unity-restart-after-warning.png`. The restart warning screenshot is retained as context in `unity-restart-blocker.png`; it was Unity's administrator warning, dismissed with **Ignore Warning**. Screenshots include actual Studio/Unity windows and are not synthetic illustrations.

P9 custom Brightlings are supported by existing Studio library, timed-scene validation, preview, backup and export paths. **Unity saved-scene/episode transfer still rejects custom cast members**; the Unity saved-scene contract currently only admits Max and Maxine. This is an explicit remaining integration limitation and is addressed as P10 work, not represented as complete P9 support. Exact Studio/Unity visual parity and Karl's visual acceptance remain **PENDING KARL**.

The supported template is a recolored Max/Maxine whole-body artwork set, not a new anatomical design. Available customization is limited to the existing template, name and three palette colors. There are no independently assembled body parts. Source art has no closed-eye frame, so Blink is a short deterministic squash and must be judged visually. The Unity actor uses a single body SpriteRenderer; it does not create an editor asset, prefab, or saved-scene character hierarchy. Imported runtime data is persisted in Unity's application data folder and reconstructed when the builder starts.

## Manual review steps for Karl

These steps use the isolated P9 worktrees; they do not merge either branch. This is a review attempt, not an approval record.

1. In PowerShell start the Studio built from P9:

   ```powershell
   Set-Location 'C:\Users\karlr\repos\BrightTalesP9AutoBuilderStudio'
   $env:VITE_UNITY_BRIDGE_PORT = '17844'
   npm start
   ```

2. In a second PowerShell window launch the isolated Unity project:

   ```powershell
   $env:BRIGHTTALES_UNITY_BRIDGE_PORT = '17844'
   & 'C:\Program Files\Unity\Hub\Editor\6000.6.7f1\Editor\Unity.exe' -projectPath 'C:\Users\karlr\repos\BrightTalesP9AutoBuilderUnity'
   ```

   Open `Assets/Scenes/StudioLivingRoomExperimental.unity` in Unity and press the toolbar **Play** button. Keep Play mode active. Unity may show an Administrator Privileges Detected dialog in elevated sessions; use **Ignore Warning** to continue this review run.

3. In Studio, open **Characters** and choose **Create Brightling**. Select a template; enter a new name; choose body, hair and clothing colors; inspect the preview; **Save**. Edit the saved card, change a color, save again, and confirm it reopens with the same ID and settings.
4. On that saved character card, press **Send to Unity**. Wait for the explicit `imported`/`updated` success message. The new character should appear in the Unity Game view without creating Unity objects manually. If it fails, retain the exact error; a sent HTTP request alone is not success.
5. Use the card's **Idle**, **Blink**, **Walk** and **Wave** buttons. Inspect the Game view and judge pose appearance, color, placement, timing and whether each action is understandable. Change a color in Studio, save and send again; the same character should update without a duplicate.
6. For persistence, stop and restart Unity, reopen the same P9 project/scene, enter Play mode and check whether the imported character is restored. This application restart behavior is a manual check and has not been visually verified by the automated evidence. Studio browser data remains in that browser profile.

Record Studio appearance and Unity appearance/action feedback separately as **APPROVE**, **CHANGES**, or **REJECT**. Automated checks, the runtime acknowledgement, and this checklist do not imply approval. P8's Studio visual, Unity Game-view visual and physical audio gates are separate and still pending in `proofs/cartoon-foundation-p8/MANUAL_REVIEW.md`.

## Git and remaining work

- Studio implementation commit: `09d95d46a58dcf73d7e17076de94514eb63bf004`; original P9 branch checkpoint `c026d83d185ecac250939389b65993b6e74ae5b7`.
- Unity implementation commit: `58bd1dcd371bc9c51bedde2b5dcab0254004c8be`; validation test follow-up: `fe40c5282e5e03ab6cb858a749a63926dcee8e81`.
- This report's application verification and screenshots are being added to the Studio P9 branch. Unity source has no new P9 change; editor-generated settings remain unstaged and excluded.
- Both P9 branches remain unmerged. P10 is authorized on new isolated branches from these P9 development heads.

Remaining actions: Karl manually review the Studio preview and Unity Game view/actions; verify the actual app-to-app workflow and Unity application restart; decide whether the limited whole-body Blink and palette template meet expectations; and review the known saved-scene/episode integration gap. P8's three explicit approvals also remain outstanding. No P9 or P8 merge is authorized by this report.

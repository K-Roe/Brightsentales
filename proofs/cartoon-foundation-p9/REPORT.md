# Brightling Auto-Builder V1 — P9 technical report

**State (2026-10-26):** isolated P9 implementation and automated verification complete for the supported whole-body template path. P9 is not merged. Karl's visual acceptance is pending. This report does not claim the Definition of Done: the full Studio browser to Unity Game-view workflow could not be completed in this session.

## Branches and bases

- Studio branch: `cartoon-foundation-p9-brightling-auto-builder`, based directly on P8 Studio `80f42abdb8f3c892d50fafe0672b16ca10ca6fed`.
- Unity branch: `cartoon-foundation-p9-brightling-auto-builder`, based directly on P8 Unity `52e79d72954ea071379abe498cfb80e4f383703f`.
- P8 remains unmerged; P7 integration remains Studio `main` `e483838085f4b2583bb5f90bc6bafb34680110eb` and Unity `cartoon-foundation` `0998a013fe5d33dd5c5d4c71a541564d49b28251`.
- Final P9 commit hashes are recorded below after implementation commits.

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

## Evidence and verification limits

No Studio or Unity Game-view screenshots/recording were captured. The configured Browser-control skill required a Node REPL integration unavailable in this session; a fallback disposable CDP attempt stalled before interaction. Unity automated tests ran headless. Consequently:

- Full one-click Studio-to-Unity app workflow: **NOT VERIFIED**.
- Actual appearance/colors in Unity Game view: **NOT VERIFIED**.
- Restarting the Unity application and reviewing the restored result visually: **NOT VERIFIED**. Automated coverage recreates the builder and confirms persistence/restore within the test lifecycle.
- P9 custom Brightlings in saved Studio scene/episode cast validation and playback: **NOT IMPLEMENTED**. The feature sends a character to the existing Unity runtime scene and action adapter; it does not make the new character available in saved episode authoring.
- Unity comparison with Studio rendering / human visual acceptance: **PENDING KARL**.

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

   Open `Assets/Scenes/StudioLivingRoomExperimental.unity` in Unity and press the toolbar **Play** button. Keep Play mode active.

3. In Studio, open **Characters** and choose **Create Brightling**. Select a template; enter a new name; choose body, hair and clothing colors; inspect the preview; **Save**. Edit the saved card, change a color, save again, and confirm it reopens with the same ID and settings.
4. On that saved character card, press **Send to Unity**. Wait for the explicit `imported`/`updated` success message. The new character should appear in the Unity Game view without creating Unity objects manually. If it fails, retain the exact error; a sent HTTP request alone is not success.
5. Use the card's **Idle**, **Blink**, **Walk** and **Wave** buttons. Inspect the Game view and judge pose appearance, color, placement, timing and whether each action is understandable. Change a color in Studio, save and send again; the same character should update without a duplicate.
6. For persistence, stop and restart Unity, reopen the same P9 project/scene, enter Play mode and check whether the imported character is restored. This application restart behavior is a manual check and has not been visually verified by the automated evidence. Studio browser data remains in that browser profile.

Record Studio appearance and Unity appearance/action feedback separately as **APPROVE**, **CHANGES**, or **REJECT**. Automated checks, the runtime acknowledgement, and this checklist do not imply approval. P8's Studio visual, Unity Game-view visual and physical audio gates are separate and still pending in `proofs/cartoon-foundation-p8/MANUAL_REVIEW.md`.

## Git and remaining work

- Studio implementation commit: `09d95d46a58dcf73d7e17076de94514eb63bf004`.
- Unity implementation commit: `58bd1dcd371bc9c51bedde2b5dcab0254004c8be`; validation test follow-up: `fe40c5282e5e03ab6cb858a749a63926dcee8e81`.
- Documentation and proof are committed on the Studio P9 branch; the final branch tip is reported in the handover/final response.
- Both P9 branches will be pushed to `origin`; neither will be merged.

Remaining actions: Karl manually review the Studio preview and Unity Game view/actions; verify the actual app-to-app workflow and Unity application restart; decide whether the limited whole-body Blink and palette template meet expectations; and review the known saved-scene/episode integration gap. P8's three explicit approvals also remain outstanding. No P9 or P8 merge is authorized by this report.

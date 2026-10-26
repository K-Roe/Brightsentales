# P10 Brightling Maker V2 — technical report

**State: implemented on isolated branches; focused automated checks passed; manual visual acceptance pending.** P8 and P9 remain unmerged. No Studio UI screenshot or human visual acceptance was captured for P10.

## Scope and architecture

P10 extends the existing Characters Maker, saved Brightling library, deterministic whole-body frame generator, `brightlingTransfer` contract and localhost Unity bridge. A version-2 optional appearance block adds supported head shape, eye style, ear length, hair style, head decoration, body proportion and clothing style. The classic template path and legacy library entries remain valid. The same generated nine pose PNGs and their hashes are transferred to Unity, so Studio and Unity display the same raster assets and ordering. The optional appearance metadata is validated by Unity; it does not carry executable code.

The Maker exposes a Classic/Modular choice and controls for the supported features and existing colors. Modular entries use the existing save/edit/reopen library path and scene/episode stores. Studio saved-scene and episode transfer now includes each referenced custom Brightling definition. Unity imports the existing definition by stable ID and reuses its existing actor, frame animation and scene player; repeated imports update that actor. Legacy characters without appearance metadata keep their original behavior.

P9's application workflow was verified separately on its P9 branch: Studio save/reopen, genuine Unity import/update/action acknowledgements, and Unity application restart persistence were exercised with real application windows. P9 evidence and screenshots are in `../cartoon-foundation-p9/REPORT.md` and its screenshot files. P10-specific browser interaction and Unity Game-view visual equivalence are **NOT VERIFIED**.

## P10 changes

Studio changes are in `src/brightling.ts`, `src/maker.ts`, `src/Characters.tsx`, `src/brightlingMakerV2.css`, `src/brightlingTransfer.ts`, the scene/episode bridge and their tests. `proof-characters.json` contains three test fixtures (Pip, Mallow and Juniper) with distinct supported appearances. They are fixtures, not characters created through the live UI or transferred in this run.

Unity changes are in `Assets/CartoonFoundationExperimental/BrightlingAutoBuilderV1.cs`, `StudioScenePlayer.cs`, `Assets/BrightTalesBridgeV0.cs` and Play Mode tests. The saved-scene player accepts custom definitions, constructs/updates the existing actor by ID, evaluates supported actions on the existing scene clock and hides the imported scene cast on reset. Existing P8 camera/episode and P9 direct import code paths remain in place.

## Verification

- Studio full suite: `npm test -- --run` — **49 files, 337 tests passed**.
- Studio build: `npm run build` — **passed**; Vite emitted its existing advisory about the 655.53 kB main chunk.
- Unity builder validation/import/update/animation/persistence plus three distinct modular proof definitions and stable-ID update: **2/2 passed**, `unity-builder-tests.xml` and `.log`.
- Unity HTTP bridge modular import/update/action acknowledgement: **1/1 passed**, `unity-bridge-tests.xml` and `.log`.
- Unity saved-scene and saved-episode custom cast construction, walk/wave frame evaluation, identity deduplication and reset: **1/1 passed**, `unity-scene-tests.xml` and `.log`.
- P8 Unity scene/player compatibility regression: **1/2 passed**. Camera rejection and existing command safety passed. The 26-second browser-to-Unity case waited for Studio to send a scene and failed because no browser workflow ran; `unity-p8-regression.xml` and `.log` preserve the result. P9's earlier full P8 episode/camera and player regression results remain documented in the P9 report.
- Initial Unity cold-import invocation produced no test XML. The first broad Play Mode run used `-nographics` and reported 6/23 passed, 17 failed: it prevented render-texture tests, had no configured bridge port/proof directories, exposed the two P10 issues later fixed, and included browser workflows without Studio. This is not reported as a passing suite. Unity Editor also rewrote generated settings in its worktree; those files were not staged.
- Browser UI create/save/reopen/send walkthrough, P10 Studio screenshot and Karl's Studio/Unity visual acceptance: **NOT VERIFIED / PENDING KARL**. `unity-p10-camera-capture-diagnostic.png` is an actual Unity camera render, but the test fixture artwork is only 2×2 pixels and the character is not legibly visible; it is retained as a capture diagnostic, not appearance evidence.
- The P9 restart run restored the character visually, but bridge health after restart was not verified. P10 does not change that observation.

## Supported options and limits

Supported shapes are deliberately small: round/wide head; round/sparkle eyes; short/long ears; tuft/swoop hair; none/star decoration; standard/tall body; hoodie/jacket clothing. This is deterministic vector-derived whole-body artwork, not a jointed rig or a new anatomical design. Animation remains the existing pose-frame animation. Blink is still the P9 squash because there is no approved closed-eye frame. No Max or Maxine source art was changed. Three sample definitions provide shape coverage but have not received human review.

Studio/Unity visual parity is expected from identical transferred pose PNGs, but graphical comparison is **NOT VERIFIED**. Studio scene and episode payload construction has automated coverage; Unity custom saved-scene playback passed. An actual browser-generated custom scene/episode transfer and Unity Game-view appearance review remain for Karl.

## Branches and delivery

- P9 Studio branch: `cartoon-foundation-p9-brightling-auto-builder`; last reported documentation checkpoint `6a471a133490d4b32ac3d1e6d9a725f4d0c709a8`.
- P9 Unity branch: `cartoon-foundation-p9-brightling-auto-builder`; `fe40c5282e5e03ab6cb858a749a63926dcee8e81`.
- P10 Studio branch: `cartoon-foundation-p10-brightling-maker-v2`, based on P9 Studio `6a471a133490d4b32ac3d1e6d9a725f4d0c709a8`.
- P10 Unity branch: `cartoon-foundation-p10-brightling-maker-v2`, based on P9 Unity `fe40c5282e5e03ab6cb858a749a63926dcee8e81`.
- P10 Studio and Unity final commits will be added here after isolated commits and pushes complete.

## Manual review sequence

1. Review P8 Studio camera direction, Unity Game view and physical episode audio using `../cartoon-foundation-p8/MANUAL_REVIEW.md`.
2. Review P9 transfer using the P9 report's commands and steps. Confirm create, save/reopen, four actions, same-ID update and restart restore.
3. Open two PowerShell windows. Start P10 Studio in the first:

   ```powershell
   Set-Location 'C:\Users\karlr\repos\BrightTalesP10MakerStudio'
   $env:VITE_UNITY_BRIDGE_PORT = '17844'
   npm start
   ```

   Start P10 Unity in the second:

   ```powershell
   $env:BRIGHTTALES_UNITY_BRIDGE_PORT = '17844'
   & 'C:\Program Files\Unity\Hub\Editor\6000.6.7f1\Editor\Unity.exe' -projectPath 'C:\Users\karlr\repos\BrightTalesP10MakerUnity'
   ```

   Open `Assets/Scenes/StudioLivingRoomExperimental.unity` in Unity and press **Play**. Keep Play mode active.
4. In Studio, open **Characters → Create Brightling**, choose **Modular Brightling**, change head, eyes, ears, hair, decoration, body and clothing settings, then inspect the preview. Save, leave the editor, reopen the saved card and confirm the same options and appearance.
5. Add the saved character to a Living Room scene and, separately, an episode. Use the existing **Send to Unity** scene/episode controls. Verify the custom identity/appearance, playback, reset and repeated sends without duplication.
6. Test Idle, Blink, Walk and Wave on the character card. Compare P10 Studio preview with Unity Game view. Record any unsupported action or visual difference; do not infer approval from automated results.
Branches stay isolated. P8, P9 and P10 remain unmerged pending Karl's explicit decisions. No P11 work is included.

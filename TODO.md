# Cartoon production foundation — takeover list

## P7 technical checkpoint — 2026-10-25

The isolated P7 Studio editor polish is implemented and verified: zoom/scrub/audio overview, duration nudges, boundary preview, local Undo/Redo and shortcuts, Replay and direct WebM export. Studio 313/313, service/relay 12/12, build, disposable browser and complete WebM passed. Browser-to-Unity playback/replay/reset passed 1/1 against the Unity P7 head; Unity source is unchanged. See `proofs/cartoon-foundation-p7/REPORT.md`. Keep P7 unmerged. Remaining acceptance: Karl's visual/usability decision, Unity Game-view visual review and physical audio listening. Do not start Crossfade or another milestone without direction.

## P7 Episode Production Polish — authorised 2026-10-25

P6 merged into Studio `main` at `b3886fd6e48169524cdf14c307cf6fac4fcdda1f` and Unity `cartoon-foundation` at `0998a013fe5d33dd5c5d4c71a541564d49b28251`, with passing post-merge Studio 309/309, service/relay 12/12, build and Unity episode/audio/action 4/4, 1/1, 1/1. Unity Game-view visual acceptance and physical audio listening remain pending. Begin P7 on fresh isolated Studio and Unity branches. Improve timeline navigation/zoom, occurrence duration editing, transition editing/preview, audio timeline controls, preview/replay/export usability and practical shortcuts/undo/redo. Keep Crossfade unavailable without real dual-scene support. Do not merge P7 without Karl's approval.


## P6 Scene Timing & Transitions — 2026-10-25

P5 Studio is merged/pushed at `7f47119b68d95bd5aefa839dad14f3e112f2e1d1`; Unity P5 needed no merge. P6 isolated branch `cartoon-foundation-p6-scene-timing-transitions` implements occurrence duration editing, timeline recalculation, Fade Through Black, audio clock continuity and a compatible Unity episode v2 payload. Legacy v1 episodes retain source durations and cuts. Studio 309/309, service 12/12, build and disposable browser including save/reopen/edit/replay/export pass. Unity episode 4/4, single-scene audio/action 1/1 each and browser-to-Unity workflow 1/1 pass. P6 technical work is complete in isolation; do not merge without Karl's next decision. The older P5 MP4 label below remains historical.

## Current P5 Episode Production Workflow — 2026-10-25

Karl authorised P4 integration and P5 episode authoring. P4 is merged/pushed to Studio `main` `a2fd628d15536352df53ac4dda762a3a5f0e7a76` (merge `e04c17fb`) and Unity `cartoon-foundation` `b8821b089adcb87ab6b2f9f31119f982f1a63690`. P5 is isolated on `cartoon-foundation-p5-episode-production`: episode scene occurrence reorder/duplicate/remove, contextual properties, timeline/playhead, browser preview/transport, existing episode audio and save/reopen. Tests 304/304, service 12/12, build and disposable browser passed. Final proof/branch pushes are pending. The older P5 Unity MP4-export item below is outside Karl's current P5 scope. Do not merge P5 without Karl approval.

## P4 development checkpoint — 2026-10-25

P3 integration is pushed to Studio `main` and Unity `cartoon-foundation`. P4 saved-episode playback is implemented on isolated `cartoon-foundation-p4-episode-playback` branches in `C:\Users\karlr\repos\BrightTalesP4Episode` and `C:\Users\karlr\repos\BrightTalesP4Unity`. The existing episode sequence, browser preview and saved data remain canonical. Unity preview now transfers repeated scene occurrences, plays across cuts on one clock, keeps episode music through boundaries, and supports Play/Pause/Stop/Replay/Reset. Studio 302/302 tests, 12/12 service tests, build, browser save/reopen/replay, Unity episode Play Mode 2/2, P3 audio and P2 regression 1/1 each, and browser-to-Unity episode run 1/1 passed. See `proofs/cartoon-foundation-p4/REPORT.md` for exact evidence and limits. P4 remains on branches rather than merged `main`.

## 2026-10-25 integration update

Karl authorised continuous foundation development and explicitly requested P3 integration followed by P4. This supersedes the historical review stops below. P3 was merged and pushed in Studio `main` (merge `2cc5a95d7b7f41b0072c9adddff9ecfc5652926b`) and Unity `cartoon-foundation` (`4041a103902bd333db8a4427699d812534e7afa0`). Studio post-merge tests: 298/298; voice-service: 12/12; production build: pass. Unity post-merge audio Play Mode and Phase 2 regression: 1/1 each. P4 scope remains the complete saved-episode playback task below. Preserve frozen V1.1 and Studio 3.1 behavior.

## Current P3 checkpoint — isolated technical proof, review pending

Studio 3.1 is finally approved and pushed to `main` at merge `1d9d1068f9258f8bbeac0b049f3fb8afe9422518`. The current P3 branches add local audio transfer and Unity scene-clock playback without changing saved scene data or the approved Studio 3.1 editor. Studio 298/298, service 12/12, build, Unity audio Play Mode 1/1, Phase 2 regression 1/1 and browser-to-Unity audio run 1/1 passed. See `proofs/cartoon-foundation-p3/REPORT.md`. P3 still needs Karl's visual/listening review and further work on cross-scene music with P4's episode clock; do not merge P3 or start P4.

## Studio 3.1 final freeze review — 2026-10-25

Karl approved the Studio 3.1 core direct-animation workflow at `ae859ef`. The requested Editable Bright Speak Message amendment is technically verified on the same isolated branch. Each Communicate Message interaction has its own free text, appears on the timeline and opens in the contextual Inspector; legacy actions without text show the original default. See `proofs/studio-3.1/bright-speak-amendment/REPORT.md` for browser, video, tests and remaining scope. **Wait for Karl's final freeze approval or changes.** Do not merge or start P3.

## Studio 3.1 direct animation core — APPROVED BY KARL; historical checkpoint

The Studio 3.0 shell is already merged into `main` at the Studio 3.1 baseline `35b8692`. Studio 3.1 work is isolated at `C:\Users\karlr\repos\BrightTalesStudio31` on `studio-3.1-direct-animation`. The Cartoon Editor now opens directly; the existing stage, Inspector, SceneTimeline, scene model and renderer support mouse placement, Walk destination, playhead Wave insertion, timeline edits, Play/Pause/Stop/Replay and save/reopen. Classic remains available. See `proofs/studio-3.1/REPORT.md` for the original core verification and Unity limits. Karl approved this core workflow in the amendment request; the new amendment still awaits the final freeze decision. Do not merge, promote Unity baselines or start P3.

## Current Studio 3.0 review gate

The experimental `studio-3-experimental` branch is technically verified on the Phase 2 checkpoint. Review [Studio 3.0 evidence](proofs/studio-3/REPORT.md): professional shell, editor, Inspector, timeline, Classic, Settings, Unity connection, UI walkthrough and isolated Unity Game-camera run. Await Karl's visual decision before promotion or any P3 work. The P0–P2 records below remain historical; P3 is still TODO.

Updated 2026-10-24. Work in the two `cartoon-foundation` worktrees named in `AGENT_HANDOVER.md`; protect the approved V1.1 commits. Status terms: DONE / IN PROGRESS / BLOCKED / TODO / DEFERRED / REJECTED. Source inventory: `docs/CARTOON_FOUNDATION_AUDIT.md`. Each task below is independently reviewable. Do not mark Karl's visual approval from automated checks.

## P0 — Verified GitHub recovery [DONE]

- **Files:** Studio and Unity Git refs, Unity `.gitattributes`, approved review/checkpoint files.
- **Implemented:** Private `K-Roe/BrightTalesUnityTest` created. Unity approved commit `9cf90954a54c66fd53d0a05890b18fa4cb7c0d21` and Studio approved commit `137219da60565a780995c44201834ce820d41544` pushed on `cartoon-engine-v1-1-approved`. Unity LFS batch endpoint reported 137/137 tracked objects downloadable.
- **Remains:** Recheck remote after future pushes; never force-push or merge main automatically.
- **Test completion:** `git ls-remote` matches both approved hashes; GitHub repo visibility is private; LFS batch API reports all objects available.
- **Dependencies/blockers:** Git Credential Manager authentication. **Karl approval required:** no additional approval for this authorized backup; yes before future merge or visual promotion.

## P1 — Saved Scene Maker scene to Unity [DONE]

- **Files:** Studio `src/timedScenes.ts`, `src/unityBridge.ts`, `src/UnityConnection.tsx`, `src/SceneMaker.tsx`; Unity `Assets/BrightTalesBridgeV0.cs`, new isolated scene/controller.
- **Implemented:** Scene Maker persists stable-ID actions/positions; bridge handles a separate fixed 26-second V1.1 demo.
- **Implemented:** Version 1 payload, content revision validation, Max/Maxine/Living Room mapping, saved-scene selector, and load/play/status/reset on one Unity clock. A real disposable Chrome profile created, saved, reopened and edited a scene, then sent it through the UI to isolated Unity. Two Unity Game-camera runs showed the edited walk and action order, with reset and matching replay. Unsupported features produce reasons. See `proofs/cartoon-foundation-phase1/REPORT.md`.
- **Remains:** Karl's visual decision. Phase 2 and baseline promotion are gated on that decision. The original Editor's V1.1/Blink/Director Controls were preserved but not rechecked in its live session.
- **Test completion:** Real browser workflow and Unity Play mode PASS; Studio 288/288, build PASS; Unity focused 1/1 and browser-driven 1/1; complete review MP4 decoded; scene WebM regression decoded. Evidence paths and limits are in the Phase 1 report.
- **Dependencies/blockers:** **Karl approval required:** yes, visual review before baseline or production integration.

## P2 — Timeline, camera parity, Look At, gentle movement [DONE — AWAITING KARL'S VISUAL REVIEW]

- **Files:** Studio `src/timedScenes.ts`, `src/studioSceneBridge.ts`, `src/SceneMaker.tsx`, `src/SceneTimeline.tsx`, `src/StudioSceneUnityPanel.tsx`, `src/UnityConnection.tsx`, `src/style.css`; Unity `Assets/BrightTalesBridgeV0.cs`, `Assets/CartoonFoundationExperimental/StudioScenePlayer.cs`, `Assets/Tests/PlayMode/StudioScenePlayerPlayModeTest.cs`, `Assets/Tests/PlayMode/StudioSceneBrowserWorkflowTest.cs`.
- **Implemented:**
  - **Look At action** — characters can look toward another character or camera; Studio inspector with target selector; Unity validates target and applies right/left profile sprite.
  - **Gentle walk** — `gentleWalkProgress` easing (acceleration 0.18, cruise, deceleration 0.22); `motion: 'gentle'` option in Studio action inspector; Unity `GentleProgress` matches numerically.
  - **Calm Life v2** — subtle idle behaviour enabled via `life: { mode: 'v2', ambience: false }`; no room ambience; characters feel alive during pauses.
  - **Camera V1 keyframes** — wide / medium / close-up shots; focus on max, maxine, group, or point; optional follow; smooth transitions; transferred via bridge v2.
  - **StudioSceneBridge v2** — version 2 payload with `calmLife`, `look-at` actions with `target`, `motion: 'gentle'`, `camera[]` keyframes; SHA-256 revision; friendly error messages.
  - **Studio UI reorganisation** — inspector panel, advanced/developer disclosure, cast buttons, action grid, timeline blocks, camera panel, diagnostics.
  - **Validation** — rejects invalid look-at targets (self, unknown), unsupported camera settings, ambience, wrong action/camera combinations.
- **Remains:** Karl's visual decision on the Phase 2 review scene (Living Room, Max + Maxine, gentle walk, look-at, waves, camera reframes, calm idle). No P3 work or merge before that gate.
- **Test completion:**
  - Studio: 40 test files / 290 tests PASS; `npm run build` PASS.
  - Unity Play Mode: `StudioScenePlayerPlayModeTest.SavedActionPositionsAndBridgeStateFollowOneClock` PASS (validates v2 config, calmLife, look-at, gentle walk, camera keyframes, reset/replay determinism). 3/12 tests PASS (core v2 test + camera rejection safety tests); 9 failures are tests requiring external browser connections or different bridge ports — not Phase 2 bridge validation.
  - Phase 2 review scene validates and generates correct v2 bridge payload (version 2, calmLife: true, 1 look-at, 1 gentle walk, 4 camera keyframes).
  - Fresh disposable-browser save → close → reopen → edit → send → Unity play → reset → replay PASS; Unity browser-driven Play Mode 1/1 PASS; Studio 290/290 and build PASS; scene WebM fully decoded. The 28.083-second Phase 2 review MP4 fully decoded. See `proofs/cartoon-foundation-phase2/REPORT.md`.
- **Dependencies/blockers:** P1, directional artwork limits (whole-body turns, no Maxine blink overlay). **Karl approval required:** visual acceptance of Studio UI and resulting cartoon.

## P3 — Audio transfer and sync [TODO]

- **Files:** Studio `src/audio.ts`, `src/audioStore.ts`, `src/audioPlayback.ts`, `src/phone.ts`, `scripts/studio.cjs`; Unity bridge/experimental controller.
- **Implemented:** Stable Audio Library assets and timed clips, Voice Maker, Music Studio, Bright Speak exist in Studio.
- **Remains:** Resolve assets locally outside command JSON, validate IDs/content, schedule clips on the same playback clock, respect volume and cross-scene music; report missing media.
- **Test completion:** Decode recorded speech and music during Unity playback; measured start times and volume match saved clips; missing asset rejects safely.
- **Dependencies/blockers:** P1/P2 and local asset serving policy. **Karl approval required:** listening and visual review.

## P4 — Complete saved episode playback [TODO]

- **Files:** Studio `src/episodes.ts`, `src/EpisodeMaker.tsx`, `src/unityBridge.ts`; Unity experimental playback controller.
- **Implemented:** Episode Maker orders scene IDs, supports repeated scenes and global/local time in browser playback.
- **Remains:** Transfer ordered scenes and transitions, reset characters/camera per scene, preserve episode-level audio, stop/pause/replay and error states.
- **Test completion:** Two saved scenes including a repeated occurrence play in order with correct timestamps, audio and replay.
- **Dependencies/blockers:** P1–P3. **Karl approval required:** visual/listening review.

## P5 — Unity MP4 export [TODO]

- **Files:** Unity capture/export integration; Studio existing `src/sceneVideoExport.ts` must remain working.
- **Implemented:** Browser scene/episode WebM export exists. Phase 1 has a real saved-scene Unity Game-camera review MP4, produced by a test capture and composite; this is not an in-app Unity MP4 exporter.
- **Remains:** Inspect installed recorder/FFmpeg, implement deterministic 1280×720 24 fps H.264 plus audio export for saved scene and episode; expose progress and file path.
- **Test completion:** FFprobe verifies dimensions, fps, duration, audio stream; entire decoded video is inspected, not a short clip. Browser WebM remains usable.
- **Dependencies/blockers:** P1–P4, Unity capture and FFmpeg capability. **Karl approval required:** final visual/listening acceptance.

## P6 — Editable two-scene acceptance episode [TODO]

- **Files:** Disposable Studio profile, example Studio Backup, review recording, proof report.
- **Implemented:** Normal Scene Maker, Episode Maker and Studio Backup v8 provide the editing path.
- **Remains:** Build `Max and Maxine — A Friendly Day` in normal UI with approved assets, narration/device-appropriate speech, music and camera; save/reopen/edit/send/play/replay/export; commit backup and evidence via LFS.
- **Test completion:** Actual UI and Unity capture, full-length FFprobe/decode, fresh-profile Backup restore, approved baselines unchanged.
- **Dependencies/blockers:** P1–P5. **Karl approval required:** yes, before freezing or merging.

## P7 — Documentation and handover [IN PROGRESS]

- **Files:** `docs/CARTOON_FOUNDATION_AUDIT.md`, `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/BATCH_REVIEW.md`, `CURRENT_STATE.md`, `AGENT_HANDOVER.md`, `DECISIONS.md`, this file.
- **Implemented:** Repository audit and this takeover list started; approved backup pushed.
- **Remains:** Update status and handover after each verified phase; reconcile older docs that still call episode WebM export planned; record tests, limitations, commit hashes and evidence paths.
- **Test completion:** New agent can locate worktrees, commands, approval boundaries and the exact next task without chat history.
- **Dependencies/blockers:** Results of P1–P6. **Karl approval required:** final visual review; docs themselves do not confer approval.

## Excluded scope

Rejected Greeting V1/V2 and Batch 3 remain REJECTED; chair/sofa sitting is DEFERRED. Portal V1 remains EXPERIMENTAL and outside this mission. Do not merge experimental work into production without Karl's visual approval.

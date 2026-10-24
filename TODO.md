# Cartoon production foundation — takeover list

Updated 2026-10-24. Work in the two `cartoon-foundation` worktrees named in `AGENT_HANDOVER.md`; protect the approved V1.1 commits. Status terms: DONE / IN PROGRESS / BLOCKED / TODO / DEFERRED / REJECTED. Source inventory: `docs/CARTOON_FOUNDATION_AUDIT.md`. Each task below is independently reviewable. Do not mark Karl's visual approval from automated checks.

## P0 — Verified GitHub recovery [DONE]

- **Files:** Studio and Unity Git refs, Unity `.gitattributes`, approved review/checkpoint files.
- **Implemented:** Private `K-Roe/BrightTalesUnityTest` created. Unity approved commit `9cf90954a54c66fd53d0a05890b18fa4cb7c0d21` and Studio approved commit `137219da60565a780995c44201834ce820d41544` pushed on `cartoon-engine-v1-1-approved`. Unity LFS batch endpoint reported 137/137 tracked objects downloadable.
- **Remains:** Recheck remote after future pushes; never force-push or merge main automatically.
- **Test completion:** `git ls-remote` matches both approved hashes; GitHub repo visibility is private; LFS batch API reports all objects available.
- **Dependencies/blockers:** Git Credential Manager authentication. **Karl approval required:** no additional approval for this authorized backup; yes before future merge or visual promotion.

## P1 — Saved Scene Maker scene to Unity [IN PROGRESS]

- **Files:** Studio `src/timedScenes.ts`, `src/unityBridge.ts`, `src/UnityConnection.tsx`, `src/SceneMaker.tsx`; Unity `Assets/BrightTalesBridgeV0.cs`, new isolated scene/controller.
- **Implemented:** Scene Maker persists stable-ID actions/positions; bridge handles a separate fixed 26-second V1.1 demo.
- **Implemented:** Isolated version 1 payload and validation, Max/Maxine/Living Room scene references, saved-scene selector, and load/play/status/reset on one Unity clock. Unsupported features produce reasons. A synthetic Unity Play mode test passed before the latest request-validation edit; Studio focused/full tests and build passed. See `proofs/cartoon-foundation-phase1/REPORT.md`.
- **Remains:** Use a disposable Studio profile to save, reopen, edit and send a real scene to the isolated Unity Editor; verify visual motion and replay. The focused Unity Play mode rerun passed 1/1 after the latest validation edit. No actual UI-to-Unity result is claimed yet.
- **Test completion:** Edit and save a scene in disposable Studio profile, reopen, send, and observe those positions/timings in Unity; unsupported/rejected content fails with a reason; V1.1 and Blink/Director Controls still work.
- **Dependencies/blockers:** Approved sprite coordinate mapping; Unity Editor/Play mode access. **Karl approval required:** visual review before baseline or production integration.

## P2 — Timeline and camera parity [TODO]

- **Files:** Studio `src/timedScenes.ts`, `src/camera.ts`, `src/scenePreview.ts`; Unity new experimental timeline controller and existing actor artwork.
- **Implemented:** Studio has scene-local action and camera keyframes; Unity V1.1 has one fixed authoritative 26-second clock.
- **Remains:** Apply supported approved actions and camera keyframes from payload; pause/resume/seek/stop/replay from one Unity playback clock. Report each unsupported action individually. Keep rejected Batch 3 and blocked Greeting V3 out.
- **Test completion:** Changed saved action timing and camera keyframes visibly change Unity playback; pause and reset are repeatable; no pose/foot regressions in full capture.
- **Dependencies/blockers:** P1, directional artwork limits. **Karl approval required:** visual acceptance.

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
- **Implemented:** Browser scene/episode WebM export exists. Unity review MP4 was captured for a fixed demo, not from saved Studio data.
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

# Episode Preview and Export Reliability V1

**Date:** 2026-10-26
**Status:** Implemented and automated verification passed. Full browser-to-Unity GUI workflow and complete media playback remain NOT VERIFIED; Karl's visual/audio acceptance remains pending.

## Repositories

- Studio: `C:\Users\karlr\repos\brightsenappstales`, branch `main`, baseline `79dda614c313ecd0e075bf7f0d5daff13c47d0b1`; implementation commit `1eaa01ee1d332b965591ce973725fb256fd750f1`; final Studio documentation commit is recorded by Git history.
- Unity: `C:\Users\karlr\repos\BrightTalesUnityFoundationIntegration`, branch `cartoon-foundation`, current `66d8b5a05d00c1dc18b5ee0d68b4682dd91e6cf5`; no Unity source changes were required. This task adds only a review-support note there (commit `46e2b30`).
- The two pre-existing modified Unity integration settings files retained their recorded SHA-256 hashes. No settings or P8-P11 code was staged.

## Changes

### One-click Unity episode preview

The Episode Maker now has **Preview Episode in Unity**. Before starting Unity it validates the saved episode schema, scene references, duration, camera targets, custom Brightling identities/definitions, and referenced audio metadata/files. It then checks the current Editor state, starts Play Mode through the existing authenticated Editor control if needed, waits for actual `Playing` confirmation and runtime bridge health, transfers supported cast/audio, loads the episode, waits for Unity's audio preparation, requests playback from the beginning and polls for Unity's playing/completed status.

A single-flight guard prevents concurrent previews. Replays reset the remembered episode run and saved scene preview before loading. Cancel propagates through waits and transfer; failure after load makes a best-effort Unity reset. The existing Unity Connection controls and manual episode play/pause/stop/reset controls remain available. The Unity runtime bridge and episode player source were not changed.

Unity preview continues to reject intros/credits because the existing Unity episode payload does not support them. Those episodes remain available for Studio playback and export.

### Full-episode WebM export

The existing shared canvas/audio `MediaRecorder` pipeline remains in use. It now reports validation/preparation/render/encode/finalise/complete stages, and the Episode Maker displays measured rendered-frame counts when available. The renderer includes an exact timeline-end sample, retains audio and fails clearly for missing/invalid/undecodable cues, checks that video and audio stream tracks exist before recording, and supports AbortSignal cancellation.

Recorder errors, empty output, wrong MIME, and missing EBML/WebM DocType are rejected with actionable messages. Recorder, stream, audio sources, and AudioContext are released on success, cancellation, and failures. The browser download is reported as started/prepared; the app cannot know whether the browser later saved the file.

## Verification

### Studio

- `npm test -- --run`: **363/363 passed**, 52 files.
- `npm run build`: passed. Existing Vite advisory remains for the ~677 kB JavaScript bundle.
- `npm run test:service`: **17/17 passed** (including Unity Editor control endpoint and existing service/relay lifecycle cases); completed in 47.8 seconds. This run preceded final Studio-only UI/validation/test edits; no service code changed afterward.
- Focused episode/preview/export tests: **25/25 passed** across the preview orchestration, episode bridge and exporter test files.
- `git diff --check`, `node --check scripts/studio.cjs`, and `node --check scripts/unity-editor-control.cjs`: passed.
- Export tests used a mocked canvas/MediaRecorder/AudioContext to verify exact-end timestamp, progress stages, WebM header checks, invalid/missing audio, decode failure, cancellation, encoder failure and resource cleanup. They do not represent an actual exported episode file.

### Unity

Unity 6000.6.7f1 Play Mode tests ran on the current Unity commit in a new detached worktree at `C:\Users\karlr\AppData\Local\Temp\BrightTales-OneClickPreview-Unity`, with `BRIGHTTALES_UNITY_BRIDGE_PORT=17844` and graphics enabled. **8/8 passed:**

- `BrightlingAutoBuilderBridgeWorkflowTest.LoopbackBridgeImportsUpdatesAndRunsAllAdvertisedActions`
- `StudioEpisodePlayModeTest` music/audio, occurrence timing, camera track, audio decoding, and replay fixtures (seven cases total with the bridge test)

NUnit evidence: [`unity-focused-results.xml`](unity-focused-results.xml). This was a focused regression run, not the broad Unity suite and not a live Studio browser transfer.

The Unity Editor's first import generated changes to five settings files inside the newly created test worktree, and the test created `TestResults/`. They were left untouched. The existing integration worktree's two modified settings files remained unchanged.

## Real application verification

**NOT VERIFIED:** no real Episode Maker browser click-through, authenticated browser-to-Unity transfer, Studio screenshot, actual WebM export, media demux/decode, or end-to-end watch/listen was captured. The required disposable in-app browser control runtime was not available in this session, and the normal browser profile was not used. Unity was verified only through its Play Mode regression test runner.

The automated WebM check confirms a non-empty `video/webm` Blob with an EBML signature and `webm` DocType, and confirms the input MediaStream included video/audio tracks. Browser APIs used here do not inspect the encoded WebM track table, guarantee an encoded audio track, expose a reliable finalized duration in all browsers, or confirm that a download was saved. Use a media inspector/player to check duration, audio and the ending manually. No human acceptance is inferred.

## Manual review

1. Double-click `C:\Users\karlr\repos\brightsenappstales\Start-BrightTales-Review.cmd`.
2. In Unity, open `Assets/Scenes/StudioLivingRoomExperimental.unity` and leave the Editor in Edit Mode. In Studio, open a saved episode with supported scenes/cast/audio.
3. Click **Preview Episode in Unity**. Confirm Studio reports each stage, Unity enters Play Mode, the runtime bridge is ready, and the episode begins at time zero. Review the custom Brightlings, actions, camera, transitions and audio in the Unity Game view.
4. Click **Preview Episode in Unity** again after or during playback. Confirm the prior run resets and the same episode starts at the beginning without duplicate characters.
5. Save the episode if needed and click **Export WebM**. Watch measured stage/frame progress through finalisation. Check Downloads for the file, inspect the full duration and tracks with a media player/inspector, then watch and physically listen from beginning through the ending.
6. Record Studio visuals, Unity Game-view visuals and physical audio separately. Passing automated checks is not Karl's acceptance.

## Known limits and outstanding review

- Unity still requires the correct BrightTales project and saved-scene player scene to be open; the preview never opens or switches to another Unity project.
- Unity preview still does not support intros or credits.
- WebM is accumulated in browser memory by the existing MediaRecorder design. Very long exports may be limited by browser memory/codec capacity within the existing 60-minute episode limit.
- Encoded WebM duration/track-table validation, actual browser download persistence, Studio GUI, Unity Game view, full episode playback, full export playback and physical audio remain unverified.
- Karl's P8-P11 visual and physical-audio approvals remain pending.

No new milestone or unrelated feature work was started.

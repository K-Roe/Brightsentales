# Cartoon foundation Phase 1 — saved Scene Maker transfer

Date: 2026-10-24. Status: **PHASE 1 TECHNICALLY COMPLETE; AWAITING KARL'S VISUAL REVIEW**. No Phase 2 work has started.

## Scope and checklist

- [x] Preserve approved V1.1 scene and bridge commands in isolated worktrees.
- [x] Send a versioned saved-scene ID, Living Room reference, Max/Maxine starting positions, duration and supported actions from the existing Scene Maker library.
- [x] Reject unsupported locations, characters, artwork variants, actions, camera, audio, phone, objects and Life settings with an explanation before transfer.
- [x] Validate the bounded payload again in Unity and evaluate it using one scene clock.
- [x] Provide a saved-scene selector and load/play/status/reset controls in the existing Unity Connection tab.
- [x] Save/reopen/edit a scene in a disposable Studio profile, send it through the browser, observe the changed position and timing in isolated Unity Play mode, reset and replay.
- [x] Capture and inspect complete Game-camera recordings for both runs.
- [ ] Karl's visual decision remains pending.

## Implementation and evidence

Studio `src/studioSceneBridge.ts` converts a normal `TimedScene` into the version 1 transfer payload. `src/StudioSceneUnityPanel.tsx` selects a saved scene and sends commands through the existing localhost bridge. Unity `Assets/CartoonFoundationExperimental/StudioScenePlayer.cs` reads the payload and references the approved character and room objects in `Assets/Scenes/StudioLivingRoomExperimental.unity`. `Assets/BrightTalesBridgeV0.cs` routes version 5 command acknowledgements to the player on Unity's main thread. The fixed Cartoon V1.1 scene and controller were left intact.

The first synthetic Play mode checkpoint remains at `C:\Users\karlr\repos\BrightTalesCartoonFoundationUnity\CartoonFoundationP1Review\saved-scene-motion.mp4`. It is historical technical proof. The completed Phase 1 evidence below uses a real browser-created saved scene and the isolated Unity receiver.

The bridge rejects mismatched scene IDs, unsupported actions, duplicate Play commands, wrong run revisions and mismatched payload hashes. Studio computes SHA-256 over the exact supported scene payload; Unity verifies that hash against the received JSON bytes and returns the loaded revision in each acknowledgement. The normal Unity Editor stayed open on Karl's original worktree and was not changed or stopped. The isolated test configured Studio and Unity for port 17844; normal launches still use 17843.

The existing repository CDP pattern ran Chrome headless with a newly created disposable user-data directory. It clicked the normal React Scene Maker and Unity Connection controls; it did not inject a scene or call Unity commands directly. The browser was closed and relaunched with that same disposable profile after the initial save. The separate WebM regression used a second disposable profile populated with a copy of the *already UI-created* edited scene. Karl's normal browser profile and Unity Editor were untouched.

## Real workflow acceptance

| Stage | Result | Evidence |
| --- | --- | --- |
| Launch Studio, open Scene Maker, create Living Room scene with Max and Maxine | PASS | `browser-workflow-results.json`, `01-scene-saved.png` |
| Add Appear, Walk, Wait, Wave and Disappear through the UI | PASS | Nine actions in `edited-scene.json`; before-edit action list in results JSON |
| Save; close Chrome; relaunch with the same disposable profile; reopen scene | PASS | Matching scene ID and complete saved JSON checked by `browser-workflow.mjs` |
| Edit Max's walk duration from 1.5 s to 1.2 s and destination X to 900; save | PASS | `02-scene-edited.png`, `edited-scene.json`, intercepted `studio.load` payload |
| Connect and transfer to isolated Unity | PASS | `browser-workflow-results.json` request/acknowledgement trace and Unity `browser-workflow-results.xml` |
| Match scene ID and content revision | PASS | Scene `35b27428-9ebf-401d-a22d-baa1f9bfab46`; SHA-256 revision `320753bca8191f218223c03d57913c313c26f0b75d981b9d4fd506dd0346bb4b`; two matching load requests and acknowledgements |
| Play and inspect Max/Maxine action order, position and timing | PASS | Unity 1/1 browser-driven Play mode test, Game-camera frames and `real-studio-unity-workflow.mp4` |
| Reset and replay | PASS | Two distinct run IDs; both measured Max stage X from `-2.281555` to `1.75480866`; 96 rendered frames each; reset restored both characters invisible |
| Connection loss | PASS | After isolated Unity exited, Ping changed the Studio status to Disconnected; Chrome logged the expected connection-refused request |
| Existing scene WebM export | PASS | Fresh-profile UI export; `phase1-browser-scene.webm` fully decoded with FFmpeg, with VP9 video and Opus audio streams; last video/audio packet times 8.128/8.130 s |

The real review video is `C:\Users\karlr\repos\BrightTalesCartoonFoundationUnity\CartoonFoundationP1Review\real-studio-unity-workflow.mp4`. It is a **22-second composite** of actual browser screenshots and both continuous Unity Game-camera captures, not a continuous desktop screen recording. The saved/edited UI screenshots are included; the Unity Connection screenshots captured the top of that long tab and therefore do not show the saved-scene status. The request/acknowledgement trace and Unity result XML establish the transfer and playback statuses. FFprobe reports H.264, 1280×720, 12 fps, 264 frames; full FFmpeg decode passed. SHA-256: `13C30A205D4C82201C8894E38EB9D9FC829989E13A4DF3E705847974DA251292`. Representative Game-camera frames were visually inspected: initial placement, edited rightward walk, staggered waves and both characters gone by the end. Karl's acceptance remains separate.

Final focused Studio bridge tests passed 63/63; the full Studio suite passed **288/288** and `npm run build` passed. Unity's focused saved-scene test passed 1/1 after the final hash validation, and the browser-driven Play mode test passed 1/1. The WebM export is a regression check, not a Unity export. Review video and proof snapshots contain no audio; Phase 1 did not integrate Unity audio.

## Supported and remaining

Phase 1 supports approved Living Room artwork, Max/Maxine, Appear, Walk, Wait, Wave and Disappear. It retains stable scene/action IDs and sends edited positions and timings. It does not yet support Camera V1 keyframes, custom Brightlings, other places, additional actions, Bright Speak, audio, episode playback, pause/seek, or Unity MP4 export. Missing or unsupported assets fail explicitly. Browser scene WebM export was retested; complete episode WebM export remains the existing implementation and was not retested in this phase.

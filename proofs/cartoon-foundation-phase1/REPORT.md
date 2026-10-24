# Cartoon foundation Phase 1 — saved Scene Maker transfer

Date: 2026-10-24. Status: **IN PROGRESS; no visual approval**.

## Scope and checklist

- [x] Preserve approved V1.1 scene and bridge commands in isolated worktrees.
- [x] Send a versioned saved-scene ID, Living Room reference, Max/Maxine starting positions, duration and supported actions from the existing Scene Maker library.
- [x] Reject unsupported locations, characters, artwork variants, actions, camera, audio, phone, objects and Life settings with an explanation before transfer.
- [x] Validate the bounded payload again in Unity and evaluate it using one scene clock.
- [x] Provide a saved-scene selector and load/play/status/reset controls in the existing Unity Connection tab.
- [ ] Save/reopen/edit a scene in a disposable Studio profile, send it through the browser, observe the changed position and timing in the isolated Unity Editor, and stop/replay.
- [ ] Review a complete representative Game-camera recording and Karl's visual decision.

## Implementation and evidence

Studio `src/studioSceneBridge.ts` converts a normal `TimedScene` into the version 1 transfer payload. `src/StudioSceneUnityPanel.tsx` selects a saved scene and sends commands through the existing localhost bridge. Unity `Assets/CartoonFoundationExperimental/StudioScenePlayer.cs` reads the payload and references the approved character and room objects in `Assets/Scenes/StudioLivingRoomExperimental.unity`. `Assets/BrightTalesBridgeV0.cs` routes version 5 command acknowledgements to the player on Unity's main thread. The fixed Cartoon V1.1 scene and controller were left intact.

The Studio focused contract test passed 3/3, full suite passed 287/287 and `npm run build` passed on 2026-10-24. Unity's earlier `StudioScenePlayerPlayModeTest` passed 1/1 with a synthetic three-second scene. Its recording is `C:\Users\karlr\repos\BrightTalesCartoonFoundationUnity\CartoonFoundationP1Review\saved-scene-motion.mp4`: FFprobe reports H.264, 960×540, 12 fps, 3.083 s, and no audio stream. SHA-256: `C30EC5B016E728A8D8C6616FCF550C4D8D987025A7`. This demonstrates Unity's saved-payload path, not a Studio UI save/reopen transfer, a full episode, or final export.

The bridge was subsequently tightened to reject a load request whose outer scene ID differs from its payload ID. The focused Unity Play mode test was rerun on 2026-10-24 and passed **1/1**, including that rejection; `cartoon-foundation-play-results.xml` holds the new result. The normal Unity Editor is open on Karl's original worktree and was not changed or stopped. The isolated scene uses bridge port 17844 for tests, while the normal connection panel targets 17843; a disposable browser route or isolated editor setup is needed for the UI-to-Unity check.

The in-app Browser control tool required for disposable-profile interaction was unavailable in this run, and this worktree has no installed standalone Playwright/Puppeteer package. No normal-profile browser data was touched. This is a verification-capacity blocker for Phase 1's remaining UI acceptance check; do not advance Phase 2 on the strength of the synthetic Play mode result.

## Supported and remaining

Phase 1 supports approved Living Room artwork, Max/Maxine, Appear, Walk, Wait, Wave and Disappear. It retains stable scene/action IDs and sends edited positions and timings. It does not yet support Camera V1 keyframes, custom Brightlings, other places, additional actions, Bright Speak, audio, episode playback, pause/seek, or Unity MP4 export. Missing or unsupported assets fail explicitly. Browser scene/episode WebM export remains the existing implementation, but was not retested through the UI in this phase.

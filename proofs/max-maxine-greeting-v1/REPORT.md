# Max and Maxine Greeting V1 — technical handoff

**Status: REVIEW CANDIDATE; FACE-TO-FACE TURN NOT MET; AWAITING KARL'S VISUAL REVIEW.** This is a single 8.2-second Living Room scene and one-scene episode assembled from the approved whole-body idle, directional walk, turn and wave actions. No new animation engine, character art, furniture or Batch 3 action was added.

## Acceptance checklist

- [x] Max begins at floor point (350, 790); Maxine begins opposite at (1320, 790).
- [x] Both walk inward from 0.5 to 3.0 seconds, stopping at (690, 790) and (980, 790). The 290-pixel centre spacing keeps their 213-pixel idle drawings separate.
- [x] Both use the existing Turn action at 3.05–3.45 seconds.
- [ ] Both face each other after the turn. The existing Turn settles into front-facing idle, and approved waves are front-facing.
- [x] Max waves at 3.6–5.22 seconds; Maxine responds at 5.45–7.07 seconds. Both are idle by 7.1 seconds.
- [x] Scene Maker saved the scene, reloaded the application and reopened it without data changes.
- [x] A complete one-scene episode was saved and exported through Episode Maker. Scene Maker also exported a demonstration WebM.
- [x] Focused tests, full test suite and production build passed.
- [ ] Karl's visual approval.

## Review files

- [Complete exported episode clip](greeting-episode.webm) — 1672 × 941 VP9/Opus WebM, 8.13-second last decoded video timestamp, 53 decoded video frames, 719,485 bytes. The audio track is silent because this greeting has no sound clips.
- [Scene Maker demonstration recording](greeting-scene.webm) — same 8.2-second action schedule, 110 decoded video frames, 1,491,881 bytes.
- [Scene Maker screenshot](scene-maker.png) and [start](frame-0.2.png), [walk](frame-1.8.png), [approach](frame-2.9.png), [turn](frame-3.3.png), [Max wave](frame-4.2.png), [Maxine wave](frame-6.0.png), [idle](frame-7.8.png) frames decoded from the episode export.
- [Saved scene data](greeting-scene.json), [saved episode data](greeting-episode.json), and [Studio Backup v8](greeting-studio-backup.json). The backup was exported through the Studio UI from a disposable profile and includes the greeting scene and episode. **Restoring a Studio Backup replaces existing saved libraries**; review it in a separate browser profile or export your current Studio Backup first.

## Verification and limits

`src/greetingScene.test.ts` checks version-1 scene/episode validation, serialization, action ordering, inward direction, fixed floor Y, spacing, wave states and final idle. Focused tests: 2/2 passed. Full Vitest run: 199/199 passed. `npm run build`: passed with the existing bundle-size advisory. Scene Maker UI save/reload and Episode Maker save/export passed in a disposable headless Chrome profile using the production build. The first export attempt began before the sprite pack finished loading; a second run waited for the pack and exported both clips. That run then exited while waiting for the asynchronous Studio Backup download; a separate UI check obtained and validated the backup and confirmed the Batch 3 controls remained disabled. [Browser result](browser-check.json) and the two check scripts are retained. The exported scene and episode clips were decoded with FFprobe and representative frames were inspected.

The current Turn action briefly narrows each front-facing whole-body sprite, then returns to front-facing idle. During the approach, approved side-walk poses face the characters toward each other. The front-facing wave frames greet the viewer, so the strict face-to-face turn requirement is **not met** by this candidate. No approved side-facing wave frames exist, and making them would exceed the authorised artwork scope. The headless episode capture has only 53 frames over 8.2 seconds, so playback cadence is visibly less smooth than the source timing; the separate scene recording captured 110 frames. Fixed floor coordinates and decoded stills show grounded poses, but frame samples and automated tests alone cannot certify that Karl sees no sliding or abrupt pose change. Neither video is marked accepted.

No other milestone was started. Sitting remains deferred, and rejected Batch 3 actions remain disabled for new work.

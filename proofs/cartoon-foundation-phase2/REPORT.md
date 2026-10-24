# Cartoon foundation Phase 2 — interactive review

Date: 2026-10-24. Status: **TECHNICALLY VERIFIED; AWAITING KARL'S VISUAL REVIEW**. Phase 2 remains isolated on `cartoon-foundation-phase2`. No baseline promotion, main merge, or Phase 3 work occurred.

## Scope and result

Phase 2 extends the saved Scene Maker transfer with Look At, a gentle walk option, restrained Calm Life v2 idle, Camera V1 keyframes, and a clearer Scene Maker layout. The saved scene, bridge, and Unity player still share one scene clock and a SHA-256 content revision. The approved fixed V1.1 scene and artwork were not edited. [PLAN.md](PLAN.md) records the narrow checklist and limits.

A fresh disposable Chrome profile created a 9-second Living Room scene with Max and Maxine through the normal UI, saved it, closed and reopened the browser, reopened the scene, changed Max's walk to 2.2 seconds and destination X to 900, and saved again. The same browser connected to isolated Unity Play Mode on port 17844, sent the scene, played, reset, and repeated with a fresh run ID. Scene ID `13e08972-a9a1-44aa-8b5d-f68505800366` and payload revision `52cb6be078a166be65a7091b5f79f1ee756430693c14c09c943341b79613a4c8` matched across both loads. The browser captured 37 bridge requests and 37 replies; the only console/network error was the expected connection refusal after Unity exited, which changed Studio to Disconnected. [Results](browser-workflow-results.json), [editable scene JSON](edited-scene.json), and [script](browser-workflow.mjs) preserve the trace.

The Unity browser-driven Play Mode test passed **1/1**. It captured 108 and 109 Game-camera frames at approximately 12 fps for the two complete runs. Both runs measured Max's stage X from `-2.281555` to `1.82480872`; the test also observed Maxine's right-facing attention pose, a medium camera size, disappearance, reset to invisible, and matching replay camera state. The focused core Phase 2 Play Mode test had already passed before this continuation. The earlier broad 3/12 Unity result contains nine tests needing other bridge ports or an external browser; it is not a full-suite pass. [Unity XML](../../../BrightTalesCartoonFoundationUnity/CartoonFoundationP2Review/browser-workflow-results.xml) records the current browser-driven result.

## Visual evidence

- Scene Maker: [saved stage](01-scene-saved.png), [camera authoring](02-camera-authoring.png), [reopened scene](03-scene-reopened.png), [edited walk inspector](04-action-edited.png).
- Cartoon Preview: [loaded](05-preview-loaded.png), [first completion](07-preview-complete.png), with second-run screenshots `06-preview-loaded.png` and `08-preview-complete.png`.
- [Phase 2 review MP4](../../../BrightTalesCartoonFoundationUnity/CartoonFoundationP2Review/phase2-review.mp4): 28.083 seconds, H.264, 1280×720, 12 fps, 337 frames, no audio. It combines actual UI screenshots and both continuous Unity Game-camera runs; it is not a continuous desktop recording or an in-app Unity exporter. Full FFmpeg decode passed. SHA-256 `B2C00A8686F3735474BC5089132E38813EF2AD04D8029A77FDEACDEC56F6B741`.

Representative Game-camera frames were inspected at initial placement, walk/Look At, medium-shot waves, and empty stage, plus the equivalent wave frame in replay. Karl's visual judgment remains open, including the whole-body pose cuts and character overlap while Max passes Maxine. Phase 2 contains no Unity audio.

## Defect found and verification boundary

The first interactive transfer returned HTTP 409, “Unsupported or invalid saved action.” Studio serializes `motion: "linear"` on non-Walk actions; Unity's validator accepted `linear` as a value but then rejected any nonempty `motion` on those actions. The isolated Unity validator now permits `linear` on ordinary actions and still rejects `gentle` except on Walk. Repeating the entire fresh-profile workflow passed.

Studio `npm test -- --run` passed **290/290** across 40 files and `npm run build` passed after that fix. The build emitted its existing large-chunk advisory. The browser WebM export regression **passed** and its 2,926,692-byte VP9/Opus output decoded completely with FFmpeg; [result](browser-webm-regression.json) and [WebM](phase2-browser-scene.webm) are retained. Its source scene is the UI-created scene copied into a second disposable profile, so that setup is not counted as scene creation. Neither the Play Mode capture nor the WebM regression proves a Unity MP4 exporter or episode playback.

## Karl's review gate

Please watch the review MP4 and inspect the Scene Maker screenshots. Check the walk and arrival, Look At direction, wave transition, camera framing, and whether the editing controls feel clear. Record **APPROVE / CHANGES / REJECT / PAUSE / SKIP** under the roadmap gate. Do not start P3 or merge this branch before that decision.

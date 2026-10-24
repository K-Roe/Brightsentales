# Phase 2 audit and acceptance plan — 2026-10-24

Karl approved the Phase 1 visual result in the Phase 2 request. Phase 2 branches start at Studio `70d09effe728579902bb97464d05d1f5e82017cd` and Unity `ec3573c41d3ac5a8f4e936a8f27086472d36a01b`. Frozen V1.1 and Phase 1 branches remain recovery points. Unity has five unrelated generated settings edits in the isolated worktree; exclude them from every commit.

## Existing implementation

| Area | Existing source and behavior | Phase 2 gap |
| --- | --- | --- |
| Scene data | `src/timedScenes.ts` stores stable scene/action IDs, schedules per character, validates saved data; `src/SceneTimeline.tsx` edits timing | The Unity subset needs authored attention and calmer movement while keeping old saved scenes readable. |
| Studio editor | `src/SceneMaker.tsx`, `src/CameraPanel.tsx`, `src/scenePreview.ts` have a draggable stage, destination click, timeline and Camera V1 | The long form puts selected-action controls and camera far below the stage; creative controls need clearer hierarchy. |
| Studio camera | `src/camera.ts` supports wide, medium, close-up, focus, follow, eased keyframes and WebM preview/export | The bridge rejects every camera keyframe. Unity camera stays fixed. |
| Bridge | `src/studioSceneBridge.ts` sends a bounded v1 payload with SHA-256 content revision over the existing localhost route | A versioned extension must carry selected movement, attention and camera settings while rejecting unsupported data. |
| Unity player | `Assets/CartoonFoundationExperimental/StudioScenePlayer.cs` uses one clock, approved sprites and stage mapping | Walk is linear after a fixed lead-in; idle faces front, no authored attention or camera, and pause poses are rigid. |
| Media proof | Phase 1 browser UI run, Unity Play Mode test, Game-camera composite, Studio WebM regression | A fresh disposable browser run and full Phase 2 Game-camera review are required. Test capture is not an in-app exporter. |

## Chosen Phase 2 scope

1. Keep one scene clock and the current ID/revision handshake. Add only backward-compatible scene/action fields and support old v1 payloads.
2. Use deterministic gentle walk acceleration and arrival, measured feet, directional settling, and restrained idle motion with existing whole-body sprites. No independent limbs or new artwork.
3. Add one authored attention action (Look toward Max/Maxine or camera) using approved side/front poses. Keep it separate from rejected Greeting and Batch 3 work.
4. Transfer Studio Camera V1 wide, medium two-shot/character shot and optional follow to Unity. Preserve gentle transitions and current Studio keyframes.
5. Reorganize Scene Maker so stage, cast/primary actions, selected-action controls and timeline read as one editing workspace. Put advanced and unrelated controls behind clear disclosure. Keep keyboard access, contrast and existing editing semantics.
6. Keep the Phase 1 create/save/reopen/edit/send/play/reset/replay flow, browser WebM export and original Unity scene unchanged.

## Acceptance checklist

- [x] Existing Studio scene data and approved baseline files remain readable and untouched.
- [x] Edited positions, action timing, attention target and camera keyframes reach Unity under one revision.
- [ ] Walk start, travel, arrival, idle and wave are visually coherent; replay yields equivalent measured states.
- [ ] Studio makes stage selection, destinations, action editing and camera authoring discoverable without exposing IDs or JSON in the creative area. Browser operation passed; Karl's usability judgment remains.
- [x] Invalid targets, camera settings, timing, stale revisions and duplicate play fail with useful messages in focused validation. Real rejection of default `linear` motion was fixed and the complete workflow rerun.
- [x] Full Studio suite/build, focused Unity tests, disposable-browser save/reopen/edit/send and full Game-camera capture pass. The browser-driven Unity test passed 1/1; the earlier broad Unity run is not a full-suite pass.
- [x] Review video and Scene Maker screenshots permit Karl to judge the result. Phase 2 stays experimental until his visual decision.

## Explicit limits

No new sprite art, Greeting V3 completion, rejected sitting/toy actions, audio transfer, episodes, final Unity MP4 exporter, cloud service or new browser dependency. Whole-body turn cuts and absent approved Maxine blink overlay may remain visible; evidence must show them honestly.

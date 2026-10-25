# Studio 3.1 Direct Animation — technical review, 25 October 2026

**Status:** technically verified in Studio; awaiting Karl's visual review. Worktree `C:\Users\karlr\repos\BrightTalesStudio31`, branch `studio-3.1-direct-animation`, based on Studio `main` commit `35b86922e56ed390b2af7e051cc58933bccf0100`. Studio 3.0 was merged into main before this milestone. The approved V1.1 artwork and Unity baseline were not edited. There was no main merge, P3 audio transfer, new animation engine or new saved-scene format.

## What changed

- Studio 3.0 opens Cartoon Editor, resuming the most recently saved scene or presenting a Living Room draft. File/Open and Projects still expose saved work. Classic continues to use the same scene data, editor component and save handlers.
- The editor has working desktop menus, a compact navigation rail, scene hierarchy and thumbnail asset browser, large Canvas, contextual Inspector, camera controls, existing tracks and transport controls. Panel widths can be adjusted from View. Commands without a working target are disabled.
- Stage selection and drag place a Brightling; Walk displays a destination line/marker while choosing a point. Adding an action in the professional editor starts at the playhead or next free gap on that character's track. Existing action types, timing, sprites, renderer and scene schema remain in place.
- The action and camera timeline pointer handlers now accept real browser drags. Previously, an additional pointer-capture check prevented action movement in the tested Chrome interaction. Inspector, stage and timeline still update the same `TimedScene`.

## Disposable browser demonstration

`node proofs/studio-3.1/browser-workflow.mjs` used a new disposable headless Chrome profile and the built app served by `npm start` at `http://127.0.0.1:4178/` (4177 was already occupied). The script used browser clicks, pointer drags and localStorage inspection only for assertions; it did not write scene JSON. [Machine-readable result](browser-workflow-results.json): all eight stages passed, with zero browser console errors and zero failed requests.

1. Opened directly in the Cartoon Editor on a new Living Room scene.
2. Added Max and Maxine from Assets, dragged Max to the left, chose Walk and clicked a centreward destination on the stage.
3. Scrubbed to 2 seconds, added Maxine's Wave, saved, played to the full 9.0-second end.
4. Closed and reopened Chrome with the same disposable profile. The same scene ID loaded automatically. Dragged the existing Wave clip from 2.0 to 2.5 seconds, saved and replayed.
5. Switched to Classic and verified the editor and its Play/Restart transport.

The scene has Max's Walk starting at 0 seconds and ending at 1.5 seconds; Maxine's Wave starts at 2.5 seconds after the post-reopen edit. Both remain visible in the Living Room. This demonstration uses approved whole-body frames; it does not imply new walk or wave artwork approval.

## Review media

- [Initial professional editor](01-editor-empty.png)
- [Direct character placement](02-direct-placement.png)
- [Walk destination preview](03-walk-destination-preview.png) and [chosen path with Inspector](04-walk-path.png)
- [Wave on the timeline](05-wave-timeline.png)
- [Resumed scene](06-reopened-scene.png) and [Wave moved after reopen](07-edited-timeline.png)
- [Classic editor](08-classic-editor.png)
- [Nine-second UI walkthrough](direct-animation-walkthrough.mp4)
- [Unity Game-camera frame](unity-game-frame.png) and [nine-second Unity playback](unity-game-camera.mp4)

The MP4 is a recording of the actual browser preview at five captured frames per second, encoded as H.264 for review. FFprobe measured 9.000 seconds, 1584×854 and 45 frames; FFmpeg fully decoded it without error. It is not the application's Unity MP4 exporter.

## Automated checks

| Check | Result |
| --- | --- |
| Focused timeline editing tests | 4/4 pass |
| `npm test` | 41 files, 294/294 pass |
| `npm run test:service` | 11/11 pass |
| `npm run build` | Pass; existing Vite large-bundle advisory |
| Browser save/close/reopen/edit/replay and Classic playback | Pass in disposable Chrome profile |
| Isolated Unity browser-driven Play Mode | 1/1 pass; two complete plays with reset/replay |

## Unity and product limits

The existing saved-scene bridge and Phase 2 Unity player are unchanged. The first Unity attempt timed out waiting for a fresh worktree to import and compile; it had not reached Play Mode. The browser driver then attached to that same isolated process when ready. `unity-workflow.mjs` reopened the UI-created scene, added end disappear actions through the UI as required by the current Unity validator, and sent it on port 17844. [Browser and bridge result](unity-workflow-results.json) and [Unity Play Mode XML](unity-playmode-results.xml) show two complete nine-second plays, reset/replay, matching stable scene ID and SHA-256 content revision, and the disconnected state after Unity exited. The browser logged only the expected connection-refused request after that deliberate exit. The Unity Game-camera recording has 108 frames at 960×540 and 12 fps, measures 9.000 seconds, and fully decoded without error. The normal live Unity Editor, automatic Unity launch during normal Studio use, embedded Game view and in-app Unity MP4 export are outside this verified Studio workflow. The editor still needs Karl's judgement of panel sizing, animation feel and ease of use. No visual approval is inferred from tests or this report.

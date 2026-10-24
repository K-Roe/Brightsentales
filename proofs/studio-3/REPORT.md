# Unity Studio 3.0 experimental review — 24 October 2026

**Status: technically verified; awaiting Karl's visual review.** This work is isolated on `studio-3-experimental` in `C:\Users\karlr\repos\BrightTalesStudio3`. It starts from the verified Phase 2 Studio checkpoint `db63024`; the primary `main`, Phase 2 worktrees, approved V1.1 branch and approved artwork were not changed. No P3, renderer migration or merge was done.

## What changed

- New Studio 3.0 presentation opens by default with Projects, Cartoon Editor, Asset Library, Audio Studio, Episode Maker and direct links to the existing tools. Classic keeps its prior navigation and components.
- Settings → Workspace stores the selected interface separately from Studio Backup and scene data. Switching layouts retains the active editor, including unsaved changes. Navigating away from an unsaved scene asks first.
- The existing Scene Maker state, Canvas renderer, validation, timeline, camera, action inspector and audio panel are arranged around a larger stage. The professional timeline fits short scenes to its width while Classic retains its original zoom. The hierarchy selects the same character/action state.
- The existing Phase 2 Unity connection remains optional. The shell reports its connection state; the editor's Preview in Unity control opens the existing bridge workflow. There is no embedded Unity Game view.

## Review media

| View | Evidence |
| --- | --- |
| Overall Studio 3.0 | [01-overall.png](01-overall.png) |
| Cartoon Editor and canvas | [04-cartoon-editor.png](04-cartoon-editor.png) |
| Selected Walk action Inspector | [05-character-inspector.png](05-character-inspector.png) |
| Camera keyframe and timeline | [06-timeline-camera.png](06-timeline-camera.png), [06b-timeline-tracks.png](06b-timeline-tracks.png) |
| Classic Mode | [03-classic-mode.png](03-classic-mode.png) |
| Workspace Settings | [02-workspace-settings.png](02-workspace-settings.png) |
| Unity connection status | [07-unity-connection.png](07-unity-connection.png) |
| UI walkthrough | [studio-3-ui-walkthrough.mp4](studio-3-ui-walkthrough.mp4) |
| Isolated Unity Game camera, first 9-second run | [unity-scene-run-1.mp4](unity-scene-run-1.mp4) |

## Verification

- `npm test -- --run`: 41 files, **293/293 passed**, including workspace preference, scene, bridge, backup and restore tests.
- `npm run test:service`: **11/11 passed**, including managed local voice-service startup, ownership, recovery and proxy checks.
- `npm run build`: passed. Vite retains its existing advisory about a JavaScript chunk above 500 kB.
- [Disposable-browser workflow](browser-workflow.mjs): first-launch Studio 3.0; Classic switch, Playground canvas and browser scene playback; create/save/reopen/edit shared scene; Inspector, timeline and camera; canceled unsaved-navigation prompt; unsaved editor retained across mode switch without scene-storage rewrite; offline Unity state; preference and scene persistence after browser restart; Music Studio and Voice Maker opening; Studio Backup v8 export, change and UI restore of the original scene ID/name. [Result JSON](browser-workflow-results.json) records stages, errors and failed requests; none were reported in the passing run.
- [Isolated browser-to-Unity workflow](unity-workflow.mjs): UI-created/saved scene, close/reopen/edit, connect, two Play Mode scene runs, reset/replay, matching stable scene ID and SHA-256 revision, Unity Play Mode test and connection-loss state all passed. [Trace](unity-workflow-results.json) and [Play Mode XML](unity-playmode-results.xml) are retained. The connection-refused console line was produced intentionally after the isolated Unity receiver exited and the UI reported disconnection.
- Unity Game-camera review clip: **960 × 540, 108 frames, 9.000 seconds**; encoded from the first isolated Play Mode run. This is a review capture, not an in-app Unity exporter.

## Evidence limits and Karl's gate

The Unity proof used an isolated batch Play Mode receiver on port 17844; Karl's normal open Editor session was not rechecked. Voice Maker service ownership tests and tool navigation passed, but speech generation and listening were not exercised in this Studio 3.0 pass. Music Studio opened and its existing automated tests passed; a new composition was not rendered in the browser. Backup v8 was restored through the browser; v1–v7 compatibility is covered by existing automated backup and restore tests, not a separate browser import for each version. No visual approval is inferred from tests or media. Karl should review editor clarity, responsive behaviour, Classic appearance, timing, camera framing and the Unity scene, then record **APPROVE / CHANGES / REJECT / PAUSE / SKIP**. Promotion and P3 remain stopped.

# P7 Episode Production Polish — technical proof

**Status (25 October 2026):** Isolated Studio and Unity branches `cartoon-foundation-p7-episode-production-polish`, based on pushed P6 integration heads Studio `ba9b73a58ba6d723aab03aab84819b7868ff6de9` and Unity `0998a013fe5d33dd5c5d4c71a541564d49b28251`. P7 is **not merged**. Studio implementation commit `0a13f09533d4237c5d959b2f1bffebda95dfbe13`; proof/documentation commit follows. The Unity P7 branch has no source changes because P7 extends existing Studio authoring controls without changing episode payloads or the bridge.

## What changed

- The existing `EpisodeSequencePanel` now has Fit, 1x, 2x and 4x zoom, horizontal navigation, a seekable ruler and scrub control. Scene blocks, boundary markers, playhead and read-only audio clips use the same episode clock. The **Edit audio** link opens the existing AudioPanel; no second audio editor was added.
- The occurrence Inspector has half-second duration nudges and honours fade-duration minima. Transition selection shows the outgoing and incoming scenes, configured fade and **Play across boundary**. Hard Cut remains the default. Crossfade is still unavailable.
- The episode toolbar exposes Undo, Redo and Export WebM. Transport adds Replay. Keyboard shortcuts when the episode editor is open: Ctrl/Cmd+S saves; Ctrl/Cmd+Z, Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z undo/redo outside form fields; Space plays/pauses and Home restarts outside controls. Undo history is local to the open editor and capped at 50 edits; only Save writes the existing Episode v1 record.
- `episodeTimeline.ts` derives zoom ticks and audio placement, while `episodeEditHistory.ts` provides local history. Saved episode fields, scene IDs, audio models, Unity protocol and approved artwork remain unchanged.

## Verification

| Check | Result |
| --- | --- |
| Focused episode/timeline/history tests | 15/15 pass. |
| Complete Studio `npm test` | 46 files, 313/313 pass. |
| Voice-service/relay `npm run test:service` | 12/12 pass. |
| Standard production `npm run build` | Pass, existing Vite 500 kB advisory. A separate isolated bridge-port build also passed. |
| [Disposable browser workflow](browser-workflow-results.json) | All 19 stages pass: scenes and repeated occurrence; duration nudge, keyboard Undo, Redo, zoom and scrub; fade boundary preview; audio lane; save, browser close/reopen, edit, replay and WebM export. No browser exceptions or failed requests. An initial attempt passed through export but timed out restarting disposable Chrome; cleanup was corrected and the complete rerun passed. |
| [Complete WebM](exported-episode.webm) | VP9 video and Opus audio; FFmpeg full decode passed. Last video packet at 7.631s with 0.016s duration for an authored 7.5s sequence. |
| [Nine-second walkthrough](episode-workflow.mp4) | FFprobe duration 9.000s; FFmpeg full decode passed. |
| [Browser to Unity bridge](unity-browser-e2e-results.json) | [Unity Play Mode 1/1](unity-browser-results.xml) and all three browser stages pass. The UI-authored v2 episode transferred durations 2, 4 and 1.5 seconds, a 0.6 second fade and one music asset; Unity played the ordered scenes, kept music through both cuts, replayed and reset. No browser exceptions or failed requests. The warmed merged Unity worktree used for the run is at the exact commit of the isolated P7 Unity branch (`0998a013fe5d33dd5c5d4c71a541564d49b28251`). A first attempt on the fresh P7 Unity worktree exceeded the browser harness's 120-second ready window during cold import; no application command was sent in that attempt. |

Screenshots: [workspace](00-episode-workspace-top.png), [scene Inspector](02-selected-scene-inspector.png), [transition Inspector](07-transition-inspector.png), [zoom and scrub](10-zoom-and-scrub.png), [audio lane](11-audio-lane.png), [fade at the cut](09-fade-through-black.png), [reopened replay](05-reopened-playback.png), [Unity loaded](05-unity-episode-loaded.png), [Unity playing](06-unity-episode-playing.png) and [Unity reset](07-unity-episode-reset.png). The [browser workflow](browser-workflow.mjs) and [Unity transfer workflow](unity-browser-e2e.mjs) use disposable Chrome profiles and disposable scene/audio data.

## Karl review steps

1. In the isolated P7 Studio worktree, run `npm run build` and `npm start`, then open the printed URL in a disposable browser profile.
2. In Episode Maker, open or create an episode with at least two saved scenes. Select a scene and use the Inspector's duration buttons; use Undo/Redo to compare.
3. Set timeline Zoom to 2x, scrub to a scene boundary, select the boundary marker and use **Play across boundary**. Switch between Hard Cut and Fade Through Black.
4. Add episode music or scene audio. Check its position in the episode timeline, use **Edit audio** for detailed controls, then Save, Replay and Export WebM.
5. Close/reopen the browser and confirm timing, transition and audio references remain intact. Unity preview requires the connected Unity runtime and remains limited to mapped scenes/actions.

## Limits

The audio lane is an overview; moving/trimming/volume remain in the existing AudioPanel. The editor history is session-local and resets when another episode opens; it is not persisted in backups. Crossfade needs dual-scene rendering and was not added. Unity Game-view visual acceptance and physical audio listening remain pending from P6. No Unity Game-view capture or physical listening is claimed for P7.

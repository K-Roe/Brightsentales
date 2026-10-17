# M6.1 — visual Scene Maker review

## What changed

- The approved room and Brightling sprites remain the preview. Selecting a visible Brightling on the stage selects it for direction. At 0 seconds, dragging that Brightling changes its initial position and matching 0-second Appear position. The cast buttons also select Brightlings, including ones hidden at the current time.
- Walk To and Appear position picking use the stage. Selecting a Walk To block draws its route and destination. Left and right edge buttons set offscreen coordinates for entrances and exits. Exact X/Y values remain in a collapsed Advanced position section.
- A selected Brightling has five clear action buttons. A selected action has one contextual inspector for type, start, length and relevant destination controls. The old full-form rows are gone.
- The horizontal timeline has a ruler, one lane per Brightling, named action blocks, a playhead, zoom and horizontal scrolling. The ruler can be clicked or dragged to seek. Blocks move and resize with half-second snapping. Invalid same-character overlaps and scene-end overruns are prevented by timing edits or flagged by existing validation. Independent characters can act simultaneously.
- The underlying timed scene JSON, storage key, scene evaluator, approved animation frames and timing, outfits, Playground and Studio Backup schema remain unchanged. A small playback clock correction captures elapsed wall time before React queues a state update, avoiding lost time during slow frames.

## Visual/browser evidence

`browser-check.mjs` uses a fresh temporary Chrome profile and never opens Karl's normal profile. Through the visible UI it creates a 30-second Living Room scene, adds Max and Maxine, drags both to starting positions, chooses two walking destinations on the stage, adds Max's wave, moves Max's walk from 0 to 2 seconds, resizes it from 3 to 4 seconds, clicks the ruler to seek to 15 seconds and drags the playhead to 20 seconds, saves, reloads, plays to 30 seconds, exports and restores Studio Backup, and opens and saves an earlier M6 scene. No browser console errors were captured. The disposable profile was removed.

- `editing-workflow.mp4`: short browser screencast of the new editor interactions.
- `thirty-second-playback.mp4`: browser capture of the full scene through automatic stop.
- `stage-before-placement.png`, `stage-after-placement.png`, `walk-path.png`: stage-first placement and route.
- `timeline-before-edit.png`, `timeline-after-edit.png`, `timeline-seek-15.png`, `timeline-playhead-dragged.png`: timeline editing and seeking.
- `editor-mobile.png`, `timeline-mobile.png`: compact layout with horizontal timeline scrolling.
- `reopened-desktop.png`, `backup-restored.png`, `legacy-m6-opened.png`: persistence and compatibility.
- `browser-check.json`: observed action data, playhead and end states, restore state, console errors and profile cleanup.

## Verification

- `npm test`: 11 files, 51 tests passed. Focused timeline tests cover snapping, move/resize boundaries, same-character overlap prevention and independent characters. The elapsed-time regression test covers a late browser frame. Existing M6 and earlier tests remain passing.
- `npm run build`: TypeScript and production Vite build passed.
- `git diff --check`: passed.
- Browser console errors: 0. Browser profile removed.

## Future audio fit — design only

`SceneTimeline` builds lanes from a small `{ id, kind, label }` shape and renders the ruler/playhead separately from action blocks. A later audio milestone can add distinct lane kinds for background music, sound effects and character dialogue. Music would use a scene-wide lane; effects would use clip blocks with start time; dialogue would use a lane associated with a character ID. Their clip data, validation, persistence and playback should be separate from the current visual `TimedAction` type and `stateAt` evaluator, while sharing timeline coordinates and seeking. No audio controls, uploads, storage or playback were added in M6.1.

## Remaining limits and approval

- Initial position dragging is available at the scene start. At later times, stage clicks select characters and stage clicks in destination mode set action positions.
- The ruler and blocks support pointer interaction; exact time values can be entered in the selected action inspector. Keyboard users can select action blocks and edit their values in the inspector, while keyboard repositioning of blocks themselves is not implemented.
- The timeline is intentionally lightweight: one visual track per Brightling, with no multi-selection or grouped action moves. Longer scenes use zoom and horizontal scrolling.
- The existing artwork has left/right side views only. Near-vertical travel retains the last horizontal facing direction.
- Browser recording and automated tests do not establish Karl's visual approval. M6.1 remains pending his review.

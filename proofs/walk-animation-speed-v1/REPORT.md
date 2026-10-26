# Walk Animation Speed V1

**Date:** 2026-10-26  
**Status:** Code and automated verification complete; Karl visually reviewed and approved this gait as the accepted baseline.

## Root cause

Scene walking already evaluated each character independently. `stateAt(scene, character, time)` selects that character's walk action, computes its movement progress from its own `start`, `duration`, and destination, then chooses a side frame from distance travelled. The full Native2D cycle was incorrectly configured as only 56 px for Max and 62 px for Maxine. With the usual 235 px/s movement rate, this advanced the four-frame cycle about 3.8–4.2 times per second, which appeared as running. Optional Cartoon Life and Brightling Life walk bob also used 5 Hz and 4.5 Hz oscillations.

## Changes

- Increased the full two-step Native2D cycle lengths to 168 px for Max and 186 px for Maxine, reducing cycle rate while keeping frame phase tied to actual per-character travel (avoids a global playback multiplier and retains foot travel correspondence).
- Reduced both optional walk-only body bob oscillators to 1.4 Hz. Their existing action-local envelopes still ease the bob in/out and preserve the current timeline boundaries.
- Left action duration, start, destination, action data schema, artwork, idle/wave behavior and episode clock unchanged. Existing saved scenes require no migration.
- Studio Canvas preview and WebM export both use `stateAt` and `drawScenePreview`, so the corrected cadence is shared.

## Verification

- Focused `timedScenes`, `walking`, `cartoonLife`, and `brightlingLife` tests: **22/22 passed**.
- Full Studio suite: **393/393 passed**, 57 test files.
- `npm run build`: passed; existing large JavaScript bundle advisory remains.
- No Unity code changed. The existing Unity bridge is not the target; this request covers Studio and embedded Cartoon Preview.

The regression fixture runs Max for 1 second over a shorter distance alongside Maxine for 5 seconds over a longer distance. It verifies independent positions and frames at a shared playhead, Max's idle return at 1 second, and Maxine continuing until 5 seconds.

## Manual review

Karl visually reviewed and approved the updated walking animation. Preserve the approved cadence, independent action timing, and existing scene behavior. Further gait changes require his approval.

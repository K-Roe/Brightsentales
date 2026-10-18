# Native2D cut-out rig — built, proven, and BLOCKED on one missing asset

18 October 2026. **Status: the rig is not wired into the app and is not visually approved.** The mechanism works; the *poses* it can produce do not meet Karl's acceptance bar, and the reason is structural rather than a tuning problem. Reported for review as his gate requires.

## What was built

- `scripts/build_max_rig.py` — bakes Karl's approved `max-0.png` into parts under `public/art/rig/max/` with a `rig.json` (pivots, part files, draw order). **The approved PNGs are not modified**; `git status` on `public/` shows only the new `rig/` folder.
- Cut paths are **explicitly authored anatomical polygons** for the sleeves and shoulder caps (authored by eye against a coordinate grid, `scripts/cutpath_grid.py`). The head and hands use exact connected-component extraction from the recolour body mask, because those are reliable and disjoint; the failed mask-row approach is not used anywhere.
- Parts produced: `torso`, `sleeve-left/right`, `hand-left/right`, `shoulder-left/right`, `head` — 8 parts, 4 pivots.
- `scripts/rig_preview.py` reconstructs poses, solves arm angles geometrically, and renders evidence images.

## What is proven to work

1. **The cut paths are correct.** With every angle at zero, the rig reconstructs the approved frame: `rig-rest-pose.png` is visually identical to `max-0.png`, confirmed by a pixel diff (`rig-rest-diff.png`; the 1.67% differing subpixels are anti-aliased silhouette edges, a compositing rounding effect, not cut errors). The close-ups `closeup-shoulders.png` and `closeup-hands.png` show original and rest pose side by side and they match.
2. **Arms rotate and hands stay attached.** The first attempt detached the hands because they were rotated about their own pivot; corrected so a hand always rides its arm with the same pivot and angle.
3. **Phone-height poses are geometrically reachable.** Arm angles are solved, not guessed: holding arm +70.7°, tapping arm −78.5°, putting both hands within ~20 px of a device at chest height.
4. **Waving needs no rig at all** — the approved wave frames already contain a raised arm, so it is a clean frame swap with zero seams.

## The blocker (Karl's stop condition, triggered)

Raising an arm produces **visible holes at the shoulders, broken outlines and distorted clothing**. Evidence: `closeup-shoulders.png` and `closeup-hands.png`, third panel — the sleeve cuts across the chest, the hoodie star is sliced and displaced, the drawstrings and hood junction are torn, and the armpit region is empty (white).

**Root cause, and it is not fixable by tuning:** in this artwork the sleeve is *continuous with the hoodie torso* across the chest and shoulders, and **there are no source pixels behind the arms**. When an arm rotates away from the body it must expose that empty armpit region, and when it swings inward it drags the chest silhouette with it. Both artifacts are caused by missing pixels, not by bad cut paths.

Rendering the arms *behind* the torso was tried and is worse: the torso is wide, so the arms are hidden and only the hands show (`rig-arms-behind-torso.png`).

Head tilt has the same cause — a small tilt opens a light halo at the neck because there are no pixels behind the head.

## What is needed to unblock

**One additive asset: an "arms-removed torso" fill layer.**

The same Max frame with his arms cut away and the armpit/shoulder interior filled in the hoodie's existing colours and shading. This would **add only new pixels in previously empty areas and change no approved pixel**, so it does not modify his artwork — but it is new artwork and needs Karl's approval before I generate or use it. With that layer, the arm rotates in front of a filled body and the holes and chest seams disappear.

Optionally, the separate **pointing-hand asset** already flagged, for a visible index finger on the tap.

Once the fill layer exists, the remaining work is small and already proven: renderer wiring, pose definitions with interpolation, phone attachment to the transformed hand position, tests, and the acceptance video.

## What is NOT done

- The rig is **not** integrated into the renderer, so the app still uses the approved artwork plus the composited phone. `src/` is unchanged; 184/184 tests and the production build pass.
- No pose is claimed to work. Nothing is marked visually approved.

## Decision needed

1. **Approve the additive "arms-removed torso" fill layer** (new pixels only) so the rig can be finished. *Recommended if the rig is wanted.*
2. **Use the rig only where it is clean** — small arm adjustments, carrying, and waving via approved frame swaps — and accept that a chest-height tap needs new art.
3. **Set the rig aside** and keep the V1 composited phone with the V1.2 pop-up.

Evidence in this folder: `rig-rest-pose.png`, `rig-rest-diff.png`, `rig-poses-sheet.png`, `rig-pose-hold/tap-raise/tap-touch/wave.png`, `rig-arms-behind-torso.png`, `closeup-shoulders.png`, `closeup-hands.png`, `closeup-star.png`, `inspect-sleeve-right.png`.
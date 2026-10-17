# Milestone 5A-Q: Max T-shirt and trousers review set

## Status

Nine **experimental candidates** are assembled. They are suitable for Karl's visual review, but **not production-ready**. They must not replace the approved Max sprites or be integrated into Brightling Maker without further art correction and explicit approval.

## Runtime inventory

`src/maker.ts` lists nine unique Max-based frames: front idle `0`, right-facing transition `side-0`, walking `side-v3-1` through `side-v3-4`, and waving `wave-1` through `wave-3`. Left walking mirrors the right-facing frames. The renderer draws them at 355 pixels high. The source PNG canvases are 434 x 724 (`0`), 500 x 724 (`side-0` and waves), and 560 x 724 (walking). The scene uses 235 pixels/second, 29 pixels per walking pose, 110 ms turn/stop, and 180 ms per wave state.

The prior 5A-P proof provided front idle, first walking contact, and middle wave candidates. Six additional pose-specific edits complete the nine candidate inputs. The same purple short-sleeved T-shirt, dark trousers, and blue-and-white trainers appear across the set. Each is a complete pose edit from its corresponding approved frame; no static outfit overlay is used in the animation preview.

## Files for review

- `all-nine-contact-sheet.png`: each approved original beside its outfit candidate, in runtime order.
- `walking-preview.gif`: original above and candidate below, using the current 110 ms turn, 235 px/s movement, and 29 px walking-frame spacing, followed by idle.
- `waving-preview.gif`: original beside candidate, using the current nine-state wave sequence at 180 ms per state.
- `seam-closeups.png`: enlarged shoulder, elbow, waist, knee, ankle, and wave-arm crops.
- `frames/`: nine candidate frames registered to the exact original canvas sizes and foot baselines.
- `candidates/`: nine raw pose edits, retained for art review and future correction.
- `build_preview.py` and `verify.py`: deterministic preview assembly and focused integrity checks. Pillow is used offline only; the web application has no Python dependency.

## Technical verification

Focused checks passed: all nine candidate frames and source edits exist; output canvases and RGBA transparency match the originals; approved originals are byte-identical to Git `HEAD`; no two walking candidates are pixel-identical; preview GIFs contain the intended frame counts. The existing application suite passed 34/34 tests. `git diff --exit-code -- public/art src` passed, so approved art and application code have no tracked changes. No scene or production character data was changed. A full application build was not run because no application source, production asset, or dependency changed; these review files are not imported by the build.

## Visible defects and acceptance limits

- Image edits changed details of Max's eyes, face, hair, hands, tail, and trainers slightly. The requirement to retain those approved pixels exactly is **not met**.
- The two extended walking contacts are too similar, and the two high wave positions are too similar. The differences are visible in the contact sheet but may read as weak motion at editor scale.
- Per-pose normalization matches the canvas size, character height, and foot baseline, but it does not guarantee identical joints, exact footprint positions, or flicker-free playback. In particular, shoe shapes and sleeve/waist contours still vary between frames.
- The proof images demonstrate pose coverage and outfit direction. Automated integrity checks cannot establish artistic quality. Karl's visual review is still required, and the current set should be treated as a **failed production-art gate** until the identity and continuity defects are corrected.

The smallest next art step, after review, is pose-by-pose editing that locks the approved head, hair, hands, tail, and shoes and confines artwork changes to the sleeves, shirt, waist, and trousers. That correction is not included here and has not been integrated into the app.

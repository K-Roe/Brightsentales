# Brightling Rig V1 — Max's living body

**Status: experimental standing candidate; Karl's visual approval is pending.** Maxine, Living World, Scene Maker, approved actions and production sprite assets were not changed. No commit was made.

## Review first

- [18-second standing comparison, H.264 MP4](standing-comparison.mp4): approved Max left, experimental layered Max right at identical size and framing.
- [18-second connection close-up, H.264 MP4](connection-closeup.mp4): head, eyes, neck, hoodie and shoulders at larger scale.
- [Interactive isolated Canvas review](review.html): play, scrub through `drawRigAt(time)` in a disposable browser, or export the same rendering path as WebM. This is a proof page, not a Studio feature.

## Artwork and motion

The [layer builder](build_layers.py) partitions approved `public/art/max-0.png` into head, chest, upper body and lower body without changing the original. Hair, face, eyes and chin travel together. Small concealed neck and hoodie fills sit behind the moving parts. The legs and shoes are fixed. [The rig manifest](../../public/art/experimental/max-living-v1/rig.json) records source hash, geometry and layer order. All candidate PNGs are isolated under `public/art/experimental/max-living-v1/`.

The generic [physical pose evaluator](../../src/experimental/physicalRig.ts) uses absolute scene time and a stable character ID. It combines a gentle inhale/exhale with long pauses, occasional small upper-body posture shifts and restricted head rotation. The Max-specific loader owns Max's layer registration. Both review panels use the existing `independentBlinkAt` schedule and `makeEyeLayer` eyelids; on the right the eyelid is transformed with the head. Neither whole-body scaling nor shoe translation is used.

The candidate's shoulders and arms move together with the upper-body layer. **Independent arm articulation is not solved.** A separate sleeve test produced visible vertical hoodie/shoulder lines at close range and was removed from the running candidate. Its [failed frame](failed-arm-close-5-8.png) and cutouts under `failed-arm-layers/` are retained as evidence. New, artist-reviewed sleeve/torso overlap artwork is needed before independent arm rotation can be claimed.

## Verification

- Approved Max SHA-256: `7d1c4a26bebdabd85b2114b8ca61df4e5f83302ab21aa8c895f5438d75a98d24`, matching the read-only source and rig manifest. No approved Max or Maxine asset was edited.
- The neutral composite has **zero differing visible source pixels** and **zero differing alpha pixels**. Transparent RGB values at 434 fully invisible pixels normalize during compositing; they do not change the displayed image.
- The same Canvas rendering at 5.8 seconds matched byte for byte after seeking to 12.5 seconds and back. Sampled shoe pixels were identical at 1.25 and 12.5 seconds. The disposable Chrome profile reported zero console errors.
- Both MP4s decoded completely: H.264, 1920 × 1080, constant 24 FPS, 432 frames, exactly 18.000 seconds. Sampled [standing](full-5-8.png) and [close-up](close-5-8.png) frames were inspected. The browser recorded WebM through Canvas MediaRecorder; FFmpeg made the H.264 review copies.
- Focused rig tests: **2/2 passed**. Full `npm test -- --run`: **225/225 passed**. `npm run build`: passed with the existing large-chunk advisory. Production renderer imports were not changed, so approved walks, waves and phone timing retain their old paths.

## Limits and approval gate

This standing-only proof does **not** establish clean compatibility with walking, waving, talking or phone actions. It is not wired into Studio, so Studio save/reopen and episode preview/export parity for the new rig are not applicable yet. Some fine antialias edging around the hoodie/neck remains visible under extreme magnification; Karl should judge the moving close-up at normal viewing size. The physical motion is deliberately restrained and its success as a living character is a visual decision, not a test result.

Stop here for Karl's review. Do not modify Maxine, integrate this candidate into Living World, start Rig V2 or mark the experimental art approved without his decision.

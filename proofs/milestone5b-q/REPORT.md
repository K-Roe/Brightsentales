# Milestone 5B-Q — Maxine alternative outfit, offline review

**Status: nine review candidates prepared; visual approval pending. These are not production assets.**

## Runtime inventory

The existing renderer uses nine Maxine files: `maxine-0.png` (434 × 724), `maxine-side-0.png` (500 × 724), `maxine-side-v3-1.png` through `-4.png` (560 × 724 each), and `maxine-wave-1.png` through `-3.png` (500 × 724 each). All are transparent RGBA. Left walking mirrors the right-facing side pose at runtime. The walk selects poses 1–4 by 29 pixels travelled at 235 pixels/second (about 123.4 ms per pose at constant speed). The wave plays `0,1,2,3,2,3,2,1,0` at 180 ms per pose. No runtime definitions were edited.

## Artwork method

- `frames/maxine-0.png` is a byte-for-byte copy of the frozen 5B-P.1 front idle. The approved file itself was not modified.
- Each remaining original Maxine frame was used as its matching pose reference for an offline clothing edit. The eight resulting full-image drafts are retained in `drafts/` for provenance; **they are not the candidate frames** because generated facial features, hands, trainers and silhouettes drift.
- `assemble.py` aligns each draft to its approved source pose using opaque image bounds, then restores source head/face, hair, hand and trainer areas. It uses the draft for the pose-specific purple T-shirt, exposed arms and navy leggings. This is an offline compositing experiment, not an application renderer or a reusable wardrobe architecture.
- The source artwork is flattened. The original hoodie and skirt hide anatomy, so the new sleeve/arm and waist/leg connections cannot be recovered exactly from approved source pixels. Those portions are newly illustrated and need Karl's visual judgment.

## Review files

- `frames/`: nine native-size candidate PNGs.
- `original-vs-outfit-nine-frames.png`: every candidate beside its corresponding approved original, at identical pixel scale within each pair.
- `outfit-nine-frames.png`: all nine candidate frames.
- `walking-original-vs-outfit.gif`: original and candidate displayed side by side, front idle → turn → two cycles of walking frames 1–4 → side stop → front idle. GIF timing uses 120 ms per walk pose, the nearest GIF centisecond to the runtime's approximately 123.4 ms at full walking speed; turn/stop use 110 ms. This is an in-place pose preview, not moving Playground playback.
- `waving-original-vs-outfit.gif`: original and candidate displayed side by side in the approved nine-step wave order, 180 ms per step.
- `seam-closeups.png`: collar/hair, sleeve/wrist, raised arm/hand, waist/knee and ankle/trainer comparisons.

## Verification

`py -3.12 proofs/milestone5b-q/verify.py` passed. It verifies fixed SHA-256 hashes of all nine production Maxine sprites and the frozen 5B-P.1 idle; exact idle-copy bytes; nine present, distinct native-size RGBA candidate frames; transparency and gross silhouette coverage; runtime walking/wave constants and GIF sequence lengths. Source assets and application code are untouched. A production application build was not run because nothing in the application changed.

## Visual findings and limitations

- Maxine's original front idle is exact. The four walking candidates retain clearly different leg positions, including the lifted-leg fourth pose. The three wave candidates show distinct hand positions, and the comparisons preserve the original trainer locations closely.
- At enlarged scale, thin pink or dark seams remain at some side-view collars and wrists. The raised-hand wave frames have small edge artifacts around the wrist and under the chin. The side idle has a second visible hand that differs from the approved source silhouette.
- Some generated T-shirt folds, star placement and leggings shading vary slightly between poses. The candidate head and hair mostly use approved pixels, but pose-specific assembly can produce faint edge differences where source hair meets newly illustrated clothing.
- No large limbs appear detached in the contact sheet, but static images and integrity checks do not prove clean motion. Karl should inspect both GIFs at normal size and enlarged size before deciding whether pose-specific manual cleanup is needed. These candidates are **not asserted to be production ready**.

No Brightling Maker, Playground, save format, production animation, Max artwork or Maxine artwork was changed. Stop here for Karl's visual approval; no isolated Playground integration has begun.

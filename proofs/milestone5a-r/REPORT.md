# Milestone 5A-R review result

**Status: correction attempted, visual gate failed. Do not integrate these frames.**

## Source and method

The nine approved `public/art/max-*.png` runtime sprites are authoritative. The nine 5A-Q clothing candidates supplied the experimental T-shirt and trousers. `build_corrected.py` builds pose-specific protected masks for the original head, hands, tail and trainers, then composites clothing candidates in the remaining lower-body area. Both the allowed-change and protected masks are saved per frame under `masks/`. The allowed lower-body area is still broader than a finished clothing mask. This is offline proof work only; no production asset or application file was changed.

The first mask pass copied parts of the original shorts and exposed duplicate shoes. A subsequent pass excluded shorts from the trainer mask and removed the candidate trainers before restoring original trainer pixels. This improves the result but does not solve the shifted-body source artwork.

## Review artifacts

- `all-nine-contact-sheet.png`: original and experiment for all nine runtime frames at identical display scale.
- `walking-preview.gif`: complete four-pose V3 walking cycle with the approved 110 ms turn and approximately 123 ms per 29 px step, then return to idle.
- `waving-preview.gif`: approved nine-state sequence at 180 ms per state.
- `seam-closeups.png`: enlarged shoulder, elbow, waist, knee, ankle and raised-arm details.
- `frames/`: the nine experimental RGBA output frames.
- `masks/`: explicit per-frame protected and allowed-change areas.

## Technical checks

`verify.py` passes 3 focused checks: all nine output frames have the original canvas size and RGBA transparency; original source PNGs are byte-identical to Git `HEAD`; every pixel outside an allowed-change mask matches its original PNG; walking and waving preview frame counts are correct. The existing Vitest suite passes 34/34. `git diff --exit-code -- public/art src` passes. No Maker, Playground, Maxine, saved scenes or production assets were changed. The application build was not run because application code and production assets were untouched.

## Remaining visual defects

- In some side-view frames, the original hand is restored at its approved coordinates but the 5A-Q edited sleeve/forearm follows a shifted arm. This creates extra or disconnected anatomy, especially `side-v3-2`.
- Some trainer and ankle seams remain uneven. The original trainer pixels are protected, but the candidate trouser legs were painted to slightly different foot positions.
- Front and wave frames show collar/neck outline fragments and occasional shorts or leg remnants near the trousers.
- The walking contacts are still too similar in clothing silhouette because the 5A-Q pose edits drifted. The masked assembly cannot recover the approved body motion from those altered pixels.
- The waving arm does not join cleanly in all frames. Keeping the approved hand pixels alone does not repair the edited shoulder/elbow geometry.

These are visible defects at both native and editor scale. Mask-preservation tests prove only the protected pixels; they do **not** prove clean joints, accurate pose geometry or artistic acceptance. A further pose-specific painted correction must be made directly against the original limb and clothing geometry. The generated 5A-Q full-body edits are not a sufficient source for that correction. Karl does not need to edit the artwork, and no production integration should follow from this result.

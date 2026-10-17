# Milestone 5B-P.1 — Maxine single-pose cleanup

**Status: offline visual review only. Karl has not approved this cleaned sprite.**

## What changed

- Began from the existing `proofs/milestone5b-p/maxine-front-tshirt-leggings-experiment.png`. The input was not overwritten.
- Replaced the rough collar and lower-head composite band (x 130–300, y 390–425) with the cleaner neckline already present in the 5B-P clothing draft. Original chin skin and adjacent outline pixels through y 398 were retained where they occur. The purple T-shirt, star and leggings design were not changed.
- Removed 27 nearly transparent pale fringe pixels around the lower hair, wrists and trouser hems. This trims visible edge specks without moving the original hands or altering trainer pixels.
- Restored the exposed outer tips of both lower hair curls directly from the approved front-idle sprite, including their original antialiased edges. The restored regions contain no old clothing.
- Preserved the original approved face and upper hair pixels exactly through y 389. Every pixel from y 590 down, including both original pink trainers, is unchanged.

## Evidence

- `maxine-front-tshirt-leggings-cleaned.png`: native 434 × 724 RGBA candidate.
- `before-after-native-scale.png`: the original 5B-P candidate and cleaned sprite at equal scale.
- `seam-closeups-before-after.png`: enlarged collar, lower hair, wrists and ankles.
- `cleaned-editor-scale.png`: normal 213 × 355 Playground draw size.
- `cleanup.py` and `verify.py`: reproducible bounded edit and integrity checks.

## Verification

`py -3.12 proofs/milestone5b-p1/verify.py` passed. It checks the SHA-256 of the approved production Maxine sprite and the 5B-P input, canvas dimensions, RGBA transparency, exact upper face/hair region, exact original trainers, and that all 3,683 changed pixels lie in the specified collar/hair/wrist/ankle regions. No production artwork, application code, saved data or other poses were changed in this milestone.

## Remaining visual limits

- The collar is substantially cleaner in the enlarged comparison; the old pale hood fragments and jagged black neckline are gone.
- The exposed outer hair edges now match the approved original. A few fine pixels remain around the inner lower curls where the hair overlaps the changed neckline; they are visible only in the enlarged inspection against a pale background. Editing deeper into that overlap risks changing the hair silhouette or T-shirt shoulder.
- The hand contours and shoe shapes were deliberately not repainted. The wrists retain a fine outline transition, and the leggings meet the trainers along a fairly straight cuff line. These are visible in the enlarged close-ups. Removing them more aggressively would change original hand or trainer artwork, so this proof stops here for Karl's review.
- This is not evidence that the remaining eight poses can be produced with the same quality. No animation or production integration has begun.

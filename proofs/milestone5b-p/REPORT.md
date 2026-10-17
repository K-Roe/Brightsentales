# Milestone 5B-P — Maxine front-idle outfit experiment

**Status: visual proof only; not approved for animation or production.**

## Source and method

- Source: `public/art/maxine-0.png`, 434 × 724 RGBA, SHA-256 `0a8be579504df4534b2b074a4e147856ecb99f34246f91fbb04e15236f4da26c`.
- Maxine's original hoodie covers the shoulders, neck and arms. The skirt hides the hip and upper-leg contours. Those areas need reconstructed artwork for a T-shirt and leggings; a colour swap would leave the old garment shapes.
- An offline image edit produced `generated-draft-reference.png` as a clothing design reference. Its face, hair and proportions drifted, so that full generated draft was rejected as a character asset.
- `compose_proof.py` places the draft's pose-specific shirt, exposed arms and leggings into the original canvas. It restores the approved original face/upper hair area, the lower portion of the original hair where identifiable, the hands and the original shoes from source pixels. The cream hoodie and pleated skirt have been removed in the normal-size view. The approved source is never written.
- The purple T-shirt, small yellow star and navy leggings are one offline design; no runtime generation or application code is involved.

## Review files

- `maxine-front-tshirt-leggings-experiment.png`: candidate at native 434 × 724 resolution.
- `original-vs-candidate.png`: source and candidate at identical native scale.
- `candidate-editor-scale.png`: candidate at the current 213 × 355 Playground draw size.
- `seam-closeups.png`: collar, sleeves/hands, waist and ankles enlarged, original beside candidate.
- `protected-source-regions.png`: areas copied from the approved original.

## Findings

- The candidate reads as Maxine in a clearly different T-shirt and leggings at normal size. Her original face, upper hairstyle and trainers are exact source pixels. Body pose and shoe positions remain close to the approved idle.
- **The collar is not clean enough to approve.** Enlarged review shows dark and pale pixels around the neckline and the lower side hair. This is the join between a flattened head/hair/hoodie and a new shirt with a different neckline. It is also visible at native size on close inspection.
- The hands connect to the new forearms at normal size, but their edge joins need artist cleanup when enlarged. The candidate uses more of the generated forearm shape than the original.
- The leggings meet the original trainer tops, but there is a horizontal colour/outline transition at the ankles in the close-up.
- Because the generated draft changed the full character, it could not be accepted without source-pixel restoration. The composite still needs targeted collar, hair-edge, hand and ankle paintwork. Passing pixel checks cannot resolve those visible defects.

## Focused verification

`py -3.12 proofs/milestone5b-p/verify.py` passed: original file hash, 434 × 724 dimensions, RGBA transparency, exact pixels in the upper face/hair region (y 0–389), and exact original shoe pixels (y 590–723). No application, production sprite or saved-data files were changed for 5B-P. A full application build was not necessary for this offline artwork experiment.

## Decision needed

This proof establishes the outfit direction but **does not meet the clean-seam acceptance criterion**. The smallest next step, if Karl likes the outfit design, is one carefully painted, pose-specific correction of the collar/hair edge, hand joins and ankle transitions on this idle candidate. A properly layered source for Maxine would make future wardrobe work more reliable; the current flattened PNG does not expose the anatomy under her hood and skirt. No remaining poses should be attempted before this single pose is visually accepted.

# Milestone 5A-P — clothing artwork experiment

**Status: visual proof only; not approved or ready for the Maker.** No production sprites, masks, character data, Playground code, or backups were changed.

## Source and output

| Pose | Approved source | Experimental edit | Source size | Edit size |
| --- | --- | --- | --- | --- |
| Front idle | `public/art/max-0.png` | `front-idle-candidate.png` | 434 × 724 | 970 × 1621 |
| Right-facing walking contact | `public/art/max-side-v3-1.png` | `walk-contact-candidate.png` | 560 × 724 | 1103 × 1426 |
| Wave | `public/art/max-wave-2.png` | `wave-candidate.png` | 500 × 724 | 1042 × 1509 |

The three files were produced as separate image edits of the approved transparent full-body PNGs. The front outfit edit was also supplied as a design reference for the walking and waving edits. The prompt requested a plain purple short-sleeved T-shirt, navy trousers, existing shoes, exposed teal arms, unchanged pose and identity, and transparent backgrounds. No edits were made to the approved source files. `make_comparisons.py` only arranges and crops the existing PNGs for review; it does not alter the candidate art.

## Review images

- `side-by-side.png`: each approved pose beside its new-outfit edit at equal displayed figure height.
- `front-idle-closeups.png`, `walking-contact-closeups.png`, `wave-closeups.png`: shoulders, elbows/sleeves, waist, and legs/shoes. Crops use equivalent fractions of each figure and are enlarged independently. They are for seam inspection, not pixel registration.

## What works and what does not

- All three edits show a recognizable teal Max-like character in a plain purple T-shirt, dark trousers, and blue/white trainers. The T-shirt and trousers follow each individual pose; there are no static overlaid garments.
- The hoodie hood, drawstrings, star, and shorts are absent in the edits. The new shoulder, elbow, waist, and trouser connections look plausible in these still images.
- **Identity and proportions changed.** The face, hair contours, hands, shoes, outline shapes, and body widths were regenerated rather than preserved exactly. The walking head and shoes are especially different. The wave hand shape also differs from the approved gesture.
- Output dimensions and transparent margins differ substantially from the approved sprite frames. These files cannot be swapped into the existing animation pack without alignment and scale work. A three-pose set does not establish a smooth nine-frame animation cycle.
- There is no demonstration of independently selecting top and bottom options. This experiment depicts one combined outfit only.

**Acceptance assessment:** the edited clothing is useful as a design reference, but these generated frames do not satisfy the requirement to preserve Max's exact approved appearance and proportions. They should not be used as production sprite replacements.

## Smallest safe route after visual review

Create pose-specific artwork on exact-size copies of the approved frames. Keep the approved head, hair, face, hands, tail, and shoes locked as source pixels. Paint only the revealed arm/body areas and the T-shirt/trouser regions, including joint and occlusion boundaries. A mask per pose can then recolour the painted top and bottom independently while retaining shading; `makeFrame` could select prepared pose art before the existing `makePack` timing and Playground renderer. Validate one corrected front/contact/wave set at original dimensions and stage scale before preparing the other six Max poses or any Maxine poses.

This route requires precise authored raster work for each pose and visual approval. It is not a simple swap using the current recolouring masks.

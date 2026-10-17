# Milestone 5A-S: one-pose wardrobe feasibility

**Outcome: source-only edit failed the visual standard. Do not integrate.**

## Source and changes

`make_pose.py` uses only the approved `public/art/max-0.png` as artwork input. It does not read any 5A-Q or 5A-R candidate. The script copies the original pixels, then edits bounded hoodie and leg regions. It replaces the yellow star and drawstrings with sampled purple, sketches a round collar and sleeve hems, shifts lower sleeve colour toward Max's original teal, and shifts exposed leg colour toward the original dark shorts palette. The head, face, ears, hands, tail, shoes, overall canvas and stance remain in their original positions. `allowed-change-mask.png` records every permitted changed pixel.

This was a deterministic source-pixel edit, not a whole-character regeneration. The edit is deliberately kept separate from production artwork and code.

## Visual inspection

`original-vs-candidate.png` compares original and experiment at the same 434 x 724 scale. `seam-closeups.png` enlarges collar/shoulders, sleeves/hands, waist, and trouser/ankle regions.

The result is **not a convincing T-shirt and trousers**:

- The hood and padded shoulder contour remain. A new collar drawn over them forms a visible purple blob.
- Recoloured lower sleeves retain hoodie folds and cuffs, so the arms read as painted sleeves rather than exposed anatomy.
- The original shorts hems remain over the recoloured legs. The lower garment therefore reads as shorts over dark tights, not long trousers.
- Recolouring the exposed legs retains the original narrow leg silhouette and does not provide cloth volume, creases or clean ankle cuffs.
- The star replacement is flatter than the surrounding hand-painted shirt shading.

These defects are clear at editor scale and in the close-ups. Further colour masks alone cannot reconstruct hidden shoulders, upper arms, waist and trouser fabric while preserving the painted style. A convincing variant needs **pose-specific artist-authored clothing and exposed-body layers**, aligned to the approved sprite, or equivalent careful local painting. A properly layered character master would make later outfit changes maintainable. The existing flattened PNG alone is insufficient for a clean automatic clothing swap. Karl need not draw those layers himself, but this experiment does not supply them.

## Verification

`verify.py` checks the original SHA-256 against Git `HEAD`, the 434 x 724 RGBA canvas and transparency, and exact pixel preservation outside the saved change mask. These checks do not establish visual quality. No other poses were edited; no Maxine, Maker, Playground, saved data or production sprites were modified.

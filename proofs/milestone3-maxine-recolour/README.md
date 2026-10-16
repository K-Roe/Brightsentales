# Maxine-based female Brightling recolouring proof

This folder is offline artwork tooling. It does not change the React app,
Maxine's original PNGs, approved movement timing, or the approved Max-based
male proof.

## Artwork and masks

`recolour_maxine.py` reads the nine Maxine PNGs actually used by the editor:
front idle, right-facing side idle, four V3 walking poses and three waving
poses. For each source pose it saves three reusable raster masks: hair, body
and main clothing. The masks are generated once from the approved painted
colours plus pose-specific hand and face locations, then reused unchanged for
every palette. Each output keeps the source RGBA size and alpha pixel-for-pixel.
The source's shading, highlights, folds and antialiased silhouette remain.

The **main clothing colour controls the cream hoodie fabric**, including its
sleeves and hood. Pink seam lines and cuffs, the pink star, purple skirt and
leggings, shoes, yellow hair clip, eyes and facial features keep their approved
colours. This retains the existing outfit's colour relationships. Recolouring
the skirt, trim, shoes or accessories would require separate masks and a new
visual approval; it is outside this proof.

`palettes.json` accepts a name, ID and `#RRGGBB` body, hair and clothing
colours. Lily, Ruby and Daisy are three examples from the same source poses and
masks. No finished image is hand-painted for an individual palette.

```powershell
py -3 proofs/milestone3-maxine-recolour/recolour_maxine.py
py -3 proofs/milestone3-maxine-recolour/test_recolour_maxine.py
```

`v1/` contains all 27 test frames, 27 reusable masks, contact sheets at the
editor's 355 px canvas height and original 724 px source height, enlarged
boundary crops, and a SHA-256 manifest.

## Visual limits to review

The original line art uses pink and purple pigments shared by the hair, face,
seams and accessories. The masks leave those facial details and accent lines
untouched, so high-contrast palettes such as Ruby and Daisy retain small pink
strokes and bright source highlights around the ear, fringe and hoodie edges.
The cream-to-colour hoodie conversion also makes existing pale seam highlights
more prominent. These are visible at native resolution; they should be judged
by Karl before this becomes a product template. Automated tests prove pixel
integrity and repeatability, not artistic approval.

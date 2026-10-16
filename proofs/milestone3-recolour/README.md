# Milestone 3 colour customisation proof

This is an offline experiment. Nothing here is loaded by the application. The
original `public/art/max-*.png` files remain the source for every pose.

## Method

- Load the approved Max front idle, side turn, four V3 walk, and three wave PNGs.
- Classify teal body pixels and purple hoodie pixels by their original HSV
  ranges. Preserve each pixel's value, which retains much of the painted light
  and shade.
- Separate teal hair from teal skin with a pose-specific spatial guide, then
  shift its hue separately. The guide is combined with the colour classifier;
  it does not change the silhouette, alpha, pose, or animation timing.
- Leave the eyes, nose, mouth, star, shorts, shoes, and dark line art in their
  original colours.

The comparison sheet shows all nine source/recolour pairs at identical scale.
`mask-max-*.png` images show the pixels selected for recolouring: purple means
hair, green means body, orange means hoodie.

## Limitation and smallest reusable next step

The painted hair and skin share teal hues, and some light hair pixels resemble
the skin. The polygon guides in this proof are deliberately approximate.
Visible green/cyan remnants and a hard colour edge can remain around the hair
fringe or at spike highlights. This proof should not be accepted as finished
production artwork on the strength of the contact sheet alone.

A production version would require a clean raster mask for each *unique* Max
pose: currently nine masks (idle, side turn, four walk, three wave). A mask
would be authored once per source pose, reviewed at native resolution, and
reused for every palette choice. Mirrored walking uses the same mask mirrored.
This costs mask preparation and visual QA, but no redraw of the body and no
per-character mask work. The already-distinct hoodie and much of the body can
continue using automatic colour selection. Eye-colour changes need an iris
mask and are intentionally deferred because the eyes are small and detailed.

Run locally with `py -3 proofs/milestone3-recolour/recolour_max.py`.

## V2 proof

`recolour_v2.py` adds reusable, antialiased semantic masks for the nine Max
frames. Small pose-specific landmarks follow the actual painted hairline and
rear tuft. The same masks are reused for every palette in `palettes.json`.
The hair and skin shares are blended together at subpixel mask edges, so no
fraction of an edge pixel is left in the original teal. Teal skin, hair and
purple clothing retain their source light/dark values while receiving the
chosen palette hue and saturation. Dark outlines, blue facial details, eyes,
star, shorts and shoes retain their source pixels.

Run:

```powershell
py -3 proofs/milestone3-recolour/recolour_v2.py
py -3 proofs/milestone3-recolour/test_recolour_v2.py
```

The output is entirely under `v2/`: nine PNG frames for each of Oliver,
Charlie and Finn; nine reusable masks for each of hair, body and hoodie;
six contact/inspection sheets; and a hash/dimension manifest. `palettes.json`
accepts new `#RRGGBB` body, hair and hoodie choices without changing masks.
The test characters deliberately share Max's exact silhouette, face, shoes,
poses and timing. They demonstrate colour customisation, not new character
shapes or identities.

**Visual boundary:** the latest contact sheets should be reviewed by Karl at
both stage and native scale. Thin painted transition bands remain at some
hairline and right-hand tuft edges, especially in high-contrast palettes.
The source line work also contains pre-existing antialias pixels and stray
colours near some outlines. These are retained rather than painted over.
Automated checks cannot certify that every edge is artistically perfect.

**Maxine:** the same palette-and-mask engine can be reused, but Maxine's
approved frames need their own semantic masks and source-colour calibration.
Her hair, body and outfit occupy different colours and contours. No Maxine
asset or mask was altered or prepared in this proof.

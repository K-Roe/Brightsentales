# Milestone 3 revised visual proof — local art study

Status: **visual proof not achieved; Milestone 3 remains unapproved**.

No live app code, approved character asset, walking frame, wave frame, room art, or scene data was changed. These files are isolated offline diagnostics. The three generated images are rejected studies, not Oliver artwork or modular parts.

## Approved style observed

Max and Maxine use a large head on a compact body, expressive eyes with several painted values and highlights, strongly shaped hair, variable dark outlines, soft but directed skin shading, fabric folds, complete sleeve-to-hand shapes, and chunky grounded trainers. Their approved walk frames include authored bent legs and distinct foot contacts; wave frames maintain continuous sleeves and hands. The source PNGs are flattened RGBA images. They do not expose separate hair, skin, clothing, hand, or hidden joint pixels.

## Existing local capability tested

The installed Comfy Desktop SDXL 1.0 base checkpoint ran locally on an RTX 3050 with fixed seeds. No artwork was uploaded, no model or framework was installed, and no cloud service was used. The local workflow files are `local_generate.py` and `local_style_study.py`.

- Text-to-image generated a taller anime-like human with an extra jacket, animal-ear hood and boots. It missed the Brightling body proportions and approved style.
- Image-to-image at denoise 0.62 retained Max's silhouette, teal hair and purple hoodie despite the Oliver prompt. It is effectively a Max derivative.
- Image-to-image at denoise 0.82 altered hair and face but reduced facial and outline quality, kept the purple hoodie, and produced inconsistent shoe and hand detail.

See `local-sdxl-diagnostic.png` at matching display height. No result is suitable as Oliver's master artwork.

## Modularity result

No reusable artist-quality components were produced. Each SDXL output is flattened; it contains no clean back-hair, head, eye, hoodie, sleeve, hand, leg, or shoe layers. Segmenting the approved flattened sprites cannot recover the hidden pixels under hair, sleeves or joints. Recolouring those images would not create an independent character or a selectable part system.

For a genuine modular kit, a new layered master must contain matching front and side head/body bases, back and front hair, face features, clothing with pose-specific folds, and complete arm-hand and leg-shoe variants. Shared landmarks must fix eye line, neck, shoulders, hips and foot baseline. Hair and colour choices can be interchangeable within that master; sleeve/hand and leg/shoe shapes need authored variants for the walk and wave poses. Complete assembled frames should be inspected before app integration.

## Smallest next gate

Obtain **one artist-quality layered Oliver turnaround** with front idle and right-facing side view, plus one alternate hair and hoodie selection assembled from the same layers. Compare both characters beside Max and Maxine at stage scale. Only after Karl approves that visual direction should the two walking contacts, passing pose and raised wave hand be authored and assembled. Karl should choose and approve; he should not draw or edit any asset.

The current local model cannot supply that layered master reliably. A commissioned 2D artist is the most direct route. Cloud image generation could be explored only with Karl's explicit approval to upload the references, and it would still require layer separation and visual correction. No alternative was begun.

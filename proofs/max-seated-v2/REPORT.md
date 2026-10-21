# Max seated artwork V2 — static visual gate

21 October 2026. **Experimental candidate; awaiting Karl's visual decision.** Batch 3 remains **REJECTED** and Batch 4 remains **LOCKED**. No transition animation, Maxine pose, Scene Maker integration or production sprite replacement was made.

## Four requested stills

1. [Approved standing Max](01-approved-standing.png)
2. [New seated Max without chair](02-seated-anatomy.png)
3. [Seated Max on the layered chair](03-seated-on-chair.png)
4. [Standing and seated identity comparison](04-identity-comparison.png)

These are 1200 × 1100 pixel static artwork composites, except the 1600 × 1000 comparison. They are **not animation evidence**. [Measurements and source hashes](measurements.json) accompany the images.

## Construction

`scripts/build_max_seated_v2.py` copies 118,304 approved upper-body pixels from `public/art/max-0.png` into the seated coordinate system, translating them down 40 source pixels without repainting the face, hair, hoodie or arm art. The approved standing sprite is read only. The separate `public/art/experimental/max-seated-v2/generated-lower-source-v2.png` illustrates seated shorts, projecting thighs, bent knees, connected short shins and seated-view shoes. It is uniformly reduced from its high-resolution source and registered to Max's 434 × 724 source canvas with a solid foot row of 683–684. There is no stretched standing-leg silhouette and no skeletal motion in this V2 deliverable.

The provisional `proofs/max-rig-v1/chair-source.png` is read only. Registered `chair-back.png`, `chair-cushion.png` and `chair-front-arms.png` are in the V2 experimental directory. The full chair underpainting prevents gaps at layer boundaries; the traced cushion and arm regions control overlap. The approved sleeve and hand pixels are redrawn in front of the armrests so they remain visible. The chair and original Max sprite have not been altered.

The lower-body illustration was produced as a **separate transparent component** using the approved Max sprite for style reference. A first attempt had adult-length shins and was rejected. A second had almost no visible shins. The retained third component was requested with broad forward thighs, explicit knee-to-shin connection and the same overall chibi height. Its source is saved so Karl can inspect the generated pixels separately; no independent full-body frame was substituted for approved Max.

## Static visual assessment

The chair composite now shows Max's hips over the cushion, broad dark shorts/thigh surfaces projecting from the waist, turquoise knees, lower legs connected to shoes, and both shoes at the floor line. His approved head and hoodie still identify him. The no-chair anatomy image makes the new lower construction inspectable; without furniture context, this very short chibi pose can also resemble a crouch. The lower-body shading, shorts folds and shoe perspective are **new provisional artwork** and differ slightly from the approved standing design. A faint contour change remains on the chair's outer arm where the experimental foreground mask ends; it does not cover a hand or shoe in the reviewed frame.

I judge the static chair pose coherent enough for **Karl's review**, not accepted. Karl must decide whether the seated anatomy, identity and chair contact meet the cartoon standard. If he rejects the still, the defect should be corrected before any transition frames are built.

## Technical verification and limits

- `py -3.12 scripts/build_max_seated_v2.py` generated all four stills and the measurement file.
- `npm test -- --run`: **197/197 passed**. `npm run build`: **passed**.
- No animation, Scene Maker playback, episode export or browser UI workflow was tested for this isolated static pose.
- Approved walking, waving, phone and Bright Speak assets and code were not edited; those animations were not visually re-tested in this static-artwork task.

**Approval needed before transition animation:** Karl should review all four stills, especially the thigh/knee/shin construction without the chair and the cushion contact in the chair composite.

# Max articulated sit rig V1 — experimental visual review

21 October 2026. **Visual identity A: FAILED in motion. Motion quality B: FAILED.** This is an isolated, unapproved study. Batch 3 remains **REJECTED**; Batch 4 remains **LOCKED**. No Scene Maker or production animation path uses this rig.

## Review the actual render

- [Complete 6.77 s browser-rendered sit, hold and stand video](max-sit-cycle.webm) (VP9, 1672 × 941). The [close-range sequence samples](video-contact-close.png) are decoded from that video.
- [Approved Max beside the articulated neutral pose](standing-comparison.png).
- [Registered joint diagram](joint-diagram.png).
- [Lowering frame](knee-bend.png), [seated contact frame](seated-contact.png), and [close-up of the failed contact](seated-contact-close.png).
- [Browser probe](browser-check.json): no console exceptions, error entries or failed requests. The neutral rig has **0 differing visible pixels** against approved `max-0.png` on a 434 × 724 browser Canvas.

The video is a real `canvas.captureStream(30)` MediaRecorder capture of the TypeScript rig evaluator running in disposable headless Chrome. FFprobe reports VP9, 1672 × 941, 6.765147 s and 1,111,295 bytes. It demonstrates the failure; it is **not** an acceptance video.

## Construction

`scripts/build_max_sit_rig_v1.py` partitions approved Max pixels into separate head, torso, pelvis, upper arm, forearm, hand, upper leg, lower leg and shoe images. The parts and measured shoulder, elbow, hip, knee and ankle pivots share the approved 434 × 724 coordinate system in `rig.json`. Compact new joint-fill illustrations sit behind the approved pixels. The candidate chair was split into an unchanged rear image and a foreground armrest image. `src/experimental/maxSitRig.ts` solves two-bone knees from hip to fixed ankles and draws the rig; no production module imports it. The local [review page](review.html) provides play, pause, scrub, standing comparison and joint diagram.

## Visual findings and defects

| Gate | Finding |
| --- | --- |
| Neutral identity | Passes a strict browser pixel comparison: 0 visible RGBA differences. The approved face, hair, hoodie, shorts and shoes are present at rest. |
| Identity during motion | **Fails.** The older head cut-out does not own every visible head/hair outline pixel. Residual pixels in the torso rotate with it while the head stays upright, producing a duplicate hair arc and facial fragments during the bend and rise. See the second and fifth close-range video samples. The hoodie shoulder also shows slight seams. |
| Hip and knee movement | **Fails visually.** Joint maths changes the hip/knee positions continuously, but the short approved legs, oversized shoes and simple new fill pieces leave the thighs hidden. At contact Max still reads as standing or crouching in front of the cushion. The painted pelvis does not visibly settle onto a supported seat. |
| Grounding | Shoe pieces remain at the same source-space ankle and stage floor coordinates. This is a geometry check, not proof of natural weight transfer. |
| Chair layering | Two separate experimental back/front images render without altering the approved Living Room. The chair cannot rescue the missing seated anatomy. |

**Root causes:** the old head mask is incomplete for articulation, and the approved standing sprite contains no concealed pelvis, bent thighs or knees. Reusing its straight visible leg/shoe art plus simple backing shapes is insufficient to show a convincing seated silhouette. The next repair would need a complete head mask with exact neutral reconstruction and newly illustrated, jointly registered seated thigh/pelvis/shorts components. Since both visual gates fail, work stopped before production integration or more characters/actions.

## Verification and isolation

- `npm test -- --run`: **197/197 passed**. `npm run build`: **passed**.
- Experimental outputs are under `public/art/experimental/max-sit-v1/`; approved `public/art/max-0.png`, walking, waving, phone, Bright Speak and Living Room files were not edited.
- Scene Maker save/reopen, scene export and episode export were **not tested for this rig**, because it is deliberately not integrated.
- Maxine, sofa, toy carrying and Batch 4 were not started.

The provisional chair was generated with the built-in image-generation tool and saved as [chair-source.png](chair-source.png). Prompt: one transparent front-view purple children's armchair matching the supplied chair's outlined style, tall backrest, distinctly low cushion near the floor, short wooden feet, clear space for Max, no occupant, room or shadow. The chair image is provisional and unapproved.

# Max and Maxine Greeting V3 - root-cause investigation

**Status: FOUNDATION CODE VERIFIED; ARTWORK BLOCKED. NOT APPROVED.** Karl authorised V3 after rejecting V2. An opt-in walk-and-stop foundation is implemented and recorded, but it still has a visible pose cut. No V3 side-wave production art, full greeting scene, or complete episode export exists. V1 and V2 remain rejected.

## Frame-by-frame findings

The 200 decoded V2 episode frames were inspected in four [indexed contact sheets](v2-contact-1.jpg), [2](v2-contact-2.jpg), [3](v2-contact-3.jpg), and [4](v2-contact-4.jpg). The [close-up stop boundary](problem-stop-closeup.png) shows the last walking stride at video time 3.09 s and the standing profile at 3.18 s. Feet and body silhouettes change in one cut. The [wave close-ups](problem-wave-closeup.png) show Max's hand over his eye line and Maxine's disconnected sleeve/hand contour. The approved side-standing art and specific changes needed are on the [correction brief](proposed-correction-brief.png).

The causes are separate:

1. `stateAt` evaluates a V2 walk until its end and then immediately returns side-standing frame 0. Max's 340 px path ends in walk frame 1 (340 mod 56), and Maxine's ends in walk frame 2 (340 mod 62). No landing/contact transition bridges either to frame 0. These stride constants and approved walking frames must stay intact for existing scenes.
2. `drawScenePreview` draws a 500 x 724 source at 239 x 355 while walking and 213 x 355 while side-standing, although proportional width at that height is 245.2 px. The standing pose is therefore squeezed more than the walking pose. The renderer uses the measured *vertical* foot anchor but not its x coordinate, so a common canvas center does not keep a particular shoe planted when the drawing changes.
3. V2 wave frames were assembled by cropping and flipping front-facing arms onto copies of profile art. This cannot supply a coherent side shoulder, sleeve, hand orientation or eye line. Max's base drawing also retains the lower forward fist under the added raised hand. Existing approved wave frames face front; no approved profile-wave art exists.

The V2 scene and episode exports share `drawScenePreview`. Decoded frames at 4.1 s and 5.9 s show the same poses in both exports (mean per-channel pixel difference approximately 0.8-1.6, consistent with separate video encodes). That comparison does not verify live Scene Maker preview against V3, which has not been implemented. The videos contain the reciprocal waves; the indexed contact sheets retain all 200 frames for full-sequence review.

## Proposed V3 correction and gate

- Illustrate complete side-facing wave poses for both characters from their approved profile sheets. Each frame needs one raised hand, continuous shoulder/sleeve contours, a hand clear of the face and eye line, the same clothing and body silhouette, and unchanged shoe geometry. Do not paste frontal body parts, flip individual limbs, scale the artwork non-uniformly, or change approved originals. Mirror only the complete right-facing character when she faces left, as the approved walk renderer already does.
- In the existing `stateAt`/`drawScenePreview` path, keep facing direction explicit through walk, stop, wave and idle. For this opt-in greeting, draw every 500 x 724 side frame at one proportional size and register transitions to the planted foot. End the walk with an intentional grounded landing before side-standing idle. Keep other saved scenes and approved actions unchanged.
- Before V3 review, save/reopen the scene and Studio Backup in a disposable profile; capture Scene Maker preview and scene/episode exports at matching timestamps, inspect every transition, verify the complete video and frame timing, run focused/full tests and build, and request Karl's visual approval. No technical result grants approval.

## Artwork study and blocker

A local hand-drawn vector-style experiment is retained under [rejected-art-study](rejected-art-study/) with its [script](draw_side_wave.py). Visual inspection showed it does **not** match the approved painterly linework, sleeve anatomy or hand shape. It was moved out of `public/art` and is not wired into the app. It is not V3 artwork or a proposed production replacement. Properly illustrated, artist-reviewed profile-wave frames are required before a credible V3 recording can be produced. The current V2 candidate remains unchanged and rejected.

## Phase 1 foundation evidence, 22 October 2026

The new `greeting-side-v3` marker is limited to Max/Maxine walks. It preserves the side orientation, draws all marked 500 x 724 side frames at their proportional 245 x 355 display size, uses one standing-foot horizontal registration, and decelerates position over the final 0.45 seconds. V1, V2 and unmarked scenes keep their existing timing and dimensions. The [4.2-second foundation scene](foundation-scene.json) has only approved walk and side-standing sprites; it is not the full greeting.

The scene was opened, saved, reopened and exported through Scene Maker in a disposable Chrome profile with no console errors ([browser result](foundation-browser-result.json), [scene recording](foundation-scene.webm)). Its [preview at 2.9 s](foundation-preview-2.9.png) and [preview at 3.0 s](foundation-preview-3.0.png) expose the remaining pose discontinuity; the [close-up comparison](foundation-stop-closeup.png) makes it clear. The exported clip decoded at 103 frames, 1672 x 941, over approximately 4.27 seconds. The [exported stop frame](foundation-export-3.25.png) shows the same final pose as Scene Maker. MediaRecorder timestamps run slightly after the Scene Maker timeline, so exact frame-time equality has not been established; full episode equivalence cannot be tested before the wave art and episode exist.

Focused regression tests passed 16/16, full suite 205/205, and production build passed with the existing large-bundle advisory. These prove only the scoped code path and technical build. They do not make the landing look natural or approve any V3 animation. The trial vector wave frames remain in `rejected-art-study/`, not production assets.

### Exact artwork needed to unblock V3

- **Max landing:** two whole-body transparent 500 x 724 PNGs, right-facing, bridging approved `public/art/max-side-v3-1.png` to `public/art/max-side-0.png`. The final contact must settle onto the exact side-standing shoes and floor line. Maintain the approved face, hoodie, shorts, skin, tail and outline style.
- **Maxine landing:** two equivalent PNGs bridging `public/art/maxine-side-v3-2.png` to `public/art/maxine-side-0.png`, with her shoes planted at the standing floor line and her face, hoodie, skirt, hair, leggings and colours unchanged.
- **Side wave:** three whole-body transparent 500 x 724 PNGs for each character, based on the respective approved `*-side-0.png`. Frame 1 raises the near arm, frame 2 reaches a clear open-hand greeting, frame 3 varies the wrist/hand naturally before returning to the original side-standing pose. The raised arm must join the shoulder and sleeve, the original lower hand must be removed or posed consistently, the waving hand must clear the eye line, and feet must remain registered to side-0. Supply right-facing art; the existing renderer mirrors the complete Maxine sprite when she faces left.

These ten frames need to match the approved painterly linework at full source resolution. A repository search found no layered PSD/KRA/ORA/SVG character sources or existing profile-wave art beyond the rejected V2 composites and rejected local study. Layered source files for Max/Maxine would help produce the frames, but the PNG frames are the required assets. Do not replace the approved originals. Once suitable frames exist, wire them only into this V3 greeting through the existing renderer, inspect the complete scene and episode frame by frame, and submit them to Karl as a review candidate.

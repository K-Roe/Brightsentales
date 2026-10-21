# Batch 3 structural repair: stopped at artwork blocker

21 October 2026. **Batch 3 remains REJECTED. Batch 4 remains locked.** This is an investigation and failed visual pilot, not repaired animation evidence or a request to approve the actions.

## Scope and evidence checked

I reviewed the [rejection audit](REJECTION_AUDIT.md), all five exported Batch 3 video contact sheets and the failed sofa frame, the approved Max/Maxine idle and side-walk artwork, the unchanged Living Room image, the provisional sit/object frames, and the shared `timedScenes.ts` and `scenePreview.ts` paths. The existing renderer uses one stage foot point, switches the Batch 3 sit through only idle/lowering/seated, and places the toy by global point offsets. The chair is a single opaque image behind the character; the Living Room sofa is flattened into the approved room pixels. The prior audit gives exact measurements and links to the rejected complete videos.

## Additive visual pilot

I generated transparent *candidate* whole-body Max and Maxine anticipation, intermediate and seated poses plus a wider chair with the built-in image-generation tool. The prompts instructed identity, outfit, full shoes, bent knees, visible hand placement and transparent backgrounds, using the original approved characters and prior pose outputs as references. I copied no candidate into an approved sprite pack. The candidate source PNGs and the disposable Chrome Canvas pilot script are in [repair-candidates](repair-candidates/). The script expects trial copies under `public/art/provisional-actions/repair-candidates/`; these trial copies were removed after the pilot and must be staged again in a disposable checkout to rerun it.

| Visual | Finding |
| --- | --- |
| [Chair pilot](repair-candidates/pilot-chair.png) | A lower/wider chair and front arm pass make a single seated frame read more clearly. It does not prove the transition. |
| [Pose sequence](repair-candidates/pilot-sequence.png) | At identical draw dimensions, the head and shoulders change height and proportions between approved idle, generated anticipation, old lowering and generated seated. The body does not continuously shift weight onto the chair. The provisional frame details vary, especially Maxine's hair and clothing silhouette. Frame switching would remain conspicuous. |
| [Sofa pilot](repair-candidates/pilot-sofa.png) | Copying selected unchanged room pixels over a seated Maxine can suggest overlap in one fixed position, but the sprite's feet align with the sofa front, not a supported floor plane. Rectangular masks cannot provide reusable accurate cushion/arm occlusion across positions or scene depth. This is **not** a verified layered sofa. |
| [Original toy contact sheet](rejection-audit/max-toy-contact.png) | The approved side-walk arm swings freely. The existing front carry pose shows an open palm, but no matching side-carry walk frames exist. Changing an anchor alone would move the ball with a swinging hand and leave an abrupt front-to-side silhouette change. |

The candidate alpha bounds differ substantially even within this pilot. Max anticipation is `(34,69)-(938,1597)`, middle `(0,111)-(940,1538)`, seated `(40,17)-(956,1597)` on roughly 970 × 1621 canvases. Maxine anticipation is `(21,17)-(906,1517)`, middle `(63,49)-(919,1586)`, seated `(0,109)-(939,1586)`. Registration would be necessary but cannot correct the drawn changes in anatomy, silhouette and seat contact.

## Why I stopped

The approved whole-body sprites have no consistent seated pelvis/feet transition, gripping hands, or side-carry walk. The approved flat sofa has no separate cushion, arms and foreground edges. A renderer change, numeric offsets or a CSS mask cannot create the missing artwork. The first additive generated pose set fails the requested continuous identity and floor/seat contact when placed side by side. Wiring it into Scene Maker would reproduce the kind of visual failure Karl rejected. Meeting the standard requires a substantially redesigned **additive action art pack**: registered standing-to-seated frames with a measured seat landmark for each Brightling, separately authored non-destructive sofa foreground/background layers aligned to the original room, and a full side-carry cycle with a constant prop grip and measured palm per frame. That is a substantial artwork redesign, even if the approved original sprites remain untouched. Karl's instruction says to stop and report at this point.

## State and verification

- No candidate is wired into `timedScenes.ts`, `scenePreview.ts`, Scene Maker or episode export. The temporary type changes were removed. Candidate PNGs remain only under this proof directory; trial copies were removed from public art.
- Batch 3 creation remains disabled for general use, and existing saved review scenes remain readable under the current code. Approved walking, waving, phone, Bright Speak, sprite packs and Living Room art were not changed.
- `npm test -- --run`: **197/197 passed**. `npm run build`: **passed**. These are baseline regression checks, not visual repair verification.
- **Not produced:** repaired complete videos, close-up contact sheets for actual grips, Scene Maker save/reopen and episode export of repaired actions. There is no repair to exercise. The prior rejected videos must not be presented as new evidence.

**Decision needed before implementation resumes:** authorize a substantial additive artwork redesign with explicit visual review of a registered pose sheet, side-carry cycle and sofa layers *before* any renderer or Scene Maker wiring. Batch 3 remains rejected regardless of that decision until Karl watches complete exported videos and explicitly approves them.

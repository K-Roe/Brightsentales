# Milestone 5A-Q recovery and visual review

## Recovery status

The available 5A-Q artwork was recovered **without alteration**. The nine runtime-sized PNGs in `proofs/milestone5a-q/frames/` were copied byte-for-byte to `frames/` here. The nine earlier raw edits in `proofs/milestone5a-q/candidates/` were copied byte-for-byte to `raw-candidates/` for provenance. No 5A-R or 5A-S image was used. `hash-manifest.json` records SHA-256 hashes for every source/copy pair. This verifies fidelity to the currently present 5A-Q folder; the folder is untracked in Git, so Git cannot independently establish an older historical version.

| Runtime pose | Exact 5A-Q frame | Raw candidate used by the 5A-Q preview script |
| --- | --- | --- |
| Front idle | `max-0.png` | `front-idle-candidate.png` |
| Side idle | `max-side-0.png` | `side-idle-candidate.png` |
| Walk contact 1 | `max-side-v3-1.png` | `walk-contact-candidate.png` |
| Walk passing 1 | `max-side-v3-2.png` | `walk-passing-1-candidate.png` |
| Walk contact 2 | `max-side-v3-3.png` | `walk-contact-2-candidate.png` |
| Walk passing 2 | `max-side-v3-4.png` | `walk-passing-2-candidate.png` |
| Wave 1 | `max-wave-1.png` | `wave-1-candidate.png` |
| Wave 2 | `max-wave-2.png` | `wave-candidate.png` |
| Wave 3 | `max-wave-3.png` | `wave-3-candidate.png` |

The runtime-sized 5A-Q frames were originally scaled and aligned from those raw candidates by the 5A-Q proof script. This review does not repeat that operation or alter either set.

## Evidence files

- `nine-frames-native-scale.png` — all nine recovered frames presented at their actual PNG pixel size, without sprite scaling.
- `approved-vs-5a-q-native-scale.png` — each recovered frame beside its matching approved Max frame at the same pixel size.
- `seam-closeups-enlarged.png` — enlarged presentation crops of collar, shoulders, sleeves, waist, trousers, ankles and raised waving arm.
- `original-5a-q-evidence/walking-preview.gif` and `waving-preview.gif` — **unchanged copies** of the original 5A-Q previews. They include the approved original beside the outfit candidate. The walking preview uses the 5A-Q four-frame order and 110 ms turn/stop; its intended 123 ms step intervals are encoded as 120 ms by GIF's 10 ms time resolution. The wave uses the approved nine-state order at 180 ms per state.
- `original-5a-q-evidence/` also holds exact copies of the original 5A-Q contact sheet, seam sheet and report.

## Visual review

Max remains recognisable throughout: the teal body, hair silhouette, large eyes, ears, mouth, tail, hands, purple top and blue-and-white trainers read as the same Brightling at normal editor size. The outfit has a clear short-sleeved shirt and full trousers. The shading and dark outlines are broadly consistent. The images are not pixel-identical to the hoodie originals, but most facial, trainer and contour differences are stylistic differences rather than visible damage. The enlarged crops show no obvious detached limbs or major transparent holes at the displayed collar, sleeve, waist or ankle joins.

| Frame(s) | Review finding | Noticeability |
| --- | --- | --- |
| `0`, `side-0` | Front and side outfit read cleanly; the face, ears, tail and shoes remain recognisable. The neckline and footwear details differ from the approved hoodie art. | Mainly enlarged comparison. |
| `side-v3-1`, `side-v3-3` | Both show a long stride with nearly the same leg/arm arrangement. The opposite-foot contact is weak; the four-frame walk may look like a repeated contact. | Noticeable in the cycle at editor size. |
| `side-v3-2`, `side-v3-4` | Passing and knee-lift silhouettes are clearly different, with no apparent detached leg or shoe. Shoe/ankle shapes differ somewhat from their original counterparts. | Shape variation at normal size; detail differences enlarged. |
| `wave-1` | Lower raised-hand pose is clearly distinct from the open-palm poses. | Clear at normal size. |
| `wave-2`, `wave-3` | Both preserve a raised open hand, but hand/arm positions are close. The wave motion may read as subtle, as in the approved sequence. | More evident when watching the GIF than from a single still. |

**Correction candidates for Karl's review:** `side-v3-3` is the clearest pose to revisit if a stronger alternate foot contact is required. `wave-3` only needs correction if Karl finds the copied wave GIF too static. No other frame shows a clear must-fix seam in this review. These are visual judgments from the supplied PNGs and GIFs, not production approval.

## Verification and boundary

`verify.py` confirms every copied frame, raw candidate and original 5A-Q evidence file matches its current 5A-Q source hash; all nine runtime frames retain the approved canvas sizes and RGBA transparency; the copied GIFs retain their frame counts/durations; and the nine production Max sprites match Git `HEAD`. Application source, production artwork and saved data were not changed. No correction, integration or new artwork was attempted. Karl's visual approval is required before any next step.

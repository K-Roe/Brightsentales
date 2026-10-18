# Approved-pixel articulation audit (approach 4)

18 October 2026. Question put to Karl: can the **approved** Max be made reusable for animation — cut into parts that can be posed — without redrawing him and without using the incorrect sibling-repository Max?

**This is an audit and a recommendation only. Nothing has been implemented, and no approved artwork was modified.** The app is unchanged by this work: 184/184 tests, production build, and the V1.2 pop-up work all remain as committed.

## Findings

### 1. The parts are separable in principle — measured, not assumed

From `public/art/max-0.png` (434×724) and its recolour masks:

| Part | Evidence | Status |
| --- | --- | --- |
| Head (+ears, +hair) | A single skin component of 39,573 px, bbox (63,137)–(374,382) — completely disjoint from the body | **Cleanly cuttable** |
| Each arm | Below scanline **y = 395** the sleeve is its own run in the hoodie mask, separate from the torso run (measured on both sides) | **Cuttable below y=395** |
| Each hand | Its own skin component (right 2,144 px at (98,519); left 2,074 px at (333,520)) | **Cuttable** |
| Head pivot | (218, 382) — base of the head/neck | Usable for a look/tilt |
| Shoulder pivots | ≈ (150, 412) right, (300, 412) left | Usable |

### 2. The geometry works — this was the decisive check

An arm can only reach what is within its own length. Measured:

- right arm shoulder→hand = **108.3 px**, left = **101.5 px**
- a phone held in front of the chest at (215, 455) is **72.0 px** from the right shoulder and **90.5 px** from the left

**Both arms reach it by rotation alone**, with no stretching. This is why the earlier "draw new arms" attempt failed (the drawn arms could not bridge that gap convincingly) and why a cut-out rig can work: the geometry was never the problem — the artwork was.

### 3. The cut is *not* reliably automatic

My first feasibility probe (`scripts/probe_articulation.py`, output in this folder) split the artwork by hoodie-mask row runs. It **failed**: it over-erased the chest, left both hands in place, and produced floating arm fragments — see `feasibility-probe-sheet.png`.

Lesson: mask runs are not anatomy. Runs break around the star, cuffs and highlights, so "the run containing the midline" is not a reliable torso test. A production cut needs **explicitly authored cut paths** (hand-drawn polygons, authored once and stored with the rig), with the masks used only as a guide — not automatic run-splitting.

### 4. Approved raised-arm artwork already exists

`max-wave-1.png` contains a genuine approved raised arm (sleeve, forearm, mitten) already separated from the torso by the artwork itself (arms separable from y ≥ 363 there). So "arm raised" does not need to be synthesised by rotation at all — it can be a **frame swap using Karl's own pixels**, with rotation reserved for the angles in between.

### 5. What cannot be articulated

- **Fingers.** Max's hands are mittens with two bumps and a thumb. There is no finger in the artwork to point, so a tap can read as *the hand reaching and touching the screen*, but **not** as an extended index finger. That needs one small new asset (a pointing-hand variant), not a redraw.
- **Eyes/gaze.** Eyes are painted in; "look at the phone" can be done by tilting the whole head, not by moving eyes.
- **Rigid limbs.** A cut sleeve does not bend at the elbow. Arm poses are rigid rotations about the shoulder; forearm bend needs a second cut at the elbow.
- **Seams.** Every cut is a place where a seam can appear when the limb rotates far. Keeping pivots inside the shoulder and rotations modest hides this; extreme angles will show it.

### 6. Reusable existing systems

- `src/maker.ts` already establishes the pattern this needs: masks + offline part preparation + browser-side compositing. The recolour pipeline is not a pose generator, but the *recolour masks* are a ready-made guide for authoring cut paths, and `scripts/prepare_*_sprites.py` is the precedent for an offline art-preparation step.
- The sibling repository's Native2D system contains genuinely useful **design patterns** — a layered sprite/pose model, bone-style pivots, and explicit capability gating (`UnsupportedNative2DCapability`, `require_supported`) that refuses to pretend an unsupported pose works. Those concepts can be adopted. **None of its artwork can be**, since it is a different Max.
- The existing renderer, phone state machine, timing, continuity, audio and export all work today and need no change to accept posed frames.

## Feasible approaches

**A. Upper-body cut-out rig (recommended).** Author cut paths for head, torso, left arm, right arm. Bake them once into `public/art/rig/max/` with a `rig.json` (pivots, z-order, parts). The renderer composites base body + rotated/frame-swapped arms. Phone attaches to the holding hand's transform; the opposite arm rotates to the screen. Preserves every pixel of approved Max.

- Effort: **~1–2 days** including visual iteration.
- Covers: holding, carrying, reaching, pointing-as-a-whole-hand, waving (already approved), head tilt.
- Limits: no finger articulation, no elbow bend, seams at extreme angles.

**B. Full-body rig.** Also cut legs/feet for sitting, kneeling, stepping.

- Effort: **~3–5 days**; meaningfully more seam risk (the legs overlap the shorts and each other).
- Only worth it if seated or floor-level animation is a real requirement soon.

**C. Approved pixels + one small new asset.** As A, plus Karl (or an artist) supplies **one pointing-hand mitten** so a tap can show a finger. Everything else stays approved pixels.

- Effort: A plus integration of the extra part.
- This is the smallest possible ask for artwork — a single hand, not three full frames.

**D. Redraw the three poses.** Previously rejected by Karl.

## Recommendation

**Approach C**, i.e. A plus one small pointing-hand asset, in this order:

1. Author and store explicit cut paths (this is the part that must not be auto-derived, per finding 3).
2. Bake parts + `rig.json` into `public/art/rig/max/` — a *new* folder; the approved PNGs in `public/art/` are never modified.
3. Wire the rig into the existing shared renderer behind a pose state, keeping today's composited phone as the automatic fallback whenever a rig part or pose is missing (so nothing breaks for Maxine, custom Brightlings, walking frames or the alternate outfit until they get their own rig).
4. Add the pointing-hand part only if Karl wants a true finger tap.

This delivers "holding, carrying, tapping, pointing and waving" from approved pixels, needs no manual redraw per action, and creates a reusable rig for future animations rather than another one-off.

## Effort summary

| Approach | Effort | Gets you | Needs new artwork |
| --- | --- | --- | --- |
| A. Upper-body rig | 1–2 days | Hold/carry/reach/wave/head tilt, hand-to-screen tap | None |
| B. Full-body rig | 3–5 days | Adds seated/floor animation | None |
| C. A + pointing hand | 1–2 days + part | Adds a visible finger tap | One hand asset |
| D. Redraw 3 poses | — | — | Rejected by Karl |

**Awaiting Karl's approval before any implementation.**
# Max Phone Interaction V1.2 — audit, blocked artwork, pop-up improvements

18 October 2026. **The headline: the core V1.2 requirement — Max holding the phone in one hand and tapping it with the other — is NOT delivered, and cannot be delivered from the artwork in this repository.** What is delivered is the pop-up work, plus a precise specification of the three frames that are needed and an evidence trail showing why they cannot be scripted here.

**No visual acceptance is claimed on Karl's behalf.**

## 1. Why the animation could not be produced

### The approved artwork has no holding or tapping pose

`public/art/` contains, for Max and Maxine: one idle frame, five walk frames, three wave frames (per outfit). The sprite **sheets** were checked too (`*-sheet.png`, 2172×724); `scripts/prepare_wave_sprites.py` labels their contents as "Original idle", "Arm rising", "Open-hand wave", "Hand turns inward" — every pose in them is already extracted and in use. There is no holding, pointing or tapping frame anywhere.

### The existing art pipeline cannot create new poses

The character pipeline (`src/maker.ts`) is a **recolouring** pipeline: a source frame plus per-region greyscale masks (`body`, `hair`, `hoodie` in `public/recolour-masks/`), combined by `recolourPixels`. It recolours existing frames; it cannot author new ones. The tooling that generates new poses is the Native2D/Blender generator in the sibling `BrightTales` repo, which this task explicitly forbids touching.

### Scripted arm re-posing was attempted and rejected

I built `scripts/build_phone_poses.py`, which removes an arm (erasing the sleeve by separating it from the torso run in the hoodie mask, and removing the hand as its own skin component — both verified against `scripts/analyse_sprites.py`) and redraws the replacement in Max's style. Three iterations produced visible artefacts rather than convincing art. The rejected output is archived at `rejected-scripted-arms/` as evidence.

The blockers are structural, not tuning:

1. **Arm length.** The approved arm runs about 96 px from shoulder to hand (measured: shoulder ≈ (140,420), hand centre (98,519)). For the opposite hand to reach the device, the phone must sit within ~96 px of the tapping shoulder — that is, almost at chest centre, not out at his side where a held phone naturally rests.
2. **No bent arm exists to reuse.** I checked whether Max's own raised arm could be composited from the wave frames. The wave arm points up-and-out (hand at (56,374) in idle coordinates); reaching a device at chest centre requires rotating the forearm roughly 180°, which would flip the rolled cuff and highlight. Not viable.
3. **Style cannot be matched by primitives.** Max's hands are mittens with two finger bumps, a thumb and a lighter highlight; sleeves have a rolled cuff and a fold line, and the sleeve is contiguous with the hoodie's torso silhouette, so any drawn sleeve leaves a seam or a chewed edge.

Rather than ship broken artwork as "V1.2", the generated frames were deleted from `public/art/` and kept only as evidence.

## 2. The three frames that are needed

Each is a full-body frame at **434×724 RGBA**, matching `max-0.png`, with the rest of Max **unchanged** (same head, torso, legs, colours, outlines). Phone not required in the artwork itself — the existing renderer draws the device, so it stays consistent between poses.

| Frame | Name | Description |
| --- | --- | --- |
| 1 | `max-phone-hold.png` | Max holds the phone in his **left** hand (viewer right) in front of his chest. Forearm bent up and inward; hand grips the phone's near edge so fingers overlap it. His other arm relaxed at his side. |
| 2 | `max-phone-tap-raise.png` | Same holding arm. His **right** arm lifts across, index finger extended, stopping just short of the screen. |
| 3 | `max-phone-tap-touch.png` | Same, with the index finger touching the screen. |

Guidance for the artist: keep his established mitten hands, the rolled sleeve cuff and the dark navy outline; keep proportions identical to `max-0.png`; the tapping arm's shoulder must stay in its original position so the torso silhouette is unchanged.

To use them, the phone pose frames also need `body` and `hoodie` masks (the same greyscale-coverage format as the existing ones) if custom recoloured Brightlings should be able to hold phones too.

**Acceptance mapping once supplied:** Take Out → `hold`; Hold → `hold`; Tap → `raise` then `touch` then back to `hold`; Communicate → `hold`; Put Away → `hold` with the existing slide-down. Preview and the WebM export already read the same pose state, so no further renderer work is needed.

## 3. What was delivered and verified in this pass

**Communication pop-up improvements (Phase 4).** All applied and checked against real rendered frames:

- **Larger and nearer.** The pop-up grew from 235 px to 348 px wide (scale 0.5 → 0.74), the message text from ~24 px to ~34 px and the symbol from ~64 px to ~92 px.
- **Closer to Max and the phone.** The horizontal gap shrank from 130 px to 42 px, so it reads as coming from the device rather than floating in the room.
- **Still clear of his face.** "Above" placements now sit entirely above the top of the head (verified: pop-up bottom ≤ character y − 355), and "beside" placements sit at chest height.
- **Still inside the frame** at every character position, including off-stage extremes — asserted in `src/phone.test.ts` for all four positions across the stage.
- Message text, device speech timing, symbol choice and the gentle fade in/out are unchanged, as required.

Everything already working was re-verified end to end after these changes: **184/184 frontend tests** (27 phone tests, including three new pop-up placement assertions), production build, and the full isolated-Chrome acceptance run — generate a Kokoro line in Voice Maker, take out → tap → communicate "I'm hungry!" → put away, plus the second shot that starts holding the phone with zero phone actions. Exported WebM re-checked: 12.16 s, VP9 + Opus, mean −24.5 dB, **0 console errors, 0 failed requests**. Backup v8 compatibility and the Voice Maker flow unaffected.

## 4. Known limitations

1. **The final acceptance condition is not met.** A viewer does not yet see Max holding the phone in one hand and tapping with the other; the phone is still composited onto unchanged approved artwork, exactly as in V1.
2. Everything listed in the V1.1 report still applies (no arm animation, Living Room used because no kitchen background is approved, one phone per Brightling, no timeline lanes).
3. The rejected prototype `scripts/build_phone_poses.py` is retained as the pipeline that will consume the new frames (erase → redraw → bake device → emit frame); it is **not** production artwork and its output must not be shipped.

## 5. Decision needed

The blocking item is artwork, not code. Options are set out in the accompanying question. Nothing further will be attempted on the artwork until Karl chooses, because each iteration costs time and produces worse results.
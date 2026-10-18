# Max's Phone & Bright Speak Communication, V1

18 October 2026. Max is non-verbal: his phone communicates for him. This is a composited 2D prop interaction on BrightTales' existing sprite engine — no new artwork files, no rig, no cloud, no voice cloning, no changes to Music Studio.

## Result

Max can take out a phone, hold it, tap it, show a Bright Speak communication pop-up with a symbol and a message, have the **phone** speak the line while Max stays non-verbal, and put the phone away. The whole interaction is authored from the Scene Maker, plays back, survives a shot change, and is included in the exported scene video with its audio.

## What the audit found, and what that changed

The brief describes Native2D Brightlings, a rig with arm/hand animation, a Director with shot specifications and a prop attachment/draw-order system. **None of those exist in this repository.** They live in the sibling repo `C:\Users\karlr\repos\BrightTales` (`src/brighttales3d/character_2d.py`, `director_native2d.py`), which is outside this project's working rules. That sibling system even records *"Prop/object handling has no frozen Native2D contact solving"* (`director_native2d.py:98`).

What this repository actually has: Brightlings as **whole-body PNG frames** (5 idle, 5 side, 3 wave, per outfit — `outfit.ts`), a pose enum of `'idle' | 'side' | 'wave'` (`timedScenes.ts`), one deterministic animation engine (`stateAt`), one renderer (`drawScenePreview`, shared by Scene Maker, Intros, Credits and the WebM export), the Audio Library and scene clips, and Voice Maker's local AI speech.

Karl chose to build here on the real sprite engine, with a composited prop only (no regenerated artwork), and per-scene phone state with carry-forward. **Consequence, stated plainly: arms are baked into the sprite frames, so "hand and arm positions follow the phone" cannot be animated in V1.** The phone is placed at a hand anchor measured from the approved frames and moves with the pose, frame and walking direction. This is the constrained supported case the brief allows, not a claim that the rig animates.

## Files changed

- `src/phone.ts` (new) — types, action/validation rules, `phoneStateAt`, measured hand anchors, pop-up placement, phone speech-clip syncing.
- `src/phoneArt.ts` (new) — vector drawing of the phone, nine communication symbols, and the pop-up with its speaker mark.
- `src/phone.test.ts` (new) — 26 tests.
- `src/scenePreview.ts` — draws the phone on the hand and the pop-up above the cast, using the existing renderer.
- `src/timedScenes.ts` — optional `phone` and `phoneIn` fields, validated and pruned; older scenes load unchanged.
- `src/SceneMaker.tsx` — **Phone & Bright Speak** director controls and interaction inspector; now calls the shared `drawScenePreview` instead of keeping its own copy of the drawing loop.
- `src/studioBackup.ts` / `src/studioBackup.test.ts` — phone data proven to survive a Backup v8 round-trip with no schema change.
- `src/style.css`, `docs/`, `proofs/max-phone-v1/`.

### Duplicate renderer removed

`SceneMaker.tsx` held a second copy of the scene drawing loop, so the editor preview could not show anything the exporter did not. That is why the first run rendered no phone at all. The editor now calls `drawScenePreview` and adds only its selection ring, so what you direct is exactly what plays back and exports.

## How it works

- **Phone prop.** Drawn as flat outlined vector shapes, so it scales with the character. Anchors are hand centres measured from the approved frames (colour-blob centroids) for every pose and frame, for Max and Maxine, mirrored with a walking character. Where the far hand has no artwork behind the body (`max-side-0` left hand), `phoneAnchor` returns `null` rather than floating a phone in mid-air.
- **Timing.** `phoneStateAt(scene, characterId, time)` is a pure function, so preview, playback and export cannot disagree. Take-out and put-away ease over 0.55 s, a tap lights the screen for 0.5 s, and the pop-up fades in and out over 0.3 s with no flashing.
- **Speech.** The phone's line is a normal scene speech clip that starts 0.22 s after the tap, so the audience sees the tap before hearing the device. It carries **no** `speakerId`, so the device voice is never presented as Max's own speech. The clip is created, moved and removed automatically as the interaction is edited or deleted.
- **Continuity.** `phoneIn` on a scene means "this shot starts with the phone already in hand". Because scenes are independent documents, this is explicit and reversible rather than inferred.
- **Reuse.** Nothing is hard-coded to Max: the actions, symbols, pop-up and anchors are data, Maxine has her own anchors, and custom Brightlings (recoloured copies of the same frames) reuse them. Any Brightling can be given a phone; none is required to have one.

## Verification

Automated: `npm test` **183/183 passed** across 23 files (26 new phone tests, 15 backup tests including a new phone round-trip), `npm run build` passed, `npm run test:service` **11/11**, `py -3.12 test_voice_local.py` **5/5**. The earlier Voice Maker V1.1 browser flow and the ten-section regression smoke both still pass with **0 console errors and 0 failed requests**, so the Scene Maker refactor broke nothing.

Acceptance run (`proofs/max-phone-v1/verify-phone.mjs`, disposable Chrome profile, real local AI voice):

| Beat | Result |
| --- | --- |
| Phone line generated | "I'm hungry!" via Kokoro through the running voice service, saved to the Audio Library |
| Sequence authored | Take Out 0.6 s → Tap 2.6 s → Communicate 3.4 s → Put Away 8.6 s |
| Communication | message "I'm hungry!", food symbol, above-right pop-up, phone voice selected |
| Frames | `frames/01-no-phone` … `frames/08-phone-away`, each captured at its own playhead time |
| Continuity | `frames/09-continuity-carried-in` — second scene at 0.5 s holds the phone with **zero** phone actions (`phoneIn: "right"`) |
| Export | `max-asks-for-food.webm`, 12.16 s, VP9 1672×941 + **Opus 48 kHz stereo**, mean −24.5 dB / max −2.6 dB (real audible speech, not silence) |
| Video frames | `video/v1.8s.png` (held), `v2.8s.png` (tap, screen lit), `v4.2s.png` (pop-up + phone), `v9.2s.png` (phone away) |
| Console | 0 errors, 0 failed requests; disposable profile removed |

The exported `v4.2s.png` frame is the acceptance proof: Max holding the lit phone, with the symbol, message and speaker mark beside him.

## Known limitations

1. **No arm or hand animation, and no "look at phone" pose.** Arms are part of the approved sprite frames. Taking out, holding, tapping and putting away are communicated by the phone's movement and its screen, not by the arm. Genuine holding and tapping poses need new artwork and Karl's visual approval; this module is ready to take them when they exist.
2. **Max's idle artwork has an open smiling mouth.** That is his approved appearance, not lip-sync; nothing in this feature animates a mouth. Verified that the feature adds no mouth animation.
3. **The acceptance scene uses the Living Room, not a kitchen.** No kitchen background is approved artwork; Places only ships the Living Room, and new backgrounds are user uploads. A kitchen can be added by upload without touching this feature.
4. **Far hand while walking is unsupported** for one frame (`max-side-0`, left hand) because the hand is hidden behind the body. The renderer draws nothing there rather than floating a phone; use the near hand.
5. **No phone-screen interface yet.** The pop-up is a single symbol plus message. The state model has room for richer phone-screen views later.
6. **Phone interactions are not yet on the timeline lanes**; they are listed and scrubbed in the director panel with exact start times. Adding lanes is a follow-up.
7. **Only one phone at a time** is modelled per Brightling; two characters cannot hold two phones in one shot.
8. **Karl's eyes and ears are still required.** The exported audio was verified by level analysis, not by listening; and the phone's placement against the hand should be judged visually by Karl.

## Approval state

**Technically verified. Not approved by Karl.** The batch gate is unchanged: M6.7 and Beat Blocks remain unstarted, and the earlier microphone, speaker and visual reviews are still outstanding.
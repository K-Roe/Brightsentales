# Max Phone Interaction V1.2 completion — 18 October 2026

**Acceptance:** **PASSED — human visual acceptance by Karl, 18 October 2026.** Karl approved the holding pose, tapping animation and overall appearance. Six dedicated whole-body Max frames drive the original-hoodie, standing, left-hand phone performance. Device audio was technically verified; physical speaker/listening acceptance remains pending. The earlier [REPORT.md](REPORT.md) records the previously blocked attempt and is retained as history.

## Artwork and renderer

- `public/art/phone/max-phone-{enter,hold,tap-start,tap-mid,raise,touch}.png`: 434×724 transparent sprites. The device is baked into the holding hand, whose fingers cross its edge. The opposite index finger reaches the screen in `touch`. The approved `max-0.png` head, hair, face, and mouth are restored identically on every frame by `scripts/bake_max_phone_frames.py`; the source drafts are under `generated-candidates/`. Original approved sprites and recolour masks were not edited.
- `src/scenePreview.ts` loads these frames in the canonical `PreviewPack` and draws them through `drawScenePreview`, which Scene Maker, playback, Episode Maker and scene WebM export share. It never draws the legacy composite phone on top of an illustrated frame.
- `src/phone.ts` selects idle → enter → hold → tap-start → tap-mid → raise → touch → raise → tap-mid → tap-start → hold, then reverses enter for put-away. This selection depends only on saved scene data and time. A carried-in left-hand phone starts in hold. Other outfits, orientations, characters and hand selections keep the existing V1 prop and are labelled as such in Scene Maker.
- The V1.2 pop-up size, placement and fade remain in place. Phone action data, device voice, Audio Library clips, continuity and Backup v8 schema remain unchanged.

The transparent candidate edits were made with the built-in image generation tool using `public/art/max-0.png` as the identity reference. The [pose prompt set](IMAGE_PROMPTS.md) required Max's exact design, a phone gripped in his viewer-right hand, successive viewer-left tapping poses, and no new background or facial motion. The baking script resizes each candidate and replaces its generated face with the approved pixels.

## Evidence

- Final regression on 18 October 2026: `npm test -- --run` **185/185 passed** across 23 files, including illustrated-frame timing and carried-in state; `npm run build` **passed**; `npm run test:service` **11/11 passed**; `py -3.12 test_voice_local.py` **5/5 passed**.
- `verify-phone-v1-2.mjs` used disposable Chrome storage against the production build. It generated a local voice, saved it in the Audio Library, authored the full interaction and a second carried-in scene, then exported `max-asks-for-food-v1-2.webm`. Browser results: **0 console errors, 0 failed requests**. The second scene has `phoneIn: "left"` and zero phone actions.
- The final WebM is **1672×941 VP9 + Opus**, 292 decoded video frames, 3,033,231 bytes. The audio track has mean **−24.5 dB** and peak **−2.6 dB**. The saved speech clip starts at **3.62 s**, 0.22 s after the pop-up action; it has no `speakerId` and Max's mouth pixels are identical throughout the six illustrated frames. This verifies encoded signal and attribution, not subjective listening.
- Representative decoded exports: [hold](holding-closeup.png), [finger contact](tapping-closeup.png), [pop-up](video-popup.png), [restored idle](video-idle-restored.png). The `frames/` folder includes the editor stage at every key beat and the carried-in shot. I inspected these rendered frames for grip, fingertip contact, connected shoulders, pop-up placement and restored idle.

## Limits and acceptance boundary

- The six pose frames preserve Max's approved head exactly. Karl has approved their holding pose, tapping animation and overall appearance. Max looks ahead; no separate eyes-down artwork is present.
- This is frame animation. The short transitions are readable in the export, but they are discrete poses, not joint interpolation. The phone is intentionally fixed within each hold/tap frame.
- The acceptance scene uses seven beats in one 12-second scene and a second continuity scene. The Studio's current exporter is scene-only, so these are not seven separately exported shots.
- The integrated pose applies only to standing Max in the original hoodie with the phone in his left hand. The existing V1 composite remains for unsupported combinations; no matching new sprites or recolour masks exist for them.
- Browser media and audio measurements establish encoded signal and attribution. Karl's visual acceptance is **PASSED**; physical speaker/listening checks remain **PENDING**. V1.2 is complete and approved after the final regression and commit.

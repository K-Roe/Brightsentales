# Frame actions, batch 2 — blocked by missing pose artwork

**Requested actions:** Clap, point, nod and shake head. **Gate:** Batch 1 approved by Karl on 20 October 2026. Batch 2 has **failed its visual baseline** and has no product implementation or approval.

## Acceptance checklist

- [ ] Each action visibly reads as its named gesture on Max and Maxine.
- [ ] Approved appearance, proportions, foot contact and existing walking, waving and Bright Speak behaviour are preserved.
- [ ] The actions use the shared Scene Maker and episode renderer, save and sequence with other actions.
- [ ] A real browser-rendered scene video is inspected and presented to Karl.
- [ ] Karl approves the visual result before the next batch.

## Audit

The existing `point`, `nod`, `shake` and `clap` action types are already saved and selectable in Scene Maker. Their current `expressionAt` implementations transform the whole idle image: point rotates it once, nod rotates it repeatedly, shake rotates it more quickly and clap changes its width. None moves a hand or head independently. The active sprite packs contain idle, side-walk and wave frames, but no pointing, clapping or head-motion poses for Max, Maxine, their other outfits or custom Brightlings. The earlier AC-01 cut-outs are stopped and cannot provide clean motion.

## Browser-rendered baseline

- [10 second Scene Maker WebM](downloads/Batch_2_Existing_Actions_Baseline.webm) shows all four existing action types on Max and Maxine. It was exported with the application's Scene Maker WebM button in an isolated headless Chrome profile.
- [Scene Maker controls](scene-maker-actions.png) and decoded frames for [point](point-baseline.png), [nod](nod-baseline.png), [shake](shake-baseline.png) and [clap](clap-baseline.png).
- [Repeatable browser script](browser-check.mjs) and [scene and console record](browser-check.json). Chrome reported zero console errors. FFmpeg decoded 229 video frames and Opus audio through approximately 10.16 s. WebM SHA-256: `20F7621EEFE0246657D173632898FC4F6CB8BEB10CF899FEFD8162DC47360C2E`.

**Visual result: failed.** In the pointing segment, the hands remain at the characters' sides. Clapping never brings the hands together. Nod and shake move the entire character rather than the head. Whole-sprite rotation also tips the shoes away from the ground line. These are existing actions, so the video is diagnostic evidence, not a Batch 2 demonstration of new working animation. No Batch 2 product code or approved artwork was changed.

## Artwork needed to implement the requested actions

Use additive transparent whole-body frames, each registered to the existing idle canvas and ground anchor. Keep the approved originals untouched. The minimum visual pose set for each character template is:

| Action | Required new poses |
| --- | --- |
| Clap | Arms open, hands together, recoil; repeat and return to approved idle. |
| Point | Arm extended with a clear pointing hand, then return to idle. Left and right variants if direction matters. |
| Nod | Chin lowered and head raised while body and shoes retain the idle placement. |
| Shake head | Head turned left and right while body and shoes retain the idle placement. |

Max and Maxine's original outfits need approved frames first. Their alternative outfits and custom Brightlings additionally need corresponding frames or colour masks on the existing `makePack` path; simply substituting Max's painted PNG would lose those appearances. Once reviewable poses exist, the current `TimedAction` types, Scene Maker controls, save format and shared preview/export renderer can select them without a skeletal editor or a second animation engine.

**Decision needed for further implementation:** Karl can supply those whole-body pose frames, or separately authorise creation and review of provisional new artwork. Batch 2 remains blocked until its frames preserve the approved designs and pass visual review. The old misleading controls remain available in legacy scenes for backwards compatibility; they are not counted as completed Batch 2 actions.

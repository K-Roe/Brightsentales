# AC-01 Action Creator — visual acceptance failed

**Date:** 20 October 2026  
**Gate:** **FAILED by Karl.** Do not begin AC-02. No AC-01 visual approval is recorded.

## Karl's finding

Max's artwork visibly separates and leaves stray fragments as soon as a body-part slider moves. Karl supplied this finding from a manual app test. His screenshot was described in the task but was not attached to this session, so it is not included as a proof file here.

## Pixel and rig audit

The approved standing sprite and all eight existing rig PNGs are 434×724 RGBA. The rig files are source-pixel cut-outs: every nontransparent cut-out pixel has the same RGBA value as the corresponding approved `max-0.png` pixel. Common transparent padding therefore is not the coordinate error.

The previous editor draw order omitted `head.png` although `rig.json` requires it. Its neutral composite differed from the approved sprite at **54,943 visible pixels**. Adding the head layer and keeping hands parented to arms reduces a neutral offline composite to **398 differing visible pixels**, mostly from repeated translucent antialias edges. It still is not pixel-identical to approved art. The product preview now draws the approved original directly at neutral.

The recorded pivots are right shoulder (150, 410), left shoulder (300, 410), right wrist (98, 521) and left wrist (333, 522), all in source pixels. Because every layer uses the full source canvas, the rotation transform is centered on those coordinates without a padding offset. The wrist inherits the arm transform in the diagnostic render. These pivots might need artist refinement, but moving them cannot paint the absent torso behind the arms or erase retained original-arm pixels; they are not the primary failure.

Rotation exposes the more serious geometry defect. `torso.png` retains source-arm and hand fragments at their old positions while much of the torso/shoulder underneath the arms was never painted. Within the right sleeve box, the torso retains 2,779 visible pixels while 8,205 source pixels have no torso coverage; the left sleeve box has 622 retained and 7,092 without coverage. The shoulder patches contain only 1,151 visible pixels on the right and 203 on the left. They cannot cover the exposed socket through the offered ±70° range. Raising either arm exposes gaps and leaves fragments; moving both inward crosses the chest with the same defects. The hand-parent transform correctly inherits its arm's rotation and translation, but correct transform math cannot supply missing torso artwork or remove source-arm remnants cleanly.

The current cut-outs therefore **cannot support clean independent limb rotation** while preserving Max's approved appearance. CSS, clipping, offsets or filling the holes algorithmically would only conceal this source-art problem and were not used.

## Diagnostic images

These are **offline Pillow pixel composites of the existing cut-outs**, used to diagnose geometry. They are not screenshots from the application and do not verify the final browser preview.

- [Neutral comparison: approved original versus existing layered rig](diagnostics/neutral-comparison.png)
- [Failed editor neutral, without the required head layer](diagnostics/failed-editor-neutral.png)
- [Right arm at 30°](diagnostics/right-arm-30.png) and [60°](diagnostics/right-arm-raised.png)
- [Left arm at −30°](diagnostics/left-arm-30.png) and [−60°](diagnostics/left-arm-raised.png)
- [Both arms outward at 30°](diagnostics/both-arms-30.png) and [60°](diagnostics/both-arms-raised.png)
- [Both arms inward across the torso](diagnostics/both-arms-inward.png)

The repeatable read-only audit is [audit_rig.py](audit_rig.py): run `py -3.11 proofs/ac-01/audit_rig.py --write-diagnostics`. It does not change any approved artwork or rig source image.

## Fail-closed change

Action Creator now shows Max's approved `max-0.png` as a neutral preview and displays the visual failure. Pose sliders, keyframe authoring, playback, looping, import and save are disabled while the rig is invalid. Previously saved action definitions are retained; they can still be selected, exported, or deleted with confirmation. Existing walking, waving, Bright Speak, Scene Maker and approved sprite-rendering paths were not changed. The three AC-01 [test definitions](test-actions/) are retained for a future approved rig and should not be judged as working animation.

## Proposed rig repair

A proper Max-original standing rig needs artist-reviewed layers made from the approved design: a complete painted torso and shoulders behind both arms, sleeves separated cleanly from hands, shoulder and wrist overlap regions that remain connected over a defined angle range, explicit parent-child pivots and a documented draw order. The exact neutral render must reproduce approved `max-0.png` pixel for pixel or use that original frame at neutral with no visible transition when motion begins. The source must retain Max's approved face, colours, clothing and proportions. Validate left, right, both-outward and both-inward poses at several angles before re-enabling editing. This is a separate artwork repair; no replacement art was created or wired here.

## Verification and remaining acceptance

- `npm test -- --run`: **193/193 passed**, including the new fail-closed gate test.
- `npm run build`: **passed**.
- `git diff --check`: no whitespace errors.
- Pixel and rotated-pose audit: **failed** for the original layered rig, as detailed above.
- Actual browser screenshots, console/request checks and a smooth-movement recording: **NOT VERIFIED**. The Browser skill requires a Node REPL runtime for browser control and bars substitute browser-control tools; that runtime is unavailable in this session. No app recording is presented as evidence.

### Repeatable manual check for Karl

Use a disposable browser profile. Run `npm run build`, then `npm start`, and open the local address printed by the launcher. Open **Action Creator**. Confirm the failure message is visible, the neutral Max preview matches the approved standing art, and pose/playback/import/save controls are disabled. If an action was saved earlier, confirm it is still listed and can be exported. In a disposable Scene Maker scene, preview Max walking, waving and Bright Speak and confirm they retain their prior appearance. Record a screenshot and any console or missing-asset errors. Do not use production scene data.

The requested left-arm, right-arm, both-arm **application screenshots** and smooth-movement **application recording** cannot be produced or accepted with the present rig. AC-01 remains failed pending a properly separated, approved rig and Karl's renewed visual review. AC-02 through AC-05 were not started; no Scene Maker, sequence, additional-character or Studio Backup integration was added.

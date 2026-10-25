# Batch review for Karl

**P6 integration update (25 October 2026):** Karl explicitly authorised P6 merging and P7 kickoff. P6 merged at Studio `b3886fd6e48169524cdf14c307cf6fac4fcdda1f` and Unity `0998a013fe5d33dd5c5d4c71a541564d49b28251`; post-merge tests and build passed as recorded in [P6 proof](../proofs/cartoon-foundation-p6/REPORT.md). Unity Game-view visual acceptance and physical audio listening remain pending. P7 work is isolated and requires Karl's approval before merging. Earlier review gates below are historical.


**P6 review (25 October 2026):** P5 is merged and pushed. The isolated P6 Scene Timing & Transitions milestone has browser screenshots, a walkthrough and complete exported WebM in [P6 proof](../proofs/cartoon-foundation-p6/REPORT.md). Different durations for repeated scenes and Fade Through Black are technically verified in Studio; Unity verification and its exact limits are recorded there. P6 is unmerged pending Karl's later visual/usability review. Earlier gates below are historical.

**P5 episode production review (25 October 2026):** P4 is merged and pushed. P5 is technically verified on isolated Studio/Unity `cartoon-foundation-p5-episode-production` branches and remains unmerged. [P5 proof](../proofs/cartoon-foundation-p5/REPORT.md) includes the episode workspace, scene Inspector, timeline, browser save/reopen/replay, screenshots and walkthrough. Karl's full visual/usability review is pending. Older review gates below are historical under the current foundation authorisation.

**Foundation authorisation update (25 October 2026):** Karl authorised continuous Studio/Unity foundation development, overriding routine milestone visual/listening pauses for P3/P4. This does not change historical artwork approvals or rejected animation gates. P3 integration and isolated P4 proof are recorded in [P4 report](../proofs/cartoon-foundation-p4/REPORT.md); the older batch review entries below remain historical.

**Studio 3.1 Bright Speak amendment (25 October 2026): FINAL FREEZE REVIEW PENDING.** Karl approved the core editor workflow. Review the [editable message Inspector, timeline clips, two custom pop-ups, Classic playback and ten-second video](../proofs/studio-3.1/bright-speak-amendment/REPORT.md). Each Communicate Message clip keeps its own text across save/reopen/edit; older message-less actions keep the default. Tests and browser checks are technical evidence, not Karl's final approval. No merge or P3 work.

**Studio 3.1 Direct Animation core (25 October 2026): APPROVED BY KARL.** The isolated branch `studio-3.1-direct-animation` opens the Cartoon Editor directly and supports mouse placement, Walk destination, Wave at the playhead, timeline editing and save/reopen. The [core screenshots and walkthrough](../proofs/studio-3.1/REPORT.md) remain available. This approval does not freeze the Bright Speak amendment, merge Studio 3.1 or advance P3.

**Studio 3.0 experimental review (24 October 2026):** The professional workspace and Classic compatibility layer are technically verified on an isolated branch. Review the [Studio 3.0 screenshots and walkthrough](../proofs/studio-3/REPORT.md), including the canvas, Inspector, timeline, Workspace Settings and Unity status. The Phase 2 cartoon result remains subject to Karl's separate visual decision. No new animation, approved art, baseline, P3 audio transfer or main merge is included.

**Cartoon foundation Phase 2 (2026-10-24): AWAITING KARL'S VISUAL REVIEW.** Watch the [28.083-second review video](../../BrightTalesCartoonFoundationUnity/CartoonFoundationP2Review/phase2-review.mp4) and inspect the [Scene Maker screenshots](../proofs/cartoon-foundation-phase2/REPORT.md). Check walk arrival, Look At, wave transition, camera framing and editing clarity. The browser-to-Unity workflow, Play Mode 1/1, Studio 290/290, build and media decode passed; these do not constitute visual approval. P3 and merge remain stopped.

**Cartoon foundation Phase 1 (2026-10-24): TECHNICALLY COMPLETE; NOT VISUALLY APPROVED.** A real saved Scene Maker scene was created, reopened, edited and sent through a disposable browser to isolated Unity. Max and Maxine played, reset and replayed in two Game-camera runs. The [Phase 1 report](../proofs/cartoon-foundation-phase1/REPORT.md) links the 22-second review MP4, UI screenshots and test results. Please review character positions, timing, poses and reset/replay outcome. Other actions, camera, audio and episodes remain unsupported; Phase 2 is gated on Karl's visual decision.

**Cartoon production foundation Phase 0 (2026-10-24):** Source audit and approved V1.1 remote backup are technically verified; see [Phase 0 report](../proofs/cartoon-foundation-phase0/REPORT.md). Saved-scene/episode Unity playback and Unity MP4 export remain open tasks. This backup does not approve any new visual behavior or change the existing animation gates.

**Cartoon Engine V1.1 (24 October 2026):** Karl visually approved the 26-second Living Room cartoon. See the [approval record](../proofs/cartoon-engine-v1-1/APPROVAL.md) and review evidence.

## Unity 2.5D Cartoon Engine V1 (24 October 2026)

**EXPERIMENTAL; TECHNICALLY VERIFIED; AWAITING KARL'S VISUAL REVIEW.** The [26-second Unity Game-camera recording and review report](../proofs/cartoon-engine-v1/REPORT.md) show Max and Maxine in the approved Living Room after a Studio scene transfer. The flattened room image cannot provide true sofa or plant occlusion; approved baselines and Portal V1 remain separate.

## Unity Bridge V1 — Max's first appearance (23 October 2026)

**EXPERIMENTAL; KARL'S LIVE EDITOR RECHECK AND VISUAL APPROVAL PENDING.** Karl's normal Editor timed out on `max.blink` after successful Connect/Ping. [The main-thread fix report and two-blink scene test](../proofs/unity-bridge-v1-fix/REPORT.md) document a passing disposable Play mode run and the still-pending normal Editor reload. The [original Max import proof](../proofs/unity-bridge-v1/REPORT.md) remains. No rigging or production renderer change is approved.

## Unity Bridge V0 (23 October 2026)

**APPROVED by Karl in the Bridge V1 authorisation.** The Studio and Unity projects contain an opt-in, loopback-only Ping/Pong bridge. See [the test and startup report](../proofs/unity-bridge-v0/REPORT.md).

## Brightling Rig V1 — Max living body (23 October 2026)

**EXPERIMENTAL; AWAITING KARL'S VISUAL DECISION.** [The Max-only standing comparison, connection close-up and report](../proofs/brightling-rig-v1/REPORT.md) are ready. The candidate is isolated from the Studio and Living World. Independent arm cutout motion failed visual inspection and is not part of the review video.


## Living World V1.2 feasibility (23 October 2026)

**BLOCKED on artwork; awaiting Karl's review of the [H.264 diagnostic](../proofs/living-world-v1-2/REPORT.md).** No physical-life renderer integration or walking-planner change.

## Living World V1.1 (23 October 2026)

**VISUALLY REJECTED by Karl; experimental code retained for comparison.**

## Living World V1 (23 October 2026)

**VISUALLY APPROVED by Karl on 23 October 2026 in the V1.1 request.** Independent deterministic room activity uses approved walking and Brightling Life V2 between directed actions. The [30-second ON episode](../proofs/living-world-v1/living-world-on-episode.mp4), [OFF comparison](../proofs/living-world-v1/living-world-off-comparison.mp4), [side-by-side review](../proofs/living-world-v1/side-by-side-off-on.mp4), [editable Backup](../proofs/living-world-v1/living-world-studio-backup.json) and [report](../proofs/living-world-v1/REPORT.md) record the approved foundation. V1.1 and permanent personality canon remain separate decisions.

## Brightling Life System V2 (23 October 2026)

**APPROVED by Karl on 23 October 2026 in the Living World V1 request.** Independent character-ID-seeded blink and subtle body channels compose with the existing walk, wave, turn and phone paths. Temporary eye-only layers leave approved sprites untouched; V1 remains selectable. The [complete 16-second H.264 MP4 episode](../proofs/brightling-life-v2/brightling-life-v2-episode.mp4), [matching MP4 scene](../proofs/brightling-life-v2/brightling-life-v2-scene.mp4), [side-by-side V1/V2 comparison](../proofs/brightling-life-v2/side-by-side-v1-v2.webm), [editable Studio Backup](../proofs/brightling-life-v2/brightling-life-v2-studio-backup.json) and [report](../proofs/brightling-life-v2/REPORT.md) record the reviewed behaviour. This approval does not extend to Living World V1 or new gaze/head artwork.

## Cartoon Life V1 (23 October 2026)

**EXPERIMENTAL; TECHNICALLY VERIFIED; AWAITING KARL'S VISUAL AND LISTENING DECISION.** An optional deterministic idle blink/breath, subtle walk anticipation/bob/settle and window ambience layer uses the shared scene renderer without changing approved artwork or actions. The [complete 18.5-second WebM episode](../proofs/cartoon-life-v1/cartoon-life-episode.webm), [off baseline](../proofs/cartoon-life-v1/baseline-scene.webm), [Studio Backup](../proofs/cartoon-life-v1/cartoon-life-studio-backup.json) and [report](../proofs/cartoon-life-v1/REPORT.md) are ready for review. 212 tests, build, disposable-browser save/reopen/export, fresh-profile Backup restore and complete FFmpeg decode passed. The approved side-walk-to-front pose cut and lack of independent gaze remain visible limits. No Cartoon Life artwork or behaviour is approved until Karl watches the episode.

## Camera System V1 (22 October 2026)

**APPROVED by Karl on 22 October 2026.** The [13-second exported camera demonstration](../proofs/camera-system-v1/camera-demo.webm) and [report](../proofs/camera-system-v1/REPORT.md) use approved Max and Maxine walk/wave frames. Karl approved adding the V1 camera system and UI for use in Scene Maker. This does not alter the Greeting V3, Batch 3 or sitting gates.

## Max and Maxine Greeting V3 diagnosis (22 October 2026)

**FOUNDATION VERIFIED; ARTWORK BLOCKED; NOT APPROVED.** Karl rejected V2. The [frame-by-frame root-cause report, stop and wave close-ups, correction brief and walk-only Scene Maker proof](../proofs/max-maxine-greeting-v3/REPORT.md) show the renderer improvement and the remaining landing pose cut. The scoped tests, full suite and build pass; a disposable-browser save/reopen and walk-only export pass. A hand-drawn art study did not match approved character style and remains outside production art. There is no full V3 greeting scene or episode export. Four illustrated landing frames and six side-wave frames are needed before completion. No later milestone has started.

## Max and Maxine Greeting V2 (22 October 2026)

**REJECTED by Karl.** Max and Maxine walk inward, stop in profile, wave toward each other using separate provisional side-wave frames, and return to side-facing idle. The [complete episode export, Scene Maker recording, backup and report](../proofs/max-maxine-greeting-v2/REPORT.md) are retained for diagnosis. Both browser exports decoded at 200 frames over approximately 8.3 seconds; 203 tests and the production build passed, but the stop and wave transitions failed visual review. No later milestone has started.

## Max and Maxine Greeting V1 (21 October 2026)

**NOT APPROVED by Karl.** The camera-facing turn looked unnatural: the walk snapped to a front-facing idle, and the Turn action squeezed that frame instead of turning a profile drawing. The approved wave frames also face forward. Its [original evidence](../proofs/max-maxine-greeting-v1/REPORT.md) is retained. Batch 3 remains disabled; sitting remains deferred.

## Frame actions batch 1 (20 October 2026)

**APPROVED by Karl on 20 October 2026.** The skeletal editor is stopped and hidden. Scene Maker offers Jump and Excited bounce using intact approved sprites and the existing shared scene renderer. The [8 second exported WebM](../proofs/frame-actions-batch1/downloads/Frame_Actions_Batch_1.webm) shows both Max and Maxine, and Max's walk/wave sequence; [screenshots and limits](../proofs/frame-actions-batch1/REPORT.md) are recorded separately. 194 tests and build passed.

## Frame actions batch 2 (20 October 2026)

**APPROVED by Karl on 20 October 2026.** Karl authorised new complete pose frames for clap, point, nod and shake head on Max and Maxine. Twelve provisional PNGs were added without changing approved originals. Scene Maker and Episode Maker use the existing timed renderer and an explicit action marker; unmarked older scenes keep their behavior. The [rendered scene video, episode video, screenshots and report](../proofs/frame-actions-batch2/REPORT.md) show both characters and disclose art consistency, outfit and frame transition limits.

## Frame actions batch 3 (21 October 2026)

**REJECTED IN ENTIRETY by Karl on 21 October 2026.** No Batch 3 action is production approved. The five [scene videos and episode export](../proofs/frame-actions-batch3/REPORT.md) demonstrate failed seat contact, abrupt transitions and unconvincing toy handling despite 197 passing tests and a production build. The [rejection audit](../proofs/frame-actions-batch3/REJECTION_AUDIT.md) includes full-video contact sheets and a historical repair proposal. Sofa seating also fails because the approved Living Room sofa is flattened into the background. Scene Maker keeps all new Batch 3 actions disabled while preserving saved review scenes. Batch 4 is closed.

**Chair and sofa sitting are DEFERRED indefinitely, not approved.** The Max Seated V2 still was accepted only as a static identity and pose reference; the later motion study failed. Keep all experimental sitting art, layered chair assets, rig studies, scripts and recordings for future reference without integrating them. No further sitting work is scheduled unless Karl explicitly requests it. Previously approved actions remain unchanged. Karl must visually review each new action before approval.

## Action Creator (20 October 2026)

AC-01 **FAILED KARL'S MANUAL VISUAL REVIEW**. Moving an arm exposed cut-out gaps and stray original artwork. Pixel and rotated-pose diagnostics identified incomplete source separation; editing and playback are disabled until a proper rig is approved, while existing saved definitions remain exportable. 193 tests and build pass, but no browser recording or renewed visual acceptance exists. AC-02 through AC-05 are not started. See the [failure audit, images and manual fail-closed check](../proofs/ac-01/REPORT.md).

## Episode 1 production acceptance (19 October 2026)

**FIRST CUT DELIVERED - FINAL ACCEPTANCE PENDING.** The complete six-scene episode was created and exported through Studio. Approved Places, Native2D characters, intro, title, credits, Bright Speak, music and a provisional Lily narration are included. Final deliverables are in [proofs/episode-1/final-production/](../proofs/episode-1/final-production/FINAL_REPORT.md): the 256 s WebM, the editable Studio Backup v8, representative frames and verification data. Karl and Astra have not judged the complete video or narrator quality; physical listening remains pending. A later revised UI export exposed a timing defect and was rejected; the 256 s first cut remains the reliable playable export.

**V2 IMPROVED CUT DELIVERED - ACCEPTANCE PENDING.** Under Karl's direct authorisation, Episode 1 V2 was produced with grounded characters, a reusable action library, Bright Speak naming, Maxine as Max's sister, Maxine's provisional `Emma` voice, and more active scene staging. Deliverables are in [proofs/episode-1/v2-production/](../proofs/episode-1/v2-production/): the 173 s WebM, editable Studio Backup v8, representative frames and the [V2 report](EPISODE1_V2_REPORT.md). 189/189 tests and production build passed; browser export produced a continuous WebM. Karl and Astra visual/listening approval remains pending.

Karl authorised sequential technical development with visual and listening acceptance deferred until the end of the current coding session. **No milestone in this batch is pre-approved.** Review each milestone individually. Technical verification and Karl's approval are recorded separately in [ROADMAP.md](ROADMAP.md) and [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Review checklist

| Milestone | Technical state | Karl's approval | Evidence | Karl should check |
| --- | --- | --- | --- | --- |
| F2 — MP3 and OGG | Implemented | **AWAITING KARL'S REVIEW** | [F2 report](../proofs/f2/REPORT.md) | Listen to the episode recording and try an MP3 and OGG in his own browser. |
| F3 — Documentation | Implemented | **AWAITING KARL'S REVIEW** | [F3 report](../proofs/f3/REPORT.md) | Confirm the guide is understandable and matches the Studio. |
| F4 — Backup reliability | Implemented | **AWAITING KARL'S REVIEW** | [F4 report](../proofs/f4/REPORT.md) | Review recovery behaviour after interrupted restore. |
| M6.4 — Dialogue and narration | Implemented | **AWAITING KARL'S REVIEW** | [M6.4 report](../proofs/m6-4/REPORT.md) | Listen to the recorded episode; check attribution and speech timing. |
| M6.5 — Intro Maker | Implemented | **AWAITING KARL'S REVIEW** | [M6.5 report](../proofs/m6-5/REPORT.md) | Check titles, styles and animation; listen to the intro recording. |
| M6.6 — Credits Maker | Implemented | **AWAITING KARL'S REVIEW** | [M6.6 report](../proofs/m6-6/REPORT.md) | Check credit readability, scrolling and the unsaved warning. |
| M6.6A — Music & sound studio | Implemented | **AWAITING KARL'S REVIEW** | [M6.6A report](../proofs/m6-6a/REPORT.md) | Listen to the instruments, effects and a rendered song. |
| M6.6B — Music Studio UI redesign | Implemented; song byte equality unresolved | **AWAITING KARL'S REVIEW** | [M6.6B report](../proofs/m6-6b/REPORT.md) | Compare dark/light screenshots, check the note editor and listen to the rendered song/effect. |
| UI Package A — Music Studio polish | Implemented; technical checks passed | **AWAITING KARL'S REVIEW** | [Package A report](../proofs/ui-package-a/REPORT.md) | Check the wide editor, collapse and note editing; listen to playback. |
| UI Package B — Global themes | Implemented; technical checks passed | **AWAITING KARL'S REVIEW** | [Package B report](../proofs/ui-package-b/REPORT.md) | Review all sections in Dark and Light and the shared appearance control. |
| Beginner Note Preview | Implemented; technical checks passed | **AWAITING KARL'S SPEAKER REVIEW** | [Note Preview report](../proofs/note-preview/REPORT.md) | Hear C4, switch instruments, add and drag notes, then check the preview volume and feel. |
| Voice Maker V1 | Implemented; technical checks passed | **AWAITING KARL'S MICROPHONE/SPEAKER REVIEW** | [Voice Maker report](../proofs/voice-maker/REPORT.md) | Record a voice, compare original/effects, listen to generated speech and the rendered scene in both themes. |
| Voice Maker V1.1 — automatic voice service | Implemented; technical checks passed | **AWAITING KARL'S REVIEW** | [V1.1 report](../proofs/voice-maker-v1-1/REPORT.md) | Open BrightTales normally, go to Voice Maker, confirm the engine says Ready without any second terminal, then generate a line and record his own voice. |
| Max Phone Interaction V1.2 | **Complete; technical checks passed** | **HUMAN VISUAL ACCEPTANCE PASSED** — Karl approved holding, tapping and overall appearance on 18 October 2026. Physical audio hardware check pending. | [Completion report](../proofs/max-phone-v1-2/COMPLETION.md), [video](../proofs/max-phone-v1-2/max-asks-for-food-v1-2.webm) | No further visual action. Listen through physical speakers when convenient. |
| Max's Phone & Bright Speak V1 | Implemented; technical checks passed | **AWAITING KARL'S REVIEW** | [Phone report](../proofs/max-phone-v1/REPORT.md) | Watch the Max phone scene video: does the phone look held in his hand, is the pop-up clear, and does the device speaking read as Max communicating rather than talking? |
| M6.7 — Episode assembly | Implemented | **AWAITING KARL'S REVIEW** | [Final production report](../proofs/episode-1/final-production/FINAL_REPORT.md) | Check the assembled production plays as one continuous piece. |
| M6.7 V2 — Episode improvements | Implemented | **AWAITING KARL AND ASTRA'S REVIEW** | [V2 report](../proofs/episode-1/v2-production/EPISODE1_V2_REPORT.md) | Check grounding, character movement, Bright Speak explanation, Maxine as sister and Maxine's voice. |

## Max Phone Interaction V1.2 completion

Six whole-body phone frames are integrated for standing Max in his original hoodie with a left-hand hold. Karl reviewed the exported [V1.2 acceptance video](../proofs/max-phone-v1-2/max-asks-for-food-v1-2.webm) and marked the holding pose, tapping animation and overall appearance **PASSED**. [Holding](../proofs/max-phone-v1-2/holding-closeup.png) and [tapping](../proofs/max-phone-v1-2/tapping-closeup.png) closeups remain as evidence. The device voice is encoded and attributed to no Brightling; physical speaker/listening verification remains **PENDING**. [Technical report](../proofs/max-phone-v1-2/COMPLETION.md).

## Max Phone Native2D cut-out rig — built, proven, blocked

- **Built:** `scripts/build_max_rig.py` bakes approved `max-0.png` into 8 parts (torso, sleeves, hands, shoulder caps, head) plus `rig.json` with pivots, into `public/art/rig/max/`. Cut paths are explicitly authored anatomical polygons; head and hands use exact mask components. Approved PNGs are unmodified.
- **Proven:** the rest pose reconstructs the approved frame exactly (pixel diff is anti-aliasing only), arms rotate, hands stay attached after fixing their pivot, and phone-height poses are reachable by solved angles (+70.7 deg holding, -78.5 deg tapping). Waving needs no rig — approved wave frames swap in cleanly.
- **Blocked and reported, per Karl's gate:** raising an arm exposes empty armpit space, slices the hoodie star and tears the hood junction, because the artwork has no pixels behind the arms. Arms-behind-torso was tried and is worse. The rig is **not wired into the app**, `src/` is unchanged, and nothing is marked visually approved.
- **Unblock:** one additive "arms-removed torso" fill layer (new pixels only, no approved pixel changed), and optionally the pointing-hand asset.
- **Tests:** 184/184 and the production build pass; the app is unaffected. Close-up evidence of shoulders, hands and the star is in `proofs/max-phone-v1-3/`.

## Max Phone Interaction V1.2 — first attempt (historical)

The notes below describe the earlier blocked attempt. The completion above supersedes its artwork decision request.

- **Delivered and verified:** the Bright Speak pop-up is larger (235→348 px), nearer Max and the device (gap 130→42 px), with larger text (~24→~34 px) and a larger symbol (~64→~92 px). It is provably clear of the face and inside the frame at every position, asserted in tests. Message, device speech timing and fades are unchanged.
- **Blocked, and why:** the holding/tapping animation. The approved artwork has no holding or tapping pose (idle, five walk, three wave, per outfit; the sheets contain only those already extracted), the character pipeline only recolours existing frames, and the sibling Native2D repository holds a **different Max** — a pale-skinned, brown-haired, blue-hoodied 3D character whose own critique states it is "not recognisably Max". Posing that rig would redesign Karl's approved character, so nothing was changed there. Scripted arm re-posing in this repository was attempted three times and rejected as visibly unconvincing — the rejected frames are archived as evidence rather than shipped.
- **Specification:** three full-body 434×724 frames named `max-phone-hold.png`, `max-phone-tap-raise.png` and `max-phone-tap-touch.png`, described in the report. The renderer, timing, continuity, audio, export and Backup v8 are already ready to accept them.
- **Tests:** 184/184, 11/11 service tests, production build, and the full acceptance re-run with zero console errors all pass.
- **Karl's decision needed:** artwork route for the three frames — see the accompanying question. **Visual acceptance is not claimed.**

## Max's Phone & Bright Speak V1

- **Implementation:** Max can take out a phone, hold it, tap it and show a Bright Speak communication pop-up with a symbol and message while the **phone** speaks the line. Max stays non-verbal and nothing animates his mouth. The phone voice is chosen from saved Audio Library speech (generate it in Voice Maker first), starts a fraction after the tap, and carries no speaker attribution so it is never presented as Max's own voice. Scenes can start with the phone already in hand, so a held phone survives a shot change. Authored from the Scene Maker's **Phone & Bright Speak** director panel with sensible defaults; included in scene video export.
- **Scope honesty:** Brightlings in this project are whole-body sprite frames, not a rig, so this is a composited prop anchored at hand positions measured from the approved frames. Arms do not animate, and no new artwork was generated. The Native2D rig and Director named in the brief live in the sibling `BrightTales` repo, which is outside this project's working rules.
- **Changed files:** `src/phone.ts`, `src/phoneArt.ts`, `src/phone.test.ts`, `src/scenePreview.ts`, `src/timedScenes.ts`, `src/SceneMaker.tsx`, `src/studioBackup.test.ts`, `src/style.css`, documentation and `proofs/max-phone-v1/`.
- **Also fixed:** the Scene Maker kept a duplicate copy of the scene drawing loop, so the editor preview could not show what the exporter rendered. It now calls the shared `drawScenePreview` and adds only its selection ring.
- **Tests:** 183/183 across 23 files, 11/11 service lifecycle tests, 5/5 Python audio tests and the production build passed. The earlier Voice Maker flow and the ten-section regression smoke still pass with zero console errors.
- **Browser evidence:** [report, stage frames, exported WebM and decoded video frames](../proofs/max-phone-v1/REPORT.md).
- **Limits:** no arm/hand animation or "look at phone" pose until new artwork is approved; the far hand in one walking frame has no visible artwork so the phone is not drawn there; phone interactions are not yet on timeline lanes; one phone per Brightling at a time; the acceptance scene uses the Living Room because no kitchen background is approved.
- **Karl's check:** watch `proofs/max-phone-v1/max-asks-for-food.webm` and judge the phone against Max's hand and the pop-up's readability; then build a two-scene sequence and use "Start this shot with the phone already in hand" to check the continuity feels natural.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## Voice Maker V1.1 — automatic voice service management

- **Implementation:** The manual `py -3.12 voice_local.py` step is gone. `scripts/studio.cjs` is now the single launcher for both `npm run dev` and `npm start`, serves the app, and owns `scripts/voice-lifecycle.cjs`, which adopts an already-running compatible service or starts `voice_local.py` as its own child, polls a versioned health endpoint for real readiness, recovers from crashes within a bounded budget, offers Retry, and stops only the child it owns through a per-launch owner token. Voice Maker shows Starting, Ready, Unavailable and Error with a plain-English reason and a Retry button. Existing Voice Maker V1 features, Music Studio, scenes, saved projects and Backup v8 are unchanged.
- **Changed files:** `scripts/studio.cjs`, `scripts/voice-lifecycle.cjs`, `voice_local.py`, `src/VoiceMaker.tsx`, `src/voiceApi.ts`, `test_voice_service.cjs` (new), `package.json`, `vite.config.ts`, documentation and `proofs/voice-maker-v1-1/`.
- **Tests:** 156/156 frontend tests, 11/11 new service lifecycle tests, production build and the existing Python audio tests passed. Isolated Chrome ran the full Voice Maker workflow — Ready with no manual step, real Piper speech, effect edit, save, a 2.46 s microphone recording, its edited save and reload persistence — against both the production and development launches with zero console errors, and showed a plain error plus Retry when the interpreter was deliberately broken. Duplicate launch, a killed service, port fallback and cross-origin refusal were checked live.
- **Defects fixed in verification:** a second launcher could start a duplicate service on the same port while the owner restarted; a single slow health answer could be misread as a crash and wrongly report "stopped repeatedly"; stale messages still told users to start `voice_local.py`.
- **Browser evidence:** [V1.1 report, screenshots and results](../proofs/voice-maker-v1-1/REPORT.md).
- **Limits:** Python, FFmpeg and the voice models are not bundled, so a clean machine reports the missing dependency and a Retry button while the rest of the Studio keeps working. Ctrl+C shutdown is covered by automated manager tests rather than a real Ctrl+C. Two open windows share one service. Music Studio's starter-tune panel did not appear in a fresh automated profile, so a full browser music render was not re-verified (the audio code is unchanged and its tests pass).
- **Karl's check:** Open BrightTales the normal way, go to Voice Maker, watch it reach Ready with no PowerShell window, generate a line, record his own voice, edit and save it, then close and reopen BrightTales and do it again.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## F2 — real MP3 and OGG compatibility

- **Implementation:** No production code change. Tested genuine FFmpeg-encoded MP3, OGG/Vorbis and OGG/Opus in disposable Chrome profiles.
- **Changed files:** F2 evidence under `proofs/f2/`; roadmap/status and evidence ignore rules in `.gitignore`.
- **Tests:** 65/65 Vitest tests and production build passed. Chrome 155 imported/previews all five samples, retained them in IndexedDB, played scheduled scene and episode sounds and restored them through Studio Backup in a second empty profile. Zero console errors and failed assets; both profiles removed.
- **Browser evidence:** [Screenshots, captured playback with sound and observations](../proofs/f2/REPORT.md).
- **Limits:** Physical speaker playback and other browsers unverified. F4 still needs cross-store crash recovery.
- **Karl's check:** Listen to [the recorded episode](../proofs/f2/episode-with-audio.mp4) and try representative MP3/OGG files on his machine.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## F3 — documentation

- **Implementation:** Audited current source, updated README and continuity instructions, and added a [Studio user guide](USER_GUIDE.md).
- **Changed files:** `README.md`, `AGENTS.md`, `docs/ROADMAP.md`, `docs/PROJECT_STATUS.md`, `docs/BATCH_REVIEW.md`, `docs/USER_GUIDE.md`, and `proofs/f3/`.
- **Tests:** 46 local documentation links valid; 65/65 tests and production build passed. Isolated Chrome opened all six sections with no console or asset errors and no saved data; the disposable profile was removed.
- **Browser evidence:** [Screenshot and observations](../proofs/f3/REPORT.md).
- **Limits:** Navigation smoke does not re-accept every editor workflow.
- **Karl's check:** Read the user guide as a new user and flag any unclear or inaccurate instruction.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## F4 — backup reliability

- **Implementation:** Audio replacement and its old-library snapshot now commit atomically in IndexedDB. A localStorage marker coordinates recovery before the app mounts; pending restores roll back and committed restores finish cleanup.
- **Changed files:** `src/audioStore.ts`, `src/restoreCoordinator.ts`, `src/studioBackup.ts`, `src/App.tsx`, `src/main.tsx`, `src/restoreCoordinator.test.ts`, documentation and `proofs/f4/`.
- **Tests:** Full suite and build passed. Isolated Chrome recovered after three interruption points with real MP3/OGG assets and episode references. A normal Studio Backup UI export and fresh-profile restore passed with five real audio assets; zero console/asset errors.
- **Browser evidence:** [F4 report, screenshot and recordings](../proofs/f4/REPORT.md).
- **Limits:** Browser reload simulates interruption; hardware power loss and persistent storage failure remain outside the test. The audio snapshot temporarily needs additional quota.
- **Karl's check:** Review the restored library and episode, and confirm the failure message is clear if storage cannot recover.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## M6.6B — Music Studio UI redesign

- **Implementation:** Dark and light themes scoped to Music Studio, with dark as the default and a locally saved preference; illustrated inline SVG instrument/effect cards, three piano-roll zoom levels, named drum rows, styled overlays/forms/scrollbars/tooltips, large transport and replacement confirmation. The M6.6A synthesis and saved-song/Backup v8 formats were preserved. Beat Blocks remain deferred to M7.0; M6.7 was not started.
- **Tests:** 147/147 Vitest tests and production build passed. Isolated Chrome checked song/effect editing and previews, Audio Library export/replay, both themes, focus and reduced motion, narrow layout and a fresh-profile Backup v8 restore with zero console/asset errors.
- **Audio boundary:** The effect rendered byte-identically before/after. The song failed the requested SHA-256 equality check; 278/1,023,120 PCM samples differed by one 16-bit step, and two runs of the redesigned build also differed. No audio engine code was changed. See [comparison and screenshots](../proofs/m6-6b/REPORT.md).
- **Karl's check:** Review the [dark piano roll](../proofs/m6-6b/05-note-added-dark.png), [dark drum roll](../proofs/m6-6b/03-drum-track-dark.png), [light piano roll](../proofs/m6-6b/14b-roll-light.png), [light effects](../proofs/m6-6b/13-effects-light.png) and the full M6.6B report. Visual and listening acceptance is pending.

## M6.6A — Music & Sound Effects Studio

- **Implementation:** New **Music Studio** extending the Audio Library. A multi-track piano roll (click to add, drag to move, drag the edge to resize, delete) with eight locally synthesised instruments, tempo, bars, looping, master volume, per-track volume/pan/mute/solo, and a soft limiter that is transparent below a 0.7 threshold. Seven sound-effect presets built from oscillators, deterministic noise and envelopes, with pitch, length, volume, decay and a noise toggle. Beginner starter melodies and drum patterns. Finished songs and effects render to 16-bit PCM WAV and become ordinary Audio Library assets.
- **Architecture:** No new playback engine. Rendered audio is a standard `AudioAsset` played by the existing clock in scenes, episodes, intros and credits; the in-studio preview plays the same rendered bytes through an `HTMLAudioElement`. Rendering uses `OfflineAudioContext` at a fixed sample rate with a seeded noise source, so the future video exporter can re-render identical audio. Everything is local and offline.
- **Backup change:** Studio Backup is now **version 8** with editable music projects; versions 1–7 remain readable and restoring an older backup keeps existing projects rather than clearing them. The F4 restore journal is extended to version 7.
- **Changed files:** `src/wav.ts`, `src/instruments.ts`, `src/musicProject.ts`, `src/musicRender.ts`, `src/musicAssets.ts`, `src/MusicStudio.tsx`, `src/previewPlayer.tsx`, `src/studioBackup.ts`, `src/App.tsx`, `src/musicProject.test.ts`, `src/style.css`, `.gitignore`, documentation and `proofs/m6-6a/`.
- **Tests:** 147/147 across 18 files (32 new) and production build passed; 80 doc links valid. Isolated Chrome created an original three-instrument song (Piano 7 notes, Bass 9 notes, Drums 4 notes) and a custom effect through the real UI, with real captured browser audio at mean ≈ −31 dB / peak ≈ −8 dB both in-studio and through the existing Audio Library. Mixer mute/solo, save/reload/edit and a v8 backup round-trip into an empty profile all passed, and the restored song replayed audibly. Piano roll drawing was verified by reading canvas pixels. Zero console/asset errors; both profiles removed; exit code 0.
- **Defects fixed in verification:** drum notes were drawn outside the visible pitch range so drum tracks always looked empty (range now starts at MIDI 36 and the roll auto-scrolls); the auto-scroll then needed the note count as a dependency; the soft limiter was boosting quiet mixes ~31% (now transparent below threshold, with a test); and the studio layout clashed with existing Scene Maker styles.
- **Limits:** imported/previously rendered audio cannot be layered inside the studio — the mixer mixes the project's own instrument tracks (combining generated and imported audio with trim and fades is done via the existing Audio Panel in scenes, intros, episodes and credits). Instruments are synthesised approximations, not samples. Generated WAVs are uncompressed (~1.9 MB for 11.2s stereo). Capped at 12 tracks, 64 bars, 2000 notes per track; the roll shows MIDI 36–84; no per-track meters or loop-region selection.
- **Karl's check:** Build a song from the starters, listen to all eight instruments and the effect presets, mix two tracks, then render and place the result in a scene, intro or credits. Confirm the instruments and effects sound acceptable as cartoon music and sound.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## M6.6 — credits maker

- **Implementation:** New **Credits** Studio section producing reusable end credits: add/edit/delete/reorder credit lines with optional headings and roles, one-tap heading suggestions, Static or Scrolling presentation, adjustable duration and scroll speed, automatic slowing so the last credit always ends on stage, a place background, Audio Library music, preview, save/reopen/duplicate/delete, and unsaved-edit protection. Credits are presented through the same scene renderer and audio clock as scenes and intros, so the app still has one animation engine.
- **Backup change:** Studio Backup is now **version 7** with a `credits` field; versions 1–6 remain readable, and restoring an older backup keeps existing credits rather than clearing them. The F4 restore journal is extended to version 6, and the restore confirmation now reports credits and intros.
- **Changed files:** `src/credits.ts`, `src/CreditsMaker.tsx`, `src/scenePreview.ts`, `src/studioBackup.ts`, `src/App.tsx`, `src/Characters.tsx`, `src/credits.test.ts`, `src/style.css`, `.gitignore`, documentation and `proofs/m6-6/`.
- **Tests:** 112/112 across 17 files and production build passed. Isolated Chrome verified four credit lines built through the UI, reorder, credits music on the credits clock, static and scrolling playback each with one active player and captured sound at mean −28.6 dB / max ≈ −12 dB, visible upward scroll between 2.5s and 5.5s, save/reload retention, the unsaved-edit guard, and a v7 backup round-trip into an empty profile. Zero console/asset errors; both profiles removed.
- **Defect fixed in verification:** the layout counted one row per credit line while the renderer draws a heading and a name row, so long credits scrolled with wrong timing maths. Row counting now matches the renderer.
- **Browser evidence:** [M6.6 report, screenshots and recordings](../proofs/m6-6/REPORT.md).
- **Limits:** Text only — no fonts, per-line colours, logos, images or line animations. Uniform scroll speed with no easing. Line height shrinks automatically on very long lists. Credits show no Brightlings and are not yet attached to an episode.
- **Karl's check:** Create credits, try Static and Scrolling, and listen to [the recorded credits](../proofs/m6-6/scroll-credits.mp4). Confirm text size and readability over the artwork, that the heading suggestions cover what he wants, and that the unsaved-changes warning feels right rather than annoying.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## M6.5 — intro maker

- **Implementation:** New **Intros** Studio section producing reusable opening titles: series and episode titles, Plain or Banner style, an approved place background, Brightling entrance actions on the existing visual timeline, Audio Library music, preview, save, duplicate/delete and stable-ID reuse. An intro is modelled as a timed scene plus title text, so it reuses the existing animation engine, Canvas renderer, audio lanes and playback clock instead of adding a parallel engine. Approved artwork and animation timing were not modified.
- **Backup change:** Studio Backup is now **version 6** with an `intros` field; versions 1–5 remain readable, and restoring an older backup keeps existing intros rather than clearing them. The F4 restore journal was extended to version 5 so an interrupted intro restore rolls back with everything else.
- **Changed files:** `src/introductions.ts`, `src/IntroMaker.tsx`, `src/scenePreview.ts`, `src/studioBackup.ts`, `src/App.tsx`, `src/introductions.test.ts`, `src/style.css`, `.gitignore`, documentation and `proofs/m6-5/`.
- **Tests:** 89/89 across 16 files and production build passed. Isolated Chrome verified titles and Banner rendering, both Brightlings with a Wave action, music scheduling, four playback samples with one active player until the 7.36s music ended, captured sound at mean −29.7 dB / max −12.1 dB, reload retention, and a v6 backup round-trip into an empty profile. Zero console/asset errors; both profiles removed.
- **Defect fixed in verification:** titles originally faded in from zero opacity, so a saved intro opened on a blank stage. Titles are now visible from the first frame and only ease out at the end.
- **Browser evidence:** [M6.5 report, screenshots and recording](../proofs/m6-5/REPORT.md).
- **Limits:** Titles are plain canvas text — no fonts, letter animation, logos or per-line styling. No lip-sync. The intro action palette omits Disappear, so a character cannot walk off during an intro. Length capped at 600s, titles at 120 characters. No per-intro outfit override.
- **Karl's check:** Create an intro, try both title styles, and listen to [the recorded intro](../proofs/m6-5/intro-playback.mp4). Confirm the titles are the right size and position over the Living Room, and that the action choices are enough.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## M6.4 — dialogue and narration

- **Implementation:** Speech & narration became a first-class Audio Library type reusing the existing asset, clip, timeline, playback and backup path. Clips carry an optional speaker (`narrator`, `max`, `maxine` or a `brightling-<uuid>`), gained a Voices lane and speaker selector, and use a speech-aware default volume. A voice clip running past its scene or episode end is warned about, rejected on save and clamped at scene boundaries, so dialogue is never silently truncated. Characters without a clip stay silent and unaffected; no sprite, animation timing or AI voice was introduced.
- **Changed files:** `src/audio.ts`, `src/AudioLibrary.tsx`, `src/AudioPanel.tsx`, `src/episodes.ts`, `src/EpisodeMaker.tsx`, `src/SceneMaker.tsx`, `src/App.tsx`, `src/studioBackup.ts`, `src/audio.test.ts`, `src/studioBackup.test.ts`, `src/style.css`, documentation and `proofs/m6-4/`.
- **Tests:** 74/74 across 15 files and production build passed. Independently re-run in isolated Chrome against the production build: two genuine WAV voice fixtures imported, Max dialogue trimmed and placed in a scene, episode narration spanning both scenes, four playback samples each with exactly one active player and zero at the 12.0s end, captured speech at mean −24.5 dB / max −5.9 dB over 13.56s, reload retention, and Studio Backup v5 round-trip into an empty profile preserving both attributions. Zero console and asset errors; both profiles removed.
- **Browser evidence:** [M6.4 report, screenshots and recording](../proofs/m6-4/REPORT.md).
- **Limits:** Attribution is metadata only — no lip-sync or talking animation. Character speech must sit inside one scene; cross-scene character speech needs an episode-level clip. No in-app recording, text-to-speech or voice cleanup. Browser reload simulates interruption; subjective audio quality is unverified.
- **Karl's check:** Import a real recorded voice as Speech & narration, attribute it to a Brightling and to the Narrator, then listen to [the recorded episode](../proofs/m6-4/dialogue-episode.mp4) for timing, trim and volume over music.
- **Approval status:** **AWAITING KARL'S REVIEW**.
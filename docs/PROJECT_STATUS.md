# BrightTales Project Status

**Current (25 October 2026):** Karl gave final approval to Studio 3.1 at `b2218a8`; it was merged and pushed to `main` at `1d9d1068f9258f8bbeac0b049f3fb8afe9422518`. The approved editor, Classic compatibility and Bright Speak per-clip text are the frozen baseline. Isolated P3 Studio and Unity branches now have technically verified local scene-audio transfer and Unity clock playback; see [P3 proof](../proofs/cartoon-foundation-p3/REPORT.md). P3 is not merged or visually/listening approved. Cross-scene episode music remains for the P4 playback seam. Older status entries below are historical.

**Studio 3.1 Bright Speak message amendment — TECHNICALLY VERIFIED; FINAL KARL FREEZE APPROVAL PENDING (25 October 2026).** Karl approved the core direct-animation workflow at `ae859ef`. The isolated branch now adds per-action free text to Communicate Message through the existing contextual Inspector and shows Bright Speak blocks on the timeline. Text-only playback, two distinct messages, save/close/reopen/edit/replay and Classic playback passed in a disposable browser; Studio 295/295, voice-service 11/11 and build passed. See [amendment proof](../proofs/studio-3.1/bright-speak-amendment/REPORT.md). Do not merge, freeze or begin P3 before Karl's final decision.

**Studio 3.1 Direct Animation core — VISUALLY APPROVED BY KARL (25 October 2026).** Studio 3.0 has since been merged into `main` (baseline `35b8692`); the Studio 3.1 work is isolated on `studio-3.1-direct-animation`. The editor opens directly and uses the existing Canvas, timed scene model, Inspector and timeline for mouse placement, Walk destination, playhead Wave insertion, clip editing, playback and save/reopen. The [core Studio 3.1 report](../proofs/studio-3.1/REPORT.md) records its browser, tests, walkthrough and Unity proof. This approval does not freeze the subsequent Bright Speak amendment, merge main or start P3.

**Studio 3.0 experimental branch — TECHNICALLY VERIFIED; KARL'S VISUAL REVIEW PENDING (24 October 2026).** `studio-3-experimental` extends the verified Phase 2 Studio checkpoint with a default professional shell, saved workspace preference, reflowed existing Cartoon Editor, protected Classic layout and optional Unity status. The same App state, scene, audio and episode stores, Backup v8 and Phase 2 bridge remain in use. See [Studio 3.0 report](../proofs/studio-3/REPORT.md). No visual approval, main merge or approved-baseline change is implied.

**Cartoon foundation Phase 2 — TECHNICALLY VERIFIED; KARL'S VISUAL REVIEW PENDING (24 October 2026).** In isolated Phase 2 worktrees, Look At, gentle walking, Calm Life v2, Camera V1 transfer and Scene Maker layout passed a fresh disposable-browser create/save/reopen/edit/send and two Unity Play Mode runs with reset/replay. The interactive test exposed and fixed Unity rejection of ordinary `motion: "linear"` actions. Unity browser-driven Play Mode passed 1/1; Studio 290/290 and build passed; browser scene WebM and the 28.083-second Unity review composite fully decoded. [Phase 2 report](../proofs/cartoon-foundation-phase2/REPORT.md). This is technical evidence, not visual approval or an in-app Unity exporter.

**Cartoon production foundation Phase 1 — TECHNICALLY COMPLETE; KARL'S VISUAL REVIEW PENDING (24 October 2026).** A disposable Chrome profile created, saved, reopened, edited and transferred a real Scene Maker scene through the UI. Isolated Unity loaded the matching scene ID and content revision, played Max and Maxine, reset, and replayed consistently. The 22-second review MP4 combines real browser screenshots with both continuous Unity Game-camera captures. Studio 288/288 tests and build passed; Unity focused and browser-driven Play mode tests passed 1/1 each; the existing scene WebM export decoded. See [Phase 1 report](../proofs/cartoon-foundation-phase1/REPORT.md). Camera, audio, episodes and Unity MP4 export remain outside Phase 1. No visual approval is implied.

**Cartoon production foundation Phase 0 — AUDITED AND REMOTELY BACKED UP (24 October 2026).** The approved Studio and Unity V1.1 commits are pushed to their respective GitHub repositories; Unity is private and all 137 tracked LFS objects were reported available for download. The general saved-scene, audio, episode and Unity MP4 workflow is still unimplemented. See [the source audit](CARTOON_FOUNDATION_AUDIT.md), [Phase 0 proof](../proofs/cartoon-foundation-phase0/REPORT.md), and [takeover tasks](../TODO.md). No new visual approval is implied.

**BrightTales x Unity Cartoon Engine V1.1 - APPROVED BY KARL (24 October 2026).** The separate 26-second Living Room scene and Studio bridge workflow are frozen for recovery. See [approval and review evidence](../proofs/cartoon-engine-v1-1/APPROVAL.md). The V1 baseline and earlier approved checkpoints remain unchanged; production renderer integration remains separate.

**BrightTales x Unity 2.5D Cartoon Engine V1 - EXPERIMENTAL; TECHNICALLY VERIFIED; AWAITING KARL'S VISUAL REVIEW (24 October 2026).** The opt-in Unity Connection panel loaded and played a 26-second Max/Maxine Living Room scene in an isolated Unity copy. [The review report and continuous Game-camera recording](../proofs/cartoon-engine-v1/REPORT.md) document the result and the flattened-room occlusion limit. Approved Director Controls V2 and Character Acting V1/V1.1 checkpoints remain protected. Portal V1 was not modified. No production renderer integration or approval is implied.

**BrightTales × Unity Bridge V1 — EXPERIMENTAL; MAIN-THREAD FIX TESTED IN A DISPOSABLE PLAY MODE SCENE; KARL'S LIVE EDITOR RECHECK PENDING (23 October 2026).** Karl found that his open Unity Editor answered Connect/Ping but timed out on Blink Max. The receiver now runs when Studio has focus and checks its `Update()` heartbeat before reporting ready. [The fix report, two-blink MP4 and scene test](../proofs/unity-bridge-v1-fix/REPORT.md) show the updated source working in `MaxBridgeDemo`; the normal Editor had not reloaded the code during that test. The original [V1 artwork and import proof](../proofs/unity-bridge-v1/REPORT.md) remains. No renderer migration or new character action is approved.

**BrightTales × Unity Bridge V0 — APPROVED by Karl in the Bridge V1 authorisation (23 October 2026).** The local-only Unity 6.6 Play mode HTTP receiver and opt-in Studio Connection tab provide the Connect/Ping/Pong proof. [Bridge V0 report](../proofs/unity-bridge-v0/REPORT.md).

**Brightling Rig V1 — EXPERIMENTAL MAX-ONLY STANDING REVIEW; AWAITING KARL (23 October 2026).** An isolated [18-second H.264 comparison, connection close-up and report](../proofs/brightling-rig-v1/REPORT.md) test layered chest, upper-body, head and blink motion using the approved Max source. Neutral visible pixels reconstruct exactly; a separate arm-cutout attempt was rejected after seams appeared. No Maxine work, Living World integration, approved-action change or commit was made.


**Living World V1.2 — FEASIBILITY BLOCKED (23 October 2026).** Karl rejected V1.1's visual result. [The 18-second H.264 diagnostic and report](../proofs/living-world-v1-2/REPORT.md) show why current Max/Maxine layers cannot support clean physical-life motion. Nothing was integrated and the walking planner was not changed.

**Living World V1.1 — VISUALLY REJECTED by Karl (23 October 2026); experimental code retained for comparison.**

**Living World V1 — VISUALLY APPROVED by Karl on 23 October 2026 in the V1.1 request.** The Living Room-only opt-in controller adds independent scene-time-seeded pauses, safe approved walks and occasional approaches beneath director actions and Brightling Life V2. [The complete 30-second H.264 ON episode, OFF comparison, side-by-side review, editable scenes, Backup and report](../proofs/living-world-v1/REPORT.md) record the approved foundation. V1.1 and permanent personality canon have separate gates.

**Brightling Life System V2 — APPROVED by Karl on 23 October 2026.** Karl approved the preceding life work in the Living World V1 request. A per-character controller adds independently timed blink and restrained breathing over compatible approved actions. Eye-only Canvas layers leave source art untouched; V1 remains available. The [complete 16-second episode, V1/V2 comparison, editable Backup and report](../proofs/brightling-life-v2/REPORT.md) record the approved behaviour. This does not approve new head or eye gaze artwork, Greeting V3, sitting or Living World V1.

**Cartoon Life V1 — EXPERIMENTAL; TECHNICALLY VERIFIED; AWAITING KARL'S VISUAL/LISTENING DECISION (23 October 2026).** An optional scene layer adds sparse blink, restrained idle and walk motion and Living Room window ambience without editing approved sprites or changing approved action timings. A [complete 18.5-second episode, off baseline, editable Studio Backup and report](../proofs/cartoon-life-v1/REPORT.md) are ready for Karl. 212 tests, production build, disposable-browser save/reopen/export, fresh-profile Backup restore and full media decode passed. The walk-to-front cut and lack of independent eye gaze remain visible limits. No Cartoon Life behaviour or blink artwork is approved yet.

**Camera System V1 — APPROVED by Karl on 22 October 2026.** Scene Maker has Wide, Medium and Close-Up camera keyframes, a Camera timeline lane, focus on Max, Maxine, all Brightlings or a custom point, optional follow, and adjustable smooth pan/zoom transitions. The shared Canvas renderer carries camera motion through scene and episode preview/export. Karl approved adding the [13-second demonstration's camera system and UI](../proofs/camera-system-v1/REPORT.md) for use in the Studio. This approval does not change Greeting V3, rejected Batch 3 or deferred sitting. Camera V2 and introduction rebuilding have not started.

**Project:** BrightTales — Animated 2D Children's Series  
**Studio:** BrightSenAppsTales  
**Current Gate:** Greeting V1 and V2 rejected; V3 renderer foundation verified but landing and side-wave artwork blocked. V3 has no visual approval. Batch 3 remains rejected and disabled; chair and sofa sitting remain deferred indefinitely.
**Last Updated:** 2026-10-23

**BrightTales introduction V1 — COMPLETE REVIEW CUT; NOT APPROVED.** Karl separately authorised a first cartoon using existing approved content. A 56-second silent six-scene [video, editable Studio Backup and production report](../proofs/brighttales-introduction-v1/REPORT.md) now await his visual review. No new character art or animation actions were added. Greeting V3 remains blocked; Batch 3 and sitting remain excluded. The intro/title and credits makers and generated audio were omitted because their approval gates remain open.

**BrightTales introduction V2 — COMPLETE NARRATED REVIEW CUT; AWAITING KARL'S WATCH/LISTEN APPROVAL.** Karl liked V1's visuals and requested a voiced episode. The [84-second exported video, editable Backup, eleven narrator WAVs and verification report](../proofs/brighttales-introduction-v2/REPORT.md) retain its approved artwork and scene path. Real local Voice Maker speech plays in Episode Maker and is encoded in the WebM; no music asset was used without content approval. V2 has not been approved or published. Greeting V3, rejected Batch 3 and deferred sitting remain unchanged.

## Stopped skeletal editor

Karl stopped the skeletal Action Creator on 20 October 2026. Its navigation entry is hidden; saved local definitions were left intact. No cut-out repair or AC-02 work continues. The separate frame-action batch below uses the existing Scene Maker renderer.

## Frame actions batch 1

Jump and excited bounce now appear in Scene Maker and on its timeline. An 8 s browser-exported scene shows Max and Maxine using the approved whole-body frames, with walk and wave in the same Max sequence. The new actions use a foot pivot for landings and return to idle. 194/194 tests and build pass. [Rendered video and report](../proofs/frame-actions-batch1/REPORT.md). **Karl officially approved Batch 1 on 20 October 2026.**

## Frame actions batch 2

Karl authorised provisional whole-body artwork for clap, point, nod and shake head. Twelve additive pose PNGs for Max and Maxine's original outfits now play through the existing Scene Maker and episode renderer. The [scene and episode videos, sampled frames and limitations](../proofs/frame-actions-batch2/REPORT.md) remain available. The approved originals remain unchanged. **Karl approved Batch 2 on 20 October 2026.**

## Frame actions batch 3

**REJECTED by Karl on 21 October 2026 in entirety.** Sit down, stand up, pick up toy and put down toy exist as provisional complete frames in the shared renderer, but the [full rendered sequences](../proofs/frame-actions-batch3/REPORT.md) fail visual acceptance for seating, hand contact and transitions. The [rejection audit](../proofs/frame-actions-batch3/REJECTION_AUDIT.md) identifies mismatched frame registration, insufficient poses, a one-layer chair, approximate prop offsets and a flattened Living Room sofa. The prior 197 passing tests and build did not establish cartoon quality. Scene Maker no longer permits new Batch 3 actions while saved scenes remain inspectable. No repaired video or renewed approval exists; Batch 4 has not started.

**Chair and sofa sitting: DEFERRED indefinitely by Karl on 21 October 2026; neither is approved.** Karl approved the [Max Seated V2 still](../proofs/max-seated-v2/REPORT.md) as a static identity and pose reference only. The later [sit/stand motion study](../proofs/max-sit-motion-study/REPORT.md) failed internal visual inspection and was not submitted for Karl's approval. Preserve the experimental Max rig, seated artwork, chair layers, scripts, recordings and rejected Batch 3 evidence for future reference; none is integrated as a new production path. Do not resume chair or sofa sitting without Karl's explicit request. The remaining rejected Batch 3 toy actions also stay disabled for new Scene Maker work. Previously approved idle, walking, waving, phone/Bright Speak and Batch 1–2 actions are unchanged.

**Max and Maxine Greeting V1 — NOT APPROVED.** Karl found its turn toward the screen unnatural. The walk ended in front-facing idle and Turn squeezed that front-facing frame; the approved wave frames also face forward. Its [original evidence](../proofs/max-maxine-greeting-v1/REPORT.md) remains for comparison.

**Max and Maxine Greeting V2 — REJECTED by Karl.** Its [technical report and exports](../proofs/max-maxine-greeting-v2/REPORT.md) remain as evidence, not acceptance. [Frame-by-frame V3 diagnosis and foundation proof](../proofs/max-maxine-greeting-v3/REPORT.md) found an abrupt stride-to-standing cut, inconsistent horizontal scaling of side poses, and pasted front-wave parts that obscure the eye line or break sleeve anatomy. An opt-in V3 walk-and-stop path now uses proportional side dimensions, consistent horizontal registration and final deceleration; focused/full tests, build, Scene Maker save/reopen and a walk-only scene export pass. Visual inspection still shows a pose cut at the landing. Properly illustrated landing and side-wave frames are needed before a full V3 greeting is integrated or exported. No later animation milestone has started.

Karl's manual AC-01 visual acceptance **FAILED**: rotating a limb exposed gaps and stray artwork. Pixel and rotated-pose audits confirmed incomplete torso/shoulder separation and a missing head layer in the earlier editor renderer. The unfinished editor source and saved definitions are retained for audit, but the Studio no longer opens it. [Failure audit and diagnostic images](../proofs/ac-01/REPORT.md). AC-02 through AC-05 are cancelled under the new direction.

## Current Milestone

M6.8 — Episode 1 V2 improvements (grounding, actions, Bright Speak, sister, Maxine voice).

- Status: Completed
- Deliverable: `proofs/episode-1/v2-production/BrightTales-Episode-1-Meet-Max-V2.webm`
- Editable backup: `proofs/episode-1/v2-production/BrightTales-Episode-1-Meet-Max-V2-studio-backup.json`
- Next: Await Karl and Astra's review of V2.

## Previous Milestone

M6.7 — Deliver Episode 1 first cut to Karl and Astra for review.

- Status: Completed
- Deliverable: `proofs/episode-1/final-production/BrightTales-Episode-1-Meet-Max.webm`
- Note: Original first cut preserved unchanged under `proofs/episode-1/final-production/`.

## Active Work

- Cartoon Life V1 has an experimental review export under Karl's direct request; his visual/listening decision is pending. Greeting V1 and V2 are rejected. V3 has a walk-only foundation scene/export for diagnosis, not a complete greeting; missing landing and side-wave artwork blocks completion. Sitting remains deferred indefinitely, with no Batch 3 repair active.

## Blocked

- Rejected Batch 3 chair/sofa sitting is deferred, not queued for repair. Toy pickup/putdown remain rejected and disabled for new actions. All experimental assets are retained; the approved Living Room background remains unchanged.

## Recent Changes Summary

1. **Grounding fix** — measured foot anchors for all approved Max/Maxine sprites; characters now stand on the floor with aligned shadows.
2. **Walking improvement** — per-character stride and repeating contact cycle reduce sliding.
3. **Reusable action library** — added `breathe`, `point`, `nod`, `shake`, `smile`, `surprise`, `clap`, `react`, `turn` actions available in the Studio scene workflow.
4. **Bright Speak naming** — all UI labels and phone interactions now call the device Bright Speak.
5. **Maxine is Max's sister** — narration and credits updated.
6. **Maxine voice** — added friendly British `Emma` voice with spoken lines in Scenes 2, 5 and 6.
7. **More alive scenes** — V2 scenes include more frequent gestures, reactions, walks and turns during narration to reduce dead gaps.

## Verification

- `npm test -- --run`: 189/189 passed.
- `npm run build`: passed.
- Exported V2 video: 173 s, VP9 + Opus stereo 48 kHz, mean volume −22.0 dB, max volume −1.4 dB.

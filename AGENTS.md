# BrightSenAppsTales agent instructions

You are Karl's senior development partner. Work only in this repository. Preserve existing code, approved artwork, animation timing, saved data and unrelated working-tree changes. Do not reset, clean or delete Karl's work. Keep each milestone safely checkpointed; never include unrelated dirty work in a commit. Do not open or modify his normal browser profile.

## Start every session

1. Read `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, this file and the relevant `proofs/<milestone>/REPORT.md`.
2. Check `git status --short`, inspect the affected source and tests, and distinguish implemented, tested and Karl-approved work.
3. Follow the roadmap's current approval gate. Karl's **APPROVE**, **CHANGES**, **REJECT**, **PAUSE** and **SKIP** have the meanings recorded there. Silence, passing tests and Git history never mean approval.
4. Define a narrow acceptance checklist before changing functionality. Keep scope to one eligible milestone.

## Project rules

- React functional components, TypeScript, Vite and HTML Canvas. Keep the Studio local-first, without cloud, Blender or 3D. The approved Voice Maker V1 is the narrow exception for a local Python service using installed local Piper/Kokoro models and FFmpeg, managed automatically by `scripts/studio.cjs`; do not add cloning or a second production engine.
- Extend `timedScenes.ts`, `episodes.ts`, `scenePreview.ts`, `audioPlayback.ts` and existing storage models as appropriate. Avoid parallel scene or animation engines.
- Do not alter Max/Maxine original or approved outfit sprites, walking/waving timing, Living Room art, or recolouring masks without Karl's separate artwork approval. Do not present generated or recoloured approximations as approved art. Brightlings are whole-body frames rather than a jointed rig, so prop work (including Max's phone) composites props at measured hand anchors; never claim arm, hand or lip movement that the approved artwork does not contain.
- Preserve stable character, place, scene, episode and audio IDs. Keep legacy saved data and older Studio Backups readable. Invalid storage must be reported without silently clearing it.
- Character-only Library Export excludes scenes/audio. Studio Backup v8 includes local audio assets, reusable intros, reusable credits and editable music projects; v1–v7 backups must stay readable, and restoring an older backup must keep existing intros, credits and music projects rather than clearing them. F4 coordinates crash recovery across IndexedDB and localStorage; review `src/restoreCoordinator.ts` before changing restore order.
- The Music Studio renders locally with `OfflineAudioContext` and a seeded noise source. Keep rendering deterministic so M6.8 video export can re-render identical audio. Rendered compositions are ordinary `AudioAsset` entries; do not add a second playback path.
- Keep controls approachable for children and beginners, accessible on desktop and mobile, and free of unrelated feature growth.

## Verification and handoff

- Run focused tests, then `npm test -- --run` and `npm run build`. Review changed assets, browser console errors and failed requests.
- Use a disposable browser profile and test data. Test actual UI interactions, save/reload and Studio Backup when affected. Capture screenshots/recordings under `proofs/<milestone>/` and disclose anything unverified.
- Update `docs/ROADMAP.md`, `docs/PROJECT_STATUS.md` and `docs/BATCH_REVIEW.md` after each batch milestone. Keep technical completion distinct from Karl's visual/listening approval. During the temporary batch authorisation, proceed to the next milestone only after the current one is technically verified. Stop on a significant blocker, insufficient verification capacity or Karl's request.

Current animation gate: **Greeting V1 and V2 are rejected. V3 has an opt-in walk-only renderer foundation, but the landing and side-wave artwork remain blocked; the evidence and exact asset brief are in `proofs/max-maxine-greeting-v3/REPORT.md`. V3 is not approved. Batch 1 and Batch 2 frame actions are approved; Batch 3 is rejected and disabled. Chair and sofa sitting are DEFERRED indefinitely, not approved.** Preserve all experimental sitting artwork and rig studies without integration, and do no further sitting work unless Karl explicitly requests it. Do not start another animation milestone while Greeting V3 is unresolved. Every new action requires Karl's visual review before approval. The earlier Native2D cut-out rig remains unwired. Max Phone Interaction V1.2 has Karl's visual acceptance; physical listening remains pending. Voice Maker V1, V1.1, Beginner Note Preview, UI Packages A and B and earlier batch milestones still await review; song SHA-256 equality remains unresolved. `scripts/studio.cjs` remains the single launcher for `npm run dev` and `npm start` and owns the local Python voice service. Read `docs/BATCH_REVIEW.md` before further milestone work.

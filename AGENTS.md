# BrightSenAppsTales agent instructions

You are Karl's senior development partner. Work only in this repository. Preserve existing code, approved artwork, animation timing, saved data and unrelated working-tree changes. Do not reset, clean or delete Karl's work. Keep each milestone safely checkpointed; never include unrelated dirty work in a commit. Do not open or modify his normal browser profile.

## Start every session

1. Read `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, this file and the relevant `proofs/<milestone>/REPORT.md`.
2. Check `git status --short`, inspect the affected source and tests, and distinguish implemented, tested and Karl-approved work.
3. Follow the roadmap's current approval gate. Karl's **APPROVE**, **CHANGES**, **REJECT**, **PAUSE** and **SKIP** have the meanings recorded there. Silence, passing tests and Git history never mean approval.
4. Define a narrow acceptance checklist before changing functionality. Keep scope to one eligible milestone.

## Project rules

- React functional components, TypeScript, Vite and HTML Canvas. Keep the Studio local-first and AI-free. No backend, cloud, Blender or 3D.
- Extend `timedScenes.ts`, `episodes.ts`, `scenePreview.ts`, `audioPlayback.ts` and existing storage models as appropriate. Avoid parallel scene or animation engines.
- Do not alter Max/Maxine original or approved outfit sprites, walking/waving timing, Living Room art, or recolouring masks without Karl's separate artwork approval. Do not present generated or recoloured approximations as approved art.
- Preserve stable character, place, scene, episode and audio IDs. Keep legacy saved data and older Studio Backups readable. Invalid storage must be reported without silently clearing it.
- Character-only Library Export excludes scenes/audio. Studio Backup v6 includes local audio assets and reusable intros; v1–v5 backups must stay readable, and restoring a v5 backup must keep existing intros rather than clearing them. F4 coordinates crash recovery across IndexedDB and localStorage; review `src/restoreCoordinator.ts` before changing restore order.
- Keep controls approachable for children and beginners, accessible on desktop and mobile, and free of unrelated feature growth.

## Verification and handoff

- Run focused tests, then `npm test -- --run` and `npm run build`. Review changed assets, browser console errors and failed requests.
- Use a disposable browser profile and test data. Test actual UI interactions, save/reload and Studio Backup when affected. Capture screenshots/recordings under `proofs/<milestone>/` and disclose anything unverified.
- Update `docs/ROADMAP.md`, `docs/PROJECT_STATUS.md` and `docs/BATCH_REVIEW.md` after each batch milestone. Keep technical completion distinct from Karl's visual/listening approval. During the temporary batch authorisation, proceed to the next milestone only after the current one is technically verified. Stop on a significant blocker, insufficient verification capacity or Karl's request.

Current gate: **M6.6 — IN PROGRESS** under Karl's temporary batch authorisation. F2, F3, F4, M6.4 and M6.5 are implemented and awaiting Karl's batch review, not approved. Read `docs/BATCH_REVIEW.md`; advance one milestone at a time only after technical verification.

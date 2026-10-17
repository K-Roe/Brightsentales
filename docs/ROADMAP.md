# BrightSenAppsTales development roadmap

Updated 17 October 2026 after M6.4 technical verification. The source code and [project status](PROJECT_STATUS.md) are the current implementation record. A passing test or an evidence report does not grant Karl's visual or functional approval.

## Status key and gate

Use **NOT STARTED**, **IN PROGRESS**, **IMPLEMENTED — AWAITING REVIEW**, **APPROVED**, or **BLOCKED**. Keep the checkbox unchecked until Karl explicitly approves the milestone; implementation alone does not check it. Record approval in this file and `PROJECT_STATUS.md` when Karl gives it. Do not infer approval from a Git commit, passing tests, or silence.

Karl approved M6.3 in the F1 brief and explicitly approved F1 in the F2 brief. F2 is **IMPLEMENTED — AWAITING KARL'S BATCH REVIEW**. Karl authorised temporary batch development without pre-approving results. Work proceeds one milestone at a time, with implementation status and Karl's approval tracked separately.

## Delivered foundation and approval record

| Area | Implemented in the repository | Approval evidence available to this roadmap |
| --- | --- | --- |
| M1–M2 | Living Room Playground, Max and Maxine, directional V3 walk, wave, scene placement and save | Karl explicitly approved these in the supplied milestone history. |
| M3–M5 | Character Library and recolouring, Places folders and artwork import, Studio Backup, two built-in outfits per default character | Male and female recolouring templates and the first Max outfit have explicit Karl approvals. Other production integrations have evidence reports; no blanket approval is inferred. The requested five-outfit wardrobe was not completed. |
| M6 and M6.1 | Timed Scene Maker and visual stage/timeline editor | M6.1 is explicitly described by Karl as visually approved. |
| M6.2 | Episode library, ordered saved-scene references and continuous playback | Karl described M6.2 as approved in the M6.3 brief. |
| M6.3 | Audio Library, scene/episode clips, synchronised playback, Studio Backup v5 | **APPROVED by Karl in the F1 brief.** Preserve [M6.3 evidence](../proofs/m6-3/REPORT.md). |

## Foundation and quality

- [x] **M6.3 Acceptance — APPROVED.** Karl explicitly approved Music & Sound Effects in the F1 brief. The implementation and [evidence](../proofs/m6-3/REPORT.md) remain unchanged.
- [x] **F1 — APPROVED.** Karl explicitly approved Unsaved Episode Changes Protection in the F2 brief. Preserve its [implementation evidence](../proofs/f1/REPORT.md).
- [ ] **F2 — IMPLEMENTED — AWAITING KARL'S BATCH REVIEW.** Genuine MP3, OGG/Vorbis and OGG/Opus files passed isolated Chrome import, preview, scene/episode playback and UI backup restore checks. [F2 evidence](../proofs/f2/REPORT.md). Karl's approval remains pending.
- [ ] **F3 — IMPLEMENTED — AWAITING KARL'S BATCH REVIEW.** Audited current modules and workflows, added the [user guide](USER_GUIDE.md), checked 46 local links, ran 65 tests, a production build and isolated Chrome navigation smoke check. [F3 evidence](../proofs/f3/REPORT.md). Karl's approval remains pending.
- [ ] **F4 — IMPLEMENTED — AWAITING KARL'S BATCH REVIEW.** Coordinated IndexedDB audio snapshot and localStorage journal restore before app startup. Simulated three interruption points in isolated Chrome with real MP3/OGG and episode data; normal browser UI backup restore passed. [F4 evidence](../proofs/f4/REPORT.md). Karl's approval remains pending.

## Complete cartoon production

- [ ] **M6.4 — IMPLEMENTED — AWAITING KARL'S BATCH REVIEW.** Speech and narration import, Brightling/narrator attribution, Voices lane, trimming, volume, non-verbal characters preserved, and dialogue that cannot be silently truncated. 74/74 tests and production build passed; isolated Chrome verified attributed scene dialogue, episode narration across scenes, real captured speech and Studio Backup round-trip. [M6.4 evidence](../proofs/m6-4/REPORT.md). Karl's approval remains pending.
- [ ] **M6.5 — IN PROGRESS.** Reusable Intro Maker: series and episode titles, approved background and Brightling artwork, simple animations, duration, music, preview and save. Dependencies: stable episode timing/audio and reviewed design; M6.4 is the default sequence unless Karl reprioritises. Current milestone.
- [ ] **M6.6 — NOT STARTED.** Reusable Credits Maker: creator, character, production and music credits, acknowledgements, static or scrolling presentation, background, music, duration, preview and save. Dependencies: stable music attribution and timing; M6.5 in the default sequence.
- [ ] **M6.7 — NOT STARTED.** Complete Episode Assembly: intro → scene sequence → credits, continuous global playback, reusable references and sound spanning the production. Dependencies: M6.5 and M6.6, plus M6.4 if dialogue is included in the first finished episode.
- [ ] **M6.8 — NOT STARTED.** Export picture and synchronised sound, initially targeting 1280×720 at 24 FPS subject to browser capabilities. Investigate formats first; promise MP4 only after a playable MP4 is actually produced. Decode and inspect complete exports. Dependency: M6.7 and accepted playback/audio behaviour.

## Creative studio expansion

These are separate approval-gated milestones. They do not block the first finished episode unless their content is specifically needed.

- [ ] **M7.0 — NOT STARTED.** BrightBeats: small local instrument set, visual note/pattern and drum blocks, tempo, loops, save/reopen, export compatible audio, and add it to Audio Library/scene/episode. No cloud, AI music or professional DAW interface. Depends on stable audio import and backup.
- [ ] **M7.1 — NOT STARTED.** Review new Brightling poses, expressions and interactions such as sitting, pointing, clapping and surprise one artwork set at a time. Preserve approved idle/walk/wave. Every new animation needs Karl's visual approval.
- [ ] **M7.2 — NOT STARTED.** Per-scene outfits with legacy defaults and custom-Brightling compatibility. Depends on reviewed artwork/masks for each supported template; do not silently use flattened default-character art for custom colours.
- [ ] **M7.3 — NOT STARTED.** More finished illustrated places, potentially bedroom, garden, kitchen, park and school. Each background needs Karl's visual approval. Preserve Living Room.
- [ ] **M7.4 — NOT STARTED.** Beginner-friendly camera pan/zoom and basic scene transitions. Depends on deterministic scene playback and export decisions.
- [ ] **M7.5 — NOT STARTED.** Timed scene titles, captions and on-screen text. Depends on scene playback and eventual export compatibility.
- [ ] **M7.6 — NOT STARTED.** Placeable 2D props with correct character overlap and draw order. Depends on a reviewed prop artwork approach.
- [ ] **M7.7 — NOT STARTED.** Undo/redo and broader unsaved-changes protection. Build on F1, without a large command system unless needed.

## Milestone workflow

During Karl's temporary batch authorisation, work on one milestone at a time: inspect the code, define acceptance criteria, implement, run focused/full tests and production build, exercise the UI in an isolated browser profile, check console/assets, capture evidence, update this roadmap and `PROJECT_STATUS.md`, then record the result in [BATCH_REVIEW.md](BATCH_REVIEW.md). Continue to the next ordered milestone only after technical verification passes. Implementation is not Karl's approval. Stop if Karl asks, a significant blocker occurs, or the next milestone cannot be verified properly. When batch authorisation ends, resume individual approval gates. Karl's **CHANGES**, **REJECT**, **PAUSE** and **SKIP** take precedence.

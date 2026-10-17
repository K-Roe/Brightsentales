# F3 — documentation audit

17 October 2026. **IMPLEMENTED — AWAITING KARL'S BATCH REVIEW.** No application functionality or saved Studio data was changed.

## Acceptance and result

- Compared README and architecture claims with the actual Character, Places, Scene, Episode, Audio and Playground components, persistence keys and backup implementation.
- Added [USER_GUIDE.md](../../docs/USER_GUIDE.md) with the current create-character, direct-scene, assemble-episode, import-audio and backup workflows. Updated [README.md](../../README.md) to lead to this guide, distinguish Episode Maker's F1 unsaved warning from other editors, and explain the batch review gate.
- Updated [ROADMAP.md](../../docs/ROADMAP.md), [PROJECT_STATUS.md](../../docs/PROJECT_STATUS.md) and [AGENTS.md](../../AGENTS.md) for Karl's temporary sequential batch authorisation. Preserved previous continuity content and approval history. Created [BATCH_REVIEW.md](../../docs/BATCH_REVIEW.md).
- Checked 46 local Markdown links across seven current root/docs files; none were missing.
- Ran an isolated Chrome smoke check: Characters opened by default; all six documented sections opened without a page reload; zero console errors or failed asset requests; localStorage stayed empty; disposable profile was removed. [Browser observations](browser-results.json), [Characters screenshot](characters-overview.png).
- Full suite: **65/65 passed** across 14 files. Production build: **passed**. Browser script syntax check: **passed**.

## Limits and Karl's check

The browser run verifies navigation and that the documented sections exist. It does not re-accept each feature's appearance or usability; earlier milestone reports cover deeper workflows. Karl should read the user guide as a first-time user and flag any wording that differs from how he expects to work. F2 remains technically implemented and awaits his listening review. F4 is the next technical milestone.

No commit was made. The documentation, script, screenshot and results are present in the working tree as a per-milestone checkpoint; unrelated pre-existing F1/F2 changes were preserved.

# Cartoon foundation decisions

## 2026-10-24 — Phase 2 technical verification and visual gate

Keep Phase 2 on separate experimental branches. The real browser-to-Unity run revealed that `motion: "linear"` on ordinary actions was rejected by Unity despite being serialized by Studio; permit that default, reserve `gentle` for Walk, and verify through the full fresh-profile workflow. Both Unity runs, reset/replay, Studio 290/290 and build, browser WebM export and review MP4 decode passed. Preserve approved V1.1 and Phase 1 recovery refs. Karl must judge the Phase 2 video and UI screenshots before P3, baseline promotion or merge. See `proofs/cartoon-foundation-phase2/REPORT.md`.

## 2026-10-24 — Phase 1 technical verification

The real disposable-browser scene creation, save/reopen/edit/send, isolated Unity play/reset/replay and Game-camera capture passed. Preserve the existing localhost bridge; isolated validation uses port 17844 while the normal Editor can keep port 17843. Hash the supported payload as a revision and reject mismatched IDs, revisions and content. Keep the phase technically complete but visually unapproved until Karl reviews `CartoonFoundationP1Review/real-studio-unity-workflow.mp4`. Do not start Phase 2 or merge.

## 2026-10-24 — Phase 1 boundary

Use an isolated experimental Unity scene copied from the approved V1.1 Living Room and a version 5 response on the existing `/command` route. The first transfer version supports only Max/Maxine, approved room artwork and the core five actions. Reject camera, audio, phone and other unmapped data explicitly until their later phases; never silently drop timeline content. Keep the fixed V1.1 controller unchanged. A three-second synthetic Play mode clip is technical evidence only; real Studio UI and visual acceptance remain separate gates.

## 2026-10-24 — Recovery and branch isolation

The local Studio `main` (`39e089d`) contains Camera/Life/Scene Maker functionality absent from the frozen Studio V1.1 branch. It is not a descendant of that branch. Start new Studio work on `cartoon-foundation` from `main` and leave `cartoon-engine-v1-1-approved` frozen. Start Unity `cartoon-foundation` from the frozen approved Unity commit. Confirm integration behavior from actual source rather than assuming a remote branch is current.

The Unity repository was created private at `https://github.com/K-Roe/BrightTalesUnityTest`. Both frozen approved branches were pushed without force. Unity LFS objects were verified remotely with the download batch endpoint (137/137). No baseline was merged into main.

## 2026-10-24 — Integration seam

Reuse the existing localhost receiver and versioned command acknowledgements. Treat `TimedScene` and `Episode` as the Studio source of truth. Keep Cartoon Engine V1.1 fixed and isolated; a new versioned payload and experimental controller must read saved values. Reject unsupported actions and missing artwork explicitly. Keep the browser WebM path working while Unity MP4 output is built and verified separately.

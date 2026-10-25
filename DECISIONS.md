# Cartoon foundation decisions

## 2026-10-25 — P7 production polish

Keep Episode v1, the P6 occurrence clock, AudioPanel and Unity episode bridge unchanged. Add zoom, scrub and read-only audio positions to the existing sequence timeline; detailed audio edits stay in AudioPanel. Keep Undo/Redo as capped local editor history, separate from saved episodes and backups. Expose Replay and WebM export directly in the episode controls. Do not add Crossfade without dual-scene rendering. The isolated P7 Unity branch has no source delta because a real browser-to-Unity v2 run passed on its exact base commit.

## 2026-10-25 — P6 scene timing and fades

Keep `Episode` v1 and add optional per-occurrence settings indexed with `sceneIds`; preserve absent settings as legacy source duration and hard cut. Occurrence operations move timing with the reference. Shorter durations truncate scene actions/audio; longer durations hold the source's final visual state and do not extend source audio. Fade Through Black is visual-only, centred on the boundary, with 0.2–2 second duration bounded by both adjacent occurrences; it does not overlap scenes or restart episode music. Use Unity episode payload v2 only when settings exist; retain v1 for old episodes. Do not expose Crossfade until dual-scene rendering is reliably supported in Studio and Unity.

## 2026-10-25 — P5 episode production scope

Karl's new P5 Episode Production Workflow supersedes the earlier P5 MP4-export label for this milestone. Keep `Episode` v1 and the existing browser/Unity clocks. A scene occurrence refers to its source scene; duration and actions come from that source. Reordering, duplication and removal operate on occurrence positions. Editing the source remains an explicit action and affects every reference. Scene transitions remain the existing hard cuts. Unity P5 source changes are unnecessary for this interface milestone; unsupported Unity mappings still report their limits. P5 remains isolated until Karl approves its merge.

## 2026-10-25 — P4 episode sequencing

Use existing `Episode.sceneIds`, `productionBlocks`, `episodePlaybackClips`, local media relay and experimental `StudioScenePlayer`. Repeated scene IDs are separate indexed occurrences. The transition is a cut, matching current browser episode playback; do not invent a new transition schema. Episode music follows global time across cuts; scene clips follow each occurrence's local time and scene music ducks under episode music. Keep `studio.*` scene commands valid and use separate versioned `episode.*` commands for the larger payload. Explicitly reject Unity intro/credits, Bright Speak and unsupported artwork/places until they have faithful mappings; browser playback remains available. No P5 export or schema migration is part of P4.

## 2026-10-25 — Continuous foundation authorisation and P3 integration

Karl's latest explicit instruction supersedes the earlier P3/P4 visual approval pauses. Merge tested P3 with history preserved; Studio uses `main`, while Unity uses its existing `cartoon-foundation` integration branch because that repository has no `main`. Preserve the frozen Unity V1.1 branch and Studio 3.1 workflow. Implement P4 on isolated branches using existing episode, scene, audio and localhost bridge models; do not begin P5 or expand the data format without a proven need.

## 2026-10-25 — Studio 3.1 approval and P3 local media policy

Karl's explicit final approval freezes Studio 3.1 at `b2218a8`; no-ff merge `1d9d1068f9258f8bbeac0b049f3fb8afe9422518` is pushed main. Implement P3 on new isolated Studio and Unity branches. Keep browser Audio Library blobs as the source of truth; relay only referenced media in the local Studio launcher, bounded in memory and verified by SHA-256, outside command JSON. The Unity scene player may use a v3 audio config while v2 remains valid for existing no-audio scenes. Do not reinterpret single-scene audio as complete episode music continuity. The isolated P3 branch requires Karl's visual/listening review before any merge; do not start P4.

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

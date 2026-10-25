# P7 Episode Production Polish — implementation plan

Base: pushed Studio `main` `ba9b73a58ba6d723aab03aab84819b7868ff6de9`; Unity `cartoon-foundation` `0998a013fe5d33dd5c5d4c71a541564d49b28251`. Work only on isolated `cartoon-foundation-p7-episode-production-polish` branches. P7 remains unmerged.

## Reuse

Keep `EpisodeMaker`, `EpisodeSequencePanel`, `EpisodeInspector`, `AudioPanel`, `episodePlaybackClips`, `productionBlocks`, WebM export and the existing Unity episode bridge. P7 changes editing controls and local undo history; it does not change saved episode fields or Unity commands. The Unity P7 branch exists for integration testing; add Unity source changes only if a verified compatibility defect requires them.

## Acceptance checklist

1. Timeline can zoom, scroll and scrub with accurate occurrence widths and a readable ruler. Scene and audio clips share the same episode clock.
2. Selected occurrence duration is easy to nudge precisely, and selected fade boundaries show a useful visual preview action. Hard Cut remains the default; Crossfade remains unavailable.
3. Episode music, scene audio and voice positions are visible in the sequence, with editing delegated to the existing audio panel.
4. Play, pause, restart, replay and WebM export controls are clear; export status and disabled reasons are understandable.
5. Local undo/redo covers episode edits without changing storage until Save. Shortcuts avoid interfering with focused text and numeric controls.
6. Legacy episodes, save/reopen, Classic, single-scene playback and Unity protocol remain compatible.
7. Focused/full Studio, service, build, disposable browser, complete WebM and browser-to-Unity checks pass. Screenshots/video and exact limitations go in `REPORT.md`.

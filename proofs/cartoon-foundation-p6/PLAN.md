# P6 Scene Timing & Transitions — implementation plan

Acceptance checklist:

1. P5 is merged, post-merge tests/build pass, and `main` is pushed.
2. Existing `Episode` v1 episodes load unchanged. Optional occurrence settings stay aligned with `sceneIds` through add, reorder, duplicate and remove. Invalid settings are rejected without clearing storage.
3. Repeated occurrences can have different durations. Timeline, preview, audio, export and Unity use one canonical block clock. Short occurrences truncate actions/audio; long occurrences hold the source scene's final visual state. Source scene data stays unchanged.
4. Hard Cut is the default. Fade Through Black is visual-only, centered on a boundary with half before and half after; its duration is constrained to 0.2–2 seconds and no longer than the shorter adjacent occurrence. Episode music continues on the global clock. Crossfade is unavailable because the current renderer evaluates one scene at a time.
5. Inspector and boundary controls edit these settings; save/reopen/replay preserves them. Full Studio and service tests, build, disposable browser proof, Unity episode and single-scene regressions pass. Branches are pushed but P6 remains unmerged.

Reuse `episodes.ts`, `audioPlayback.ts`, `EpisodeMaker.tsx`, `EpisodeSequencePanel.tsx`, `sceneVideoExport.ts`, `studioEpisodeBridge.ts`, and the existing Unity `StudioScenePlayer`. No new playback engine or project format.

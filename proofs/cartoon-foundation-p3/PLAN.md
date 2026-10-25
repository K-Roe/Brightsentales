# P3 implementation plan — local audio transfer and sync

Baseline: approved Studio 3.1 at merge `1d9d1068f9258f8bbeac0b049f3fb8afe9422518` on pushed `main`; isolated Studio P3 branch `cartoon-foundation-p3-audio-sync`. Unity P3 is isolated from the approved V1.1 worktree and extends Phase 2's saved-scene player.

Scope from `TODO.md`: send only referenced Audio Library assets outside scene command JSON, verify ID/size/hash and decode success, schedule scene speech/music/effects on the existing Unity playback clock, apply saved trims, volume and fades, and report missing assets. Reuse Studio IndexedDB audio assets and the Phase 2 bridge; preserve scene data and Classic playback. Full episode playback, cross-scene music continuity, Bright Speak Unity transfer and MP4 export require separate later work.

Implementation checkpoints:

1. Local ephemeral media relay in the existing Studio launcher, with same-origin upload, unguessable retrieval URL, byte cap and SHA-256 checks.
2. Browser transfer of scene-referenced assets, with v3 scene audio metadata in the revisioned bridge payload. Keep v2 payloads for audio-free scenes.
3. Unity v3 validation, download/hash/decode before Play, then per-clip scheduling from the existing scene clock; reset releases sources. Reject missing/corrupt media.
4. Focused and full Studio tests, service tests, build, isolated Unity Play Mode tests, disposable browser and audio review proof. Record evidence limits accurately.

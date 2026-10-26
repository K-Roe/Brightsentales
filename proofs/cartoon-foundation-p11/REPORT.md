# P11 Episode Production & Polish

**Authorised by Karl: 2026-10-26.** Development is on the existing `brighttales-active-development` branch in Studio and Unity. No milestone branches or protected-branch merges are authorised. P8–P10 backups, reports and unrelated Unity workspace changes must be preserved. No P12.

## Approved scope

Deliver a beginner-friendly end-to-end episode workflow using existing BrightTales systems. A director must be able to select two modular Brightlings, compose them into saved scenes at an existing location, position them, use existing walking/waving/idle actions, add camera shots/targets/movement and supported voice/music audio, scrub and preview the episode, save/reopen it, transfer it to Unity for playback, and export through the existing supported exporter. Unity must use the existing Brightling auto-builder and episode/scene player; it must construct missing supported cast members without manual asset creation.

Create one short experimental demonstration episode without overwriting approved episodes. It must include two visibly different modular Brightlings, an existing location, walk and wave actions, at least two camera shots, one supported audio cue, and a beginning and ending.

Keep the existing Episode Maker, character/scene stores, deterministic preview/export, audio path, camera director and Unity bridge. Preserve character identity, appearance, action timing, camera targets, scene order and legacy episodes. Do not modify Max/Maxine artwork or add a rendering/animation architecture, Blender, Vue, AI services, unrelated features or P12.

## Verification requirements

Run Studio tests/build and relevant Unity character builder, bridge, camera, episode and audio tests. Complete a real disposable-browser-to-Unity workflow where possible. Capture real application screenshots, logs and export evidence. Document unverified graphical/audio checks honestly; automated checks do not grant Karl's manual acceptance.

## Implementation status

Specification recorded. Work in progress; results and exact commits will be appended after implementation and verification.

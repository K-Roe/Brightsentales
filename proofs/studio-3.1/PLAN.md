# Studio 3.1 direct animation plan — 2026-10-24

Baseline: Studio `main` at `35b86922e56ed390b2af7e051cc58933bccf0100`, clean; isolated worktree `C:\Users\karlr\repos\BrightTalesStudio31` on `studio-3.1-direct-animation`. Unity approved repository `cartoon-engine-v1-1-approved` at `9cf9095` has unrelated untracked review files. The supported saved-scene Unity player is in the separate Phase 2 Unity worktree at `9997d9e`; it supports Living Room, Max/Maxine, appear, walk, wait, wave, disappear, look-at, Calm Life v2 and Camera V1. No Unity source change is planned.

Reuse `App.tsx` for workspace, navigation and saved libraries; `SceneMaker.tsx` for scene editing and the existing Canvas preview; `SceneTimeline.tsx` and `timelineEditing.ts` for action timing; `timedScenes.ts` for validation and playback; `StudioSceneUnityPanel.tsx` for optional saved-scene transfer. Preserve Classic, backup v8, IDs, artwork and action timing.

Acceptance checklist:

1. Studio 3.0 opens the Cartoon Editor, resuming a saved scene when present. File/Open exposes the current scene library and Projects remains accessible.
2. In the professional layout, add Max and Maxine, select and drag on the stage, choose Walk and click a visible destination, add Wave at a useful playhead position, scrub and move/resize clips, and play/stop/replay using the existing scene model. The selected character, selected action and destination remain visible.
3. Menus, hierarchy, compact asset browser, inspector and transport expose only supported commands. Classic keeps its original behavior and styles.
4. A disposable browser creates the required Living Room demonstration entirely through UI, saves, closes/reopens, edits an action, saves and replays. Screenshots and a short UI recording document the result.
5. Focused editor/timeline tests, full Studio suite, voice-service tests and build pass. The existing Unity bridge is checked with isolated Play Mode where available; any normal-Editor or exporter limit is stated explicitly.

Implementation sequence: default editor and resume → direct stage/Inspector flow → timeline/transport/menu and asset layout → focused tests → production build and browser/Unity verification → documentation and review media. Stop for Karl's visual decision; no main merge or approved-baseline edit.

# Editable Bright Speak message — Studio 3.1 amendment

Baseline: Karl approved the Studio 3.1 direct-animation core on `studio-3.1-direct-animation` commit `ae859ef5ff1f2a557afb6c69295033a10660a4d6`. Keep that branch isolated. No P3 or Unity source change.

Acceptance checklist:

1. Each Communicate Message interaction stores its own normal free-text `message` in the existing `TimedScene.phone` action. A new text-only action needs no voice asset or preset.
2. Professional timeline shows Bright Speak blocks. Selecting one opens the existing contextual Inspector, where Karl edits its message and can preview it on the existing stage.
3. The shared phone state and renderer use that action's text at its scheduled time. Two actions keep independent text after save, browser close/reopen, edit and replay.
4. Saved actions lacking `message` use the previous starter message. Existing phone controls, Classic, Studio 3.1 direct animation and the Unity bridge remain intact.
5. Focused/full tests, production build and disposable-browser proof pass. Capture the selected Inspector, stage playback, timeline and review recording. Stop for Karl's final freeze decision.

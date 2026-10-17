# M6 timed Scene Maker V1 — review report

## Implementation

- Replaced the Scenes placeholder with a named scene library and visual timed action editor. Create, edit, duplicate and delete use stable scene IDs. The editor supports artwork-ready Places, scene duration, Brightling cast, initial positions, Appear, Walk To, Wait, Wave and Disappear.
- Actions appear in chronological order and may be retimed, edited and removed. A same-character overlap or action past the scene end is shown as an error and cannot be saved or played. Different characters can act simultaneously.
- Preview has Play, Pause, Restart and a seek scrubber. Position and pose are calculated from the action schedule for each requested time, so seeking does not depend on earlier playback. Walks interpolate over their entered duration, start from the preceding position, show the existing side-view turn and walking frames, and return to idle. Wave uses the existing wave frame order and timing. Rendering uses the approved sprite sets and depth order by feet position.
- Timed scenes live under `brightsenappstales.timed-scenes.v1`, separate from the legacy Playground scene key. Studio Backup is version 3 and includes the timed scene library. Old version 1/2 backups remain readable; their missing timed-scene field does not silently clear existing timed scenes. Restore uses the existing recovery journal and includes timed scenes in rollback.
- Existing Playground UI, storage and rendering were left in place. No new character or place artwork was created.

## Browser evidence

The browser script `proofs/m6-browser-check.mjs` used a fresh temporary Chrome profile with empty storage and removed it at the end. It used the visible UI to create a 10-second Living Room scene: Max appears, walks for three seconds and waves at four seconds; Maxine appears and waves at two seconds. It then saved, sought to 0, 2.5, 5 and 10 seconds, checked Pause and Restart, played through the end, reloaded, edited the name, duplicated and deleted a copy. A complete Studio Backup was exported, the isolated storage was cleared, and the backup was imported. The timed scene and Maxine outfit were restored. No browser console errors were captured.

- `scene-playback.mp4`: 11-second browser capture of the 10-second playback.
- `action-editor.png` and `action-controls.png`: scene stage and timed action fields.
- `time-0.png`, `time-2-5.png`, `time-5.png`, `time-10.png`: deterministic seek screenshots.
- `editor-mobile.png`, `restored-scenes-mobile.png`: narrow layout and restored library.
- `scene-maxine-alternative-outfit.png`: saved Maxine outfit in Scene Maker.
- `browser-check.json`: browser observations, including ID stability, backup counts, pause and end state, console errors and profile cleanup.
- `example-studio-backup.json`: disposable test backup containing one timed scene; no Karl data.

## Verification

- `npm test`: 10 test files, 47 tests passed. New tests cover movement interpolation, waiting and continuity, appearances, offscreen exit, wave frames, overlapping different characters, same-character conflicts, duration bounds, leftward facing, deterministic seeking, custom Brightling references, save/reload, Studio Backup, older backup compatibility and failed restore rollback. Existing walking, waving, character, Playground and storage tests remain passing.
- `npm run build`: TypeScript and production Vite build passed.
- `git diff --check`: passed.
- Browser console error count: 0. Temporary Chrome profile removed.

## Known limits and approval

- Only left/right side-view sprite artwork exists. A nearly vertical walk uses the previous horizontal facing direction, as in Playground.
- Initial position and offscreen exits can be set with X/Y fields; Walk To and Appear positions can also be chosen by clicking the stage. The stage does not offer dragging in the Scene Maker.
- Scene playback follows the currently selected Max/Maxine outfits. Outfit selection is stored in the existing Playground scene data and included in Studio Backup; timed scenes reference character IDs rather than duplicating outfit data.
- A place used by a timed scene cannot be removed or have its artwork made unavailable until that scene is changed or deleted. This protects saved references but the Places UI currently reports a general save failure.
- The recording covers one representative scene, rather than every action and character combination. Tests and screenshots do not establish Karl's visual approval.

**M6 remains pending Karl's visual approval. No later milestone was started.**

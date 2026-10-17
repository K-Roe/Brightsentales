# M6.2 Episode Maker V1 — verification and review

## Implementation

- Added an Episodes sidebar section, a saved episode library, and a visual editor with a saved-scene list, ordered sequence, large preview, and global seek control.
- Episodes store stable scene IDs in order. The same scene ID may occur more than once. Duration and playback resolve the current saved scene, so edits take effect without copying actions.
- The episode clock maps to a scene-local clock at each boundary. Rendering uses the existing `stateAt` scene evaluator, approved sprite sources, and scene artwork. The M6.1 Scene Maker remains the scene editor.
- Missing scene references remain visible by ID, with an immediate warning and disabled playback. Removing the episode block does not delete any saved scene.
- Studio Backup format 4 includes the episode library and timed scenes. Restore journals the episode key with existing keys for rollback. Versions 1–3 remain accepted; older backups leave the local episode library in place. Valid missing scene IDs are preserved in a backup so a scene can be restored by ID later; playback stays blocked until then.

## Automated verification

- `npm test`: 12 files, 57 tests passed.
- `npm run build`: TypeScript and Vite production build passed.
- `git diff --check`: passed.
- Focused tests cover boundary mapping (10/25/33 seconds), scene-local state reset, repeated/reordered references, updated scene content, missing reference blocking, backup validation, restore and write-failure rollback.

## Browser verification

Disposable Chrome profiles only. Both profiles started with zero local-storage entries and were removed after the run. The three valid timed scenes were seeded **inside the first disposable profile** to exercise the Episode Maker without writing to Karl's browser data. Their actions used the existing scene format. No test characters or scenes were inserted into Karl's real profile.

- Added the saved Max Arrives (10s), Maxine Joins (15s), and Goodbye (8s) scenes to an episode through the Episode UI. Our First Episode showed the correct order and 33.0s total.
- Seeking to 10s opened Maxine Joins at local 0s; seeking to 25s opened Goodbye at local 0s. Screenshots show each scene.
- Moving a sequence block changed order; adding the same scene a second time changed the total to 43.0s; removing it restored 33.0s.
- Save and page reload retained the episode and scene IDs.
- Duplicating an episode created a separate copy. Deleting that copy with confirmation left the original episode in the library.
- Playback paused at 4.1s without advancing, resumed and stopped automatically at 33.0s with Play available again. The MP4 samples browser screenshots on a real 200ms clock; its 34.8s includes the half-second pause.
- Exported Studio Backup version 4 through the UI. Imported it through the actual file input in a second empty disposable browser profile. It restored all 3 scenes, 1 episode, the order and 33.0s total.
- Edit Scene opened the existing Scene Maker at Max Arrives. Extending that saved scene from 10s to 12s updated the episode total to 35.0s. Deleting Maxine Joins then showed a missing-scene warning and disabled Play.
- The downloaded backup's episode ID matched the ID restored through the browser file-import UI.
- Browser console errors: 0. Failed network/asset responses: 0.

## Evidence

- `episode-playback.mp4`: real-time continuous playback, including pause and resume.
- `episode-library-saved-desktop.png`, `episode-editor-three-scenes-desktop.png`, `three-scene-sequence-desktop.png`, `episode-editor-mobile.png`.
- `playback-scene-1.png`, `playback-scene-2.png`, `playback-scene-3.png`: seek evidence.
- `backup-restored-episode.png`, `episode-updated-scene.png`, `episode-missing-scene-warning.png`.
- `browser-results.json`: exact observed clocks, IDs, backup results, console/asset checks, profile cleanup.
- `downloads/`: disposable exported Studio Backup with only test scene data.

## Known limits and future compatibility

- Episode reordering uses buttons; there is no drag-and-drop or transition effect in V1. Scenes cut directly at boundaries.
- The episode preview uses the currently saved global Max and Maxine outfit selections, matching M6 scene playback. The current timed-scene format has no per-scene outfit override. Custom Brightlings use their saved colours.
- Scene edits open Scene Maker. Save the episode before leaving if its sequence has unsaved changes.
- The mobile layout stacks the scene list below the large stage, so arranging long episodes takes vertical scrolling.
- Future music can use the global episode clock; scene dialogue and sound cues can use `{ sceneId, localTime }` plus an occurrence index when a scene repeats. A future audio track can be added beside the sequence without changing scene ID references or the existing action evaluator. No audio or export controls were implemented here.
- Browser verification used disposable seeded M6 scenes. It did not repeat M6.1's full scene-creation workflow, which was already approved separately. Visual acceptance of the Episode Maker remains Karl's decision.

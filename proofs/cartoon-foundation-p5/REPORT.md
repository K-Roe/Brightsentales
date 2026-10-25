# P5 Episode Production Workflow — technical proof

**Status (25 October 2026):** Implemented and technically verified on isolated Studio branch `cartoon-foundation-p5-episode-production`. Unity branch of the same name points to the verified P4 integration baseline; P5 required no Unity source edits. P5 is **not merged** and awaits Karl's full visual/usability review.

Studio implementation commit: `10f2dbbd7dd001f372a0c77b44d52173e575f580`. Unity P5 branch tip: `b8821b089adcb87ab6b2f9f31119f982f1a63690` (no P5 Unity changes). The final Studio proof/documentation commit is the branch tip; resolve it with `git rev-parse cartoon-foundation-p5-episode-production`.

## Baseline and scope

Karl authorised P4 integration. Studio `main` is pushed at `a2fd628d15536352df53ac4dda762a3a5f0e7a76` (P4 merge `e04c17fb2d6624b55cd07228acfd3d9d6e382a57`); Unity `cartoon-foundation` is pushed at `b8821b089adcb87ab6b2f9f31119f982f1a63690`. The Studio P4 merge tree matched the P4 branch tip. The older roadmap labels P5 as Unity MP4 export; Karl's newer P5 authority specifies **Episode Production Workflow**, and that is the scope here.

Episode Maker still saves canonical `Episode` v1 data. The existing `productionBlocks`/`productionPosition` clock, `AudioPanel`/`useAudioPlayback`, P3 media relay and P4 Unity episode preview remain the playback paths. No new episode format, audio engine or Unity renderer was introduced.

## Implementation

- Episode sequence has selectable scene occurrences, drag reorder with arrow-button alternatives, duplicate and remove. Repeated references never mutate the saved source scene.
- Contextual scene properties show occurrence number, start/end/duration and sequence actions; editing the source scene is an explicit separate command. Missing references show a repair/removal path.
- Duration-scaled episode timeline shows scene blocks, labels, durations, time ruler, selected/current scene and playhead. The existing range control scrubs the global clock; clicking a block selects it and seeks to its start.
- The stage has Play/Pause, Stop and Restart; `Preview Episode` starts from the beginning. The existing WebM export remains available below the workspace.
- Saved-scene browser shows place artwork thumbnails where available. Episode name, intro, credits and music controls remain in the existing editor. The dirty/leave guard now includes intro and credits changes.
- Episode music continues through cuts using the existing global music clip; scene audio retains per-occurrence timing. No second audio path was added.

Source changes: `src/EpisodeMaker.tsx`, `src/EpisodeSequencePanel.tsx`, `src/episodeSequence.ts`, `src/episodeSequence.test.ts`, `src/episodeDraft.ts`, `src/episodeDraft.test.ts`, `src/style.css`. Documentation: `AGENT_HANDOVER.md`, `CURRENT_STATE.md`, `DECISIONS.md`, `TODO.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, this report and browser proof.

## Verification

| Check | Result |
| --- | --- |
| Focused episode draft/sequence/model tests | 9/9 pass. |
| Complete Studio `npm test` | 44 files, 304/304 pass. Includes existing scene, episode, audio, restore and bridge regressions. |
| Voice-service/relay `npm run test:service` | 12/12 pass. |
| Production `npm run build` | Pass; existing Vite 500 kB bundle advisory. Built before launching production on `127.0.0.1:4179`. |
| Disposable Chrome workflow | [All stages pass](browser-workflow-results.json), with no console exceptions or failed requests. Created Max and Maxine scenes, imported music, authored first/second/first, selected/duplicated/removed/reordered occurrences, saved, previewed through a boundary, stopped, closed/reopened browser, and replayed with stable IDs. |
| Post-merge Unity Play Mode on identical P5 Unity tree | [Episode 2/2](../cartoon-foundation-p4/unity-post-merge-episode-results.xml), [single-scene audio 1/1](../cartoon-foundation-p4/unity-post-merge-audio-results.xml), [saved-scene action/clock 1/1](../cartoon-foundation-p4/unity-post-merge-phase2-results.xml). P5 made no Unity source changes. |
| Review video | [9-second browser walkthrough](episode-workflow.mp4), FFprobe duration 9.000 s and full FFmpeg decode pass. |

Review images: [workspace top](00-episode-workspace-top.png), [stage/editor](01-episode-editor.png), [selected scene Inspector](02-selected-scene-inspector.png), [sequence timeline](03-sequence-timeline.png), [scene boundary](04-scene-boundary.png), [reopened replay](05-reopened-playback.png), [Unity controls](06-unity-episode-controls.png). The [browser script](browser-workflow.mjs) uses a new disposable Chrome profile and only generated test data.

## Karl review steps

1. Open the P5 Studio worktree and run `npm run build`, then `npm start`. Open the URL printed by the launcher in a disposable browser profile.
2. In Cartoon Editor, save two scenes. In Episode Maker, create/name an episode and add those scenes from Saved scenes. Add either scene again to make a repeated occurrence.
3. Select scene cards and timeline blocks. Drag a card or use arrows to reorder. Use the scene properties panel to duplicate/remove. Confirm source scenes remain in the library.
4. Add music through Music & sound, save, use Preview Episode, scrub/pause/stop/restart, then close/reopen and replay. The P4 Unity preview controls are available when the experimental Unity runtime is running.

## Limits and approval boundary

Scene duration and actions are inherited from each saved source scene; changing the source affects all its occurrences. Sequence operations are episode-specific. Transitions are the existing hard cuts. Unity supports only P4's mapped scenes/actions/audio; unsupported intros, credits, Bright Speak and place mappings are reported. Automatic Unity launch, embedded Game view and Unity MP4 export are not implemented. Unity Game-view capture was unavailable in headless batch mode; this report does not claim Unity visual capture or physical listening. Karl's visual/usability acceptance remains pending. **Do not merge P5 without Karl's approval.**

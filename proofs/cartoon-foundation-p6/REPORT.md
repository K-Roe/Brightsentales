# P6 Scene Timing & Transitions — technical proof

**Status (25 October 2026):** Isolated Studio and Unity branches `cartoon-foundation-p6-scene-timing-transitions`. P6 is **not merged**. Karl authorised this milestone after approving the P5 merge. P5 Studio `main` merged without conflicts at `7f47119b68d95bd5aefa839dad14f3e112f2e1d1`, passed post-merge 304/304 Studio tests, 12/12 service/relay tests and production build, and was pushed. Unity P5 had no source changes; its `cartoon-foundation` baseline remains `b8821b089adcb87ab6b2f9f31119f982f1a63690`.

Studio implementation commit: `d4154750976d462ba8f6d1359f0a92eedb125f77`. Unity implementation commit: `3ec24ca6330bd211e72b59694a30b592a99969d6` (pushed). Both are isolated from their integration branches. The Studio branch also carries this report, media proof and handover in a subsequent documentation commit.

## Implementation

Existing `Episode` v1 gains optional occurrence settings aligned with `sceneIds`: an independent duration and a transition before each scene after the first. Older episodes have no settings and retain source durations and hard cuts. Add, reorder, duplicate and remove move the settings with the occurrence. Invalid settings reject loading or saving; no data is silently cleared.

`productionBlocks` is the single episode clock for timeline, browser preview, audio, WebM export and Unity transfer. A shorter occurrence stops source actions and scene audio at its end. A longer occurrence holds the source scene's final visual state; it does not create extra source audio. Episode music stays on the global clock. Fade Through Black is a visual overlay centred on the scene boundary, half before and half after; it does not overlap scenes or change total duration. Fade duration must be 0.2–2 seconds and fit both adjacent occurrences. Scene audio switches at the cut; episode music continues.

The contextual Inspector edits occurrence duration or the selected boundary's Hard Cut/Fade Through Black setting. The timeline scales blocks and playhead to actual duration. Browser stage and WebM share the same fade opacity function. Unity episode payload version 2 carries occurrence durations and fades; legacy episodes still send version 1. Unity validates both, clamps source-scene evaluation and uses a runtime black sprite overlay. The existing single-scene bridge and approved artwork are unchanged.

Source files: Studio `src/episodes.ts`, `src/episodeSequence.ts`, `src/episodeDraft.ts`, `src/audioPlayback.ts`, `src/EpisodeMaker.tsx`, `src/EpisodeSequencePanel.tsx`, new `src/EpisodeInspector.tsx`, `src/studioEpisodeBridge.ts`, scoped CSS and focused tests. Unity `Assets/CartoonFoundationExperimental/StudioScenePlayer.cs` and `Assets/Tests/PlayMode/StudioEpisodePlayModeTest.cs`. Architecture/state/roadmap/handover documents were updated.

## Verification

| Check | Result |
| --- | --- |
| Focused Studio episode/draft/sequence/bridge tests | 18/18 pass. |
| Complete Studio `npm test` | 44 files, 309/309 pass. |
| Voice-service/relay `npm run test:service` | 12/12 pass. |
| Production `npm run build` | Pass, with existing Vite 500 kB advisory. Built before `npm start` on `127.0.0.1:4179`. |
| [Disposable Chrome workflow](browser-workflow-results.json) | All stages pass: author two scenes, repeat one with distinct durations, set fade, save, seek to black boundary, play across it, stop, close/reopen, edit duration, save and replay. No console exceptions or failed requests. The first attempt timed out restarting disposable Chrome while Unity imported; the completed rerun passed. |
| [Unity episode Play Mode](unity-episode-results.xml) | 4/4 pass: P4 scene/audio regressions plus P6 occurrence timing, fade overlay state, pause/stop/replay, excessive-fade rejection, and v2 music/scene-audio boundaries. This is component/runtime state evidence; no Unity Game-view image was captured. |
| Unity single-scene regressions | [Audio 1/1](unity-scene-audio-results.xml) and [saved actions 1/1](unity-scene-action-results.xml) pass. |
| [Browser to Unity bridge](unity-browser-e2e-results.json) | [Unity Play Mode 1/1](unity-browser-results.xml) and all three browser stages pass. The UI-authored v2 episode transferred three durations (2, 4, 1.5 seconds), a 0.6 second fade and one episode music clip starting at 0; Unity played every occurrence, kept one music source across boundaries, replayed and reset. One media upload, no browser exceptions or failed requests. |
| Complete episode export | [WebM](exported-episode.webm) contains VP9 video and Opus audio, full FFmpeg decode pass. Last video packet at 7.627s for a 7.5s authored sequence. [Fade sample](exported-fade-peak.png) shows a dark frame near the boundary. |
| Review walkthrough | [Nine-second UI video](episode-workflow.mp4), FFprobe duration 9.000s and full decode pass. |

Screenshots: [workspace](00-episode-workspace-top.png), [scene Inspector](02-selected-scene-inspector.png), [boundary Inspector](07-transition-inspector.png), [actual-duration timeline](08-timing-timeline.png), [black boundary frame](09-fade-through-black.png), [reopened playback](05-reopened-playback.png), [Unity loaded status](05-unity-episode-loaded.png), [Unity playing status](06-unity-episode-playing.png) and [Unity reset status](07-unity-episode-reset.png). The [browser workflow](browser-workflow.mjs) and [Unity transfer workflow](unity-browser-e2e.mjs) create disposable scenes/audio/profile data.

The bridge run also exposed a real parser mismatch: Unity `JsonUtility` materialised absent hard-cut transitions as empty objects. The v2 validator now accepts those as hard cuts and rejects malformed non-empty transitions. A load failure now reports its actual validation reason. Earlier bridge attempts failed because the proof build initially targeted port 17843 instead of isolated port 17844, then because a copied test script placed music at the selected boundary. The final production preview was rebuilt with `VITE_UNITY_BRIDGE_PORT=17844`, and the passing run starts music at time zero. The ordinary production build was verified separately.

## Karl review steps

1. In the isolated P6 Studio worktree, run `npm run build` then `npm start`. Open the printed URL in a disposable browser profile.
2. Save two scenes, create an episode, and add the first scene again as a third occurrence.
3. Select each occurrence to set a different **Episode duration**. Confirm source scenes stay unchanged and timeline blocks/total duration update.
4. Select the boundary marker before scene 2. Switch Hard Cut to Fade Through Black and adjust the fade duration. Preview, scrub through the boundary, pause/stop/restart, save, close/reopen, edit and replay.
5. Add episode music and, if desired, export WebM. Unity preview requires the isolated P6 Unity runtime; unsupported scene mappings still report their limits.

## Limits and next step

Crossfade is unavailable because the existing Studio and Unity renderers evaluate one scene at a time; adding dual-scene compositing would be a separate architectural milestone. Fade Through Black is visual-only; scene audio switches at the cut while episode music stays continuous. Intros and credits retain their existing hard boundaries. Unity still supports only its mapped Living Room scenes/actions/audio and lacks automatic launch, embedded Game view and MP4 export. No Unity Game-view capture or physical listening was performed. Karl's later visual/usability review remains the gate for merging P6. The next recommended milestone is a deliberate review of episode playback/export and any gaps Karl identifies, before choosing another foundation feature.

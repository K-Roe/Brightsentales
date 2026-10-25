# P4 episode playback plan

Karl authorised continuous foundation development on 25 October 2026. Work stays on isolated P4 branches after P3 integration. This milestone extends the existing `Episode`/`TimedScene`, browser renderer, local audio relay, and Unity saved-scene player.

## Acceptance checklist

1. An ordered episode of two saved scenes, including a repeated occurrence, transfers with stable scene IDs and explicit occurrence indexes.
2. Unity plays every scene on one episode clock. Character and camera state reset at each boundary; the transition is a clear cut, matching browser episode playback.
3. Scene clips use local time, while episode clips and music use global time and continue through cuts. Missing or corrupt assets reject before Play.
4. Play, pause, stop/reset and replay report accurate state and errors. Audio-free scenes and existing single-scene v2/v3 commands remain compatible.
5. The saved episode can be reopened in Studio and sent again without changing its schema. Unsupported content is reported before transfer.
6. Focused Studio and Unity tests, complete Studio tests, voice-service tests, production build and a disposable-browser save/reopen/replay proof pass before integration.

## Intended seams

- `episodes.ts` remains the source of ordered occurrences and global/local positions; `EpisodeMaker.tsx` remains the authoring surface.
- A P4 episode bridge builds versioned transfer data from existing `studioSceneConfig`, deduplicates referenced audio through the P3 relay, and sends `episode.*` commands through the current localhost bridge.
- A Unity episode controller drives `StudioScenePlayer` at local time and owns episode-level audio on the global clock. It does not create another character renderer or saved project format.
- Intro and credits rendering, Bright Speak, unsupported artwork and places are explicitly rejected for Unity preview until faithful mappings exist. Browser playback and WebM remain available.

# P4 episode playback — technical proof

**Status (25 October 2026):** P4 scene-episode playback is technically verified on isolated Studio and Unity branches `cartoon-foundation-p4-episode-playback`. Karl's continuous-development authorisation replaces routine milestone review stops. The P4 branches are not merged into the Studio `main` or Unity `cartoon-foundation` baselines at this checkpoint.

Implementation commits: Studio `428d7a7012cecbff987bdaa5f451c5a3827cc028`; Unity `6a34bb3b2cdbf1b45889ea2d9880a40264cf1381`. P3 integration baselines are Studio `main` `2e684840b6103fa9541db89baae4c7a369044897` and Unity `cartoon-foundation` `4041a103902bd333db8a4427699d812534e7afa0`.

## Scope and implementation

Studio uses saved `Episode.sceneIds` for ordered scenes, including repeated references. `studioEpisodeBridge.ts` transfers indexed occurrences through the existing scene mapper and one revisioned `episode.*` payload. `EpisodeMaker.tsx` adds compact Unity preview controls while preserving browser playback, WebM export, local storage, backup and Classic access. Audio is uploaded by the P3 relay once per referenced asset; scene clips are placed on each occurrence's local clock, while episode music uses the global episode clock and survives scene cuts. Transfer-only trimming bounds audio at the episode end without changing saved clips.

The experimental Unity `StudioScenePlayer` evaluates the existing character/camera renderer at each scene's local time on a global episode clock. Actors absent from the next scene are removed at the cut. `episode.load/play/pause/stop/status/reset` handle loading, revision checks, errors, transport and replay. The P3 single-scene path and frozen Cartoon Engine V1.1 remain separate.

## Verification

| Check | Result |
| --- | --- |
| Studio focused episode/scene/persistence tests | 15/15 pass. |
| Complete Studio `npm test` | 43 files, 302/302 pass. |
| Voice-service and relay `npm run test:service` | 12/12 pass. |
| `npm run build` | Pass. Existing Vite 500 kB bundle advisory. Final default-port build is recorded after isolated Unity proof. |
| Unity episode Play Mode | [2/2 pass](unity-episode-playmode-results.xml): repeated scenes, actor/camera reset, pause/stop/replay, continuous episode music, scene clip timing/ducking and corrupt-media rejection. |
| P3 Unity scene audio regression | [1/1 pass](unity-scene-audio-regression-results.xml). |
| P2 Unity saved-scene regression | [1/1 pass](unity-phase2-regression-results.xml). |
| Disposable browser | [All stages pass](browser-workflow-results.json): UI imported music, saved two scenes, authored first/second/first, played across a cut, closed/reopened, replayed with stable episode/audio IDs. No console errors or failed requests. |
| Browser → relay → Unity | [Browser stages pass](unity-browser-e2e-results.json), [Unity Play Mode 1/1 pass](unity-browser-playmode-results.xml): UI-authored episode uploaded one music asset, Unity played all three occurrences and kept one music source through both cuts, then replayed and reset. |
| Review media | [Episode editor](01-episode-editor.png), [browser boundary](02-scene-boundary.png), [reopened playback](03-reopened-playback.png), [Unity controls](04-unity-episode-controls.png), [loaded](05-unity-episode-loaded.png), [playing](06-unity-episode-playing.png), [reset](07-unity-episode-reset.png), [nine-second browser recording](episode-workflow.mp4). FFprobe measured 9.000 s and FFmpeg decoded the whole file without error. |

The Unity Play Mode test observes actual `AudioSource` playback and scene indices. Batch mode with `-nographics` could not create a `RenderTexture` for Game-view capture, so this proof does not claim a Unity visual recording or physical listening. The earlier test harness capture attempt failed for that reason; its capture code was removed and the playback assertions reran successfully. The browser video records browser playback, not Unity export.

## Supported limits

Unity episode preview currently supports approved Living Room scenes with Max and Maxine and the scene actions/camera/audio mapped by P2/P3. It uses hard cuts, as the browser episode player already does. Intro and credits overlays, Bright Speak interactions, other places/artwork, automatic Unity launch, embedded Game view and Unity MP4 export remain unsupported and are reported rather than silently discarded. Browser playback and WebM export retain their broader existing capabilities. Saved episode and backup schemas were not changed.

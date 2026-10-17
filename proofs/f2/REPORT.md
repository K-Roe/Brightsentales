# F2 — real MP3 and OGG browser compatibility

17 October 2026. **IMPLEMENTED — AWAITING KARL'S REVIEW.** This is a codec acceptance test of the existing M6.3 audio implementation. No production application code, saved data, artwork or prior evidence was changed.

## Test method and fixtures

I generated five original sine-wave clips with FFmpeg in a disposable Chrome profile, then verified each actual container, codec, channel count and duration with FFprobe. The script and exact probe results are in [browser-check.mjs](browser-check.mjs) and [browser-results.json](browser-results.json). No fixture audio is checked into the repository. The temporary files and both browser profiles were removed after the run.

| File | Container / codec | Channels | Duration | Use |
| --- | --- | --- | --- | --- |
| `mp3-music.mp3` | MP3 / MP3 | Stereo | 33.000 s | Episode-wide music |
| `mp3-effect.mp3` | MP3 / MP3 | Mono | 2.000 s | First-scene sound effect |
| `vorbis-music.ogg` | OGG / Vorbis | Stereo | 6.000 s | Second-scene music |
| `vorbis-effect.ogg` | OGG / Vorbis | Mono | 2.000 s | Second-scene sound effect |
| `opus-effect.ogg` | OGG / Opus | Mono | 2.0065 s | Third-scene sound effect |

Browser: isolated **Chrome 155.0.8059.80** on Windows 10/11, headless mode. `canPlayType` returned `probably` for MP3, OGG/Vorbis and OGG/Opus; actual `decodeAudioData` imports and preview playback succeeded for all five. This establishes support in this Chrome build, not in every browser or for every possible OGG codec.

## Browser results

- **Audio Library:** all five files imported through the visible file control with the selected Music or Sound Effect type. Displayed durations were 33.0, 2.0, 6.0, 2.0 and 2.0 seconds, consistent with decoded durations rounded to a tenth. Every Preview button played and advanced the media element. All five remained in IndexedDB and the UI after reload, with matching names, MIME types, byte sizes and durations. A corrupt `.mp3` was rejected with “This browser could not decode the audio file.” A non-audio `.flac` was rejected with “Choose an MP3, WAV or OGG audio file supported by this browser.” Neither invalid file entered the library.
- **Scene Maker:** added the mono MP3 effect at 2 s with 0.2 s trim and 50% volume. Scene Play reached 2.4 s with an active audio player; Pause held the clock; seeking with the visible ruler reached 5.0 s; Resume advanced to 5.3 s. Added Vorbis effect and music in the second scene, including a 1–5 s music trim, 40% volume and 0.5 s fades. Added the Opus effect to the third scene. The saved clip data retained these settings.
- **Episode Maker:** three 10 s, 15 s and 8 s scenes played as a 33 s episode with continuous MP3 music and scene-level Vorbis/Opus sounds. The captured browser mix contains the 220 Hz MP3 music throughout, 880 Hz MP3 effect near 2.5 s, 440 Hz Vorbis music in scene two, 660 Hz Vorbis effect in scene two, and 990 Hz Opus effect in scene three. The tone analysis in [audio-analysis.json](audio-analysis.json) measures the actual recorded output; 220 Hz is absent after the scene ends. Pause/resume, restart, seek to 10 s and 25 s scene boundaries, and seek to 30 s worked. A separate [post-seek capture](seek-past-effects.webm) contains only the episode music at 30 s, without re-triggering earlier effects. The browser reported zero active media players at the end and one during restarted music playback, with no duplicate players detected.
- **Backup and recovery:** exported Studio Backup v5 from the browser UI. It contained all five audio assets, all three scenes and the episode with their audio references. Every backed-up audio payload's SHA-256 matched its generated source file. Imported the downloaded JSON through the visible UI into a second empty isolated Chrome profile. All five restored assets were previewed successfully; the three scenes and episode were present. Cancelling deletion of an in-use Vorbis effect kept five assets. Confirming deletion removed that effect and its one scene clip while retaining the other four assets and their references. The warning named the affected scene and episode.
- **Browser diagnostics:** zero captured console errors or failed asset requests. Both isolated profiles were removed. Karl's regular browser profile and library were never opened.

The screenshot-frame [episode recording with sound](episode-with-audio.mp4) has H.264 picture and AAC audio, verified by FFprobe. It is a 5 FPS visual evidence recording assembled from browser screenshots and the browser's captured Web Audio graph. It is **not** a Studio video-export feature or a physical speaker loopback recording. The audio graph capture and decoded tone measurements prove sound output from Chrome's playback path; Karl should still listen during review on his device.

## Visual and sound evidence

- [Audio Library after imports](audio-library-desktop.png)
- [Scene audio timeline](scene-audio-timeline.png)
- [Episode audio timeline](episode-audio-timeline.png)
- [Restored Audio Library](backup-restored-audio.png)
- [Episode recording with sound](episode-with-audio.mp4)
- [Raw browser audio](browser-audio.webm), [preview audio](preview-audio.webm), [post-seek audio](seek-past-effects.webm)
- [Browser observations and codec probes](browser-results.json), [tone measurements](audio-analysis.json)

## Checks and limitations

- `npm test -- --run`: **65/65 passed**, 14 files.
- `npm run build`: **passed** (`tsc -b` and Vite production build).
- `node --check proofs/f2/browser-check.mjs`: **passed**.
- `git diff --check`: no whitespace errors; Git reported only Windows line-ending conversion notices.
- No production defect was found, so no production code or extra extension-only regression test was added. The browser test uses real encoded files and can be rerun to guard the full path.
- The automation uses Chrome's permissive autoplay flag so headless audio capture works; the app's visible Play and Preview controls were still clicked. User-gesture/autoplay behaviour in other browsers remains unverified.
- These test tones cover MP3, OGG/Vorbis and OGG/Opus with mono/stereo and short/long duration. They do not cover other OGG codecs, VBR/tag-heavy commercial files, every OS/browser combination or subjective sound quality.
- F4 remains open: a browser/process interruption between IndexedDB audio replacement and localStorage restore can leave the stores out of sync. This F2 run verified a normal complete restore, not cross-store crash recovery.

Karl's review is still required. Do not begin F3 or F4 on the strength of this report alone.

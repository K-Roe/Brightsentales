# M6.4 — Dialogue & Narration

17 October 2026. **IMPLEMENTED — AWAITING KARL'S BATCH REVIEW.** Technical verification only; Karl's listening and visual acceptance is pending.

## Implementation summary

Recorded speech and narration are now first-class Audio Library content. Existing M6.3 audio was not forked or duplicated; speech reuses the same asset store, clip model, timeline lanes, playback engine and Studio Backup path.

- **Import.** The Audio Library type selector gained **Speech & narration** alongside Music and Sound Effect. Import accepts the same genuine MP3, WAV and OGG files as before.
- **Attribution.** A speech clip carries an optional `speakerId`: `narrator`, `max`, `maxine`, or a `brightling-<uuid>` id. Scene clips can only be attributed to a Brightling actually placed in that scene; episode clips can be attributed to any character in the library. A saved attribution whose Brightling no longer exists is preserved and shown as `Missing Brightling (id)` rather than silently dropped.
- **Non-verbal Brightlings are preserved.** Speech is an optional audio lane. Characters with no clip remain silent and unaffected; nothing forces a mouth, pose or sprite change, and no AI voice generation exists anywhere in the app.
- **Timing, trimming and volume.** Speech uses the existing drag-to-place start, numeric start, trim From/To and volume controls. Speech is placed at 65% default volume rather than the 35% music default so voices stay audible under music.
- **No silently truncated dialogue.** A speech clip that would run past its scene or episode end is rejected at validation time and blocked at save time, with a visible warning in the clip inspector. Scene-level clips are additionally clamped at the scene boundary during episode playback so a repeated scene cannot over-run.

## Changed files

- `src/audio.ts`: `speech` kind, optional `speakerId` on `AudioClip`, speaker-id validation, speech boundary rule in `validAudioClip`.
- `src/AudioLibrary.tsx`: Speech & narration import type and labelling.
- `src/AudioPanel.tsx`: Voices lane, Add Speech control, speaker selector, over-run warning, speech default volume.
- `src/episodes.ts`: `speechFitsEpisode` episode-duration check.
- `src/EpisodeMaker.tsx`: episode speaker list and save-time dialogue-fit guard.
- `src/SceneMaker.tsx`: passes in-scene characters as the scene speaker list.
- `src/App.tsx`, `src/studioBackup.ts`: episode and backup validation include the dialogue-fit rule.
- `src/audio.test.ts`, `src/studioBackup.test.ts`: dialogue and backup coverage.
- `src/style.css`: Voices lane and speaker selector styling.
- `proofs/m6-4/`: acceptance script, results, screenshots, sound recording and video.

## Test results

Full suite: **74/74 passed** across 15 files; `npm run build` **passed** (56 modules, 354.02 kB JS / 41.30 kB CSS). Added coverage asserts speech/narration fit validation, unknown-speaker rejection, scene-dialogue offsetting for repeated scenes, episode narration retained across scene boundaries, and `speakerId` round-tripping through a version 5 Studio Backup.

## Browser evidence

Independently re-run in a disposable headless Chrome profile against the production build at `127.0.0.1:4177`. Full results in [browser-results.json](browser-results.json).

- Two genuine WAV speech fixtures (3.79s character line, 6.37s narration) generated locally as test input, ffprobe-confirmed `pcm_s16le` mono.
- Both imported as **Speech & narration** and shown in the library ([screenshot](audio-library-voices.png)).
- Character line attributed to Max, placed at 1.0s, trimmed from 0.2s, volume 60% in the scene ([screenshot](scene-dialogue.png)).
- Narration attributed to Narrator at episode 5.0s; no over-run warning raised ([screenshot](episode-narration.png)).
- Episode playback sampled at 1.0s, 5.3s, 7.5s and 10.9s — exactly one active audio player at each sample, spanning both scenes, and zero active players at 12.0s end.
- Captured output measured **mean −24.5 dB, max −5.9 dB over 13.56s**, confirming scheduled speech rather than silence.
- [Recording with sound](dialogue-episode.mp4) — H.264 + AAC stereo, 13.6s. Source capture [browser-speech.webm](browser-speech.webm).
- Reload preserved both clips with attribution intact.
- Studio Backup v5 export carried both speech assets and both `speakerId` values; import into a second **empty** profile restored both assets and both attributions ([screenshot](restored-voices.png)).
- Zero console errors, zero failed asset requests, both disposable profiles removed. Karl's normal browser profile and saved data were untouched.

## Known limitations

- Attribution is metadata only. There are no lip-sync, mouth-shape or talking animation changes; approved sprite art and animation timing were not modified.
- A character speech clip is valid only inside one scene. Continuous character speech spanning a scene change requires an episode-level clip, which is attributed at episode level rather than per scene.
- Only existing Audio Library file formats are accepted. No recording capture, text-to-speech, noise reduction or voice cleanup is implemented.
- The speaker selector lists characters, not per-scene placement, so a character not yet placed in a scene cannot be chosen as a scene speaker.
- Browser reload is used to simulate interruption; physical hardware and subjective audio quality on Karl's speakers remain unverified.

## What Karl needs to check personally

1. Import a real recorded voice as **Speech & narration** and confirm it is easy to find in the Audio Library.
2. Attribute a clip to a Brightling and to the Narrator; confirm the Voices lane and speaker control read clearly to a beginner.
3. Listen to [the recorded episode](dialogue-episode.mp4) and confirm speech timing, trim and volume feel right over music.
4. Confirm silence is preserved for characters with no clip.
5. Confirm the "runs past the end" warning is understandable when a clip is too long.

## Approval status

**AWAITING KARL'S REVIEW.** Technical verification is not Karl's approval.
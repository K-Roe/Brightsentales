# M6.3 Music and Sound Effects V1 — review evidence

## Implementation

- The new Audio Library imports browser-decodable MP3, WAV and OGG files, measures duration, previews them and stores their blobs in IndexedDB. Each file is limited to 20 MB. Unsupported or undecodable files show an error.
- Scene Maker and Episode Maker now have Music and Effects lanes below their existing visual editors. Clips can be added, selected, dragged, trimmed, given a start time and volume, and removed. Music has fade controls. Audio metadata is optional in the existing scene and episode records, so older records remain valid.
- Playback uses the existing scene and global episode clocks. Scene clips are offset into each episode scene occurrence. Episode music continues across scene boundaries. When episode music and scene music overlap, scene music plays at half its selected volume; effects retain their selected volume. Music defaults to 35%, effects to 65%.
- Studio Backup format 5 embeds the referenced local audio assets with SHA-256 checksums. Backup import validates records and file checksums before changing storage. Earlier version 4 and older backups remain accepted. The existing localStorage restore journal handles write failures there; IndexedDB audio changes are rolled back on a reported localStorage failure.
- `.gitignore` excludes M6.3 disposable profiles, generated test tones, browser downloads and intermediate frame/audio inspection files. Review screenshots, captured playback, source and this report remain visible to Git. No files were staged or committed.

## Browser verification

The browser script used two disposable Chrome profiles, both removed after the run. It imported four generated WAV files, saved three scenes (10 + 15 + 8 seconds) and one 33-second episode, added scene and episode clips, played the whole episode, paused, sought, restarted, exported a downloaded Studio Backup, and restored it through the UI in an empty second profile. It tested cancelling an in-use deletion, then confirmed deletion of the first scene's effect. The asset count fell from four to three and that scene's clip count fell from one to zero; the episode's independent music clip remained. The browser reported no console errors or failed asset requests. The resulting backup had four audio assets, three scenes and one episode; their clip counts were 1, 2, 0 and 1 respectively. The second profile restored all four assets and the same scenes and episode before the deletion test.

The recording contains captured browser audio, not a synthetic soundtrack. The test routes the page's HTMLAudioElements through Web Audio into a MediaRecorder. In the decoded capture, the 220 Hz episode music tone is present at 0.5, 11.5, 26 and 31 seconds; the 880 Hz first-scene effect appears around 2.4 seconds; the 440 Hz second-scene music and 660 Hz second-scene effect appear around 11.5 and 14.4 seconds; all are absent after the episode ends. A separate capture after seeking past both effects contains the 220 Hz music tone and no effect tones. Browser clock checks showed pause at 5.4/33 seconds, end at 33/33 seconds, seek to about 22 seconds, and restart from 0.6 seconds. Trim start was changed to 1 second and volume to 25% in the UI.

## Evidence files

- `audio-library-desktop.png` — imported assets and controls.
- `scene-audio-timeline.png` — scene audio lane and selected clip.
- `episode-audio-timeline.png` — episode audio lane under the three-scene sequence.
- `backup-restored-audio.png` — Audio Library after UI restore in the empty profile.
- `episode-with-audio.mp4` — 34.8-second browser picture and captured sound (H.264/AAC); playback ends at 33 seconds.
- `browser-audio.webm` — original recorded browser audio.
- `seek-past-effects.webm` — audio capture after seeking past both effects.
- `audio-analysis.json`, `browser-results.json` — frequency and browser workflow observations.
- `browser-check.mjs`, `analyze-audio.py` — reproducible isolated browser and audio checks.

## Automated verification

- `npm test -- --run`: 13 test files, 63 tests passed.
- `npm run build`: TypeScript and Vite production build passed.
- Existing approved sprite, outfit and background assets were untouched; Git status showed only application source, tests, `.gitignore` and this evidence directory changed.
- `.gitignore` checked with `git check-ignore`: disposable test tones and browser downloads are ignored; the review video is not ignored.

## Limits for Karl's review

- WAV was exercised in the browser. MP3 and OGG import are validated against the browser decoder but were not exercised with real files in this run.
- The sound evidence is a capture from Chrome's audio graph. Output through Karl's speakers or headphones and subjective mix quality still need human listening.
- Normal restore failures roll back both stores, but browser termination or power loss in the short interval between the IndexedDB audio replacement and the localStorage restore can leave their contents out of sync. A fresh backup remains the recovery path for that rare case; this is not a claim of cross-store crash atomicity.
- Large libraries depend on the browser's IndexedDB quota. A Studio Backup with embedded audio is larger than earlier backups. Keep the downloaded JSON outside browser storage.

M6.3 is implemented for review and remains pending Karl's approval.

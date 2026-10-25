# P3 audio transfer and sync — isolated review proof

**Integration addendum (2026-10-25):** Karl later explicitly authorised integration and continuous foundation development. The review stop recorded in this original proof is superseded. P3 merged and was pushed in Studio `main` (`2cc5a95d7b7f41b0072c9adddff9ecfc5652926b`) and Unity `cartoon-foundation` (`4041a103902bd333db8a4427699d812534e7afa0`), preserving history and the approved V1.1 branch. Post-merge Studio tests 298/298, service tests 12/12 and production build pass. Unity post-merge [audio Play Mode](unity-post-merge-audio-results.xml) and [Phase 2 regression](unity-post-merge-phase2-results.xml) passed 1/1 each. The original evidence below retains its exact scope.

**Status:** Core single-scene P3 audio path technically verified on 25 October 2026. P3 remains isolated; Karl has not visually or physically listened to and approved it. Cross-scene episode music continuity is still dependent on P4's episode clock. Do not merge P3 or begin P4.

## Baseline and implementation

Karl finally approved Studio 3.1 commit `b2218a86312b787220181b983feda083bf31f69d`. A clean, no-conflict, no-ff merge produced pushed `main` commit `1d9d1068f9258f8bbeac0b049f3fb8afe9422518`; its tree matched the approved branch. Main passed 295/295 Studio tests, 11/11 voice-service tests and the production build before P3 work began.

P3 uses new isolated `cartoon-foundation-p3-audio-sync` branches in Studio (`C:\Users\karlr\repos\BrightTalesP3Audio`, implementation commit `f06edfc42bb00701c927ad55385c30a4fae49830`) and Unity (`C:\Users\karlr\repos\BrightTalesP3Unity`, commit `9f940f3a6dc9aeab3ac1bc7508b37acdd1de0d94`). The Unity branch extends Phase 2's experimental saved-scene player; approved V1.1 and original artwork were not edited.

- Studio keeps `AudioAsset` blobs in its existing IndexedDB store and scene clips in `TimedScene.audio`. `studioAudioTransfer.ts` selects only referenced assets, checks metadata, sizes, duration and content hashes, then uploads raw bytes to the same-origin relay owned by `scripts/studio.cjs`.
- The relay keeps verified assets only in memory, with an unguessable retrieval address, 20 MB asset limit and 100 MB cache limit. Repeated uploads of the same ID/MIME/hash reuse a token. It rejects foreign-origin uploads, malformed IDs and hash mismatches. Restarting the launcher clears the cache. Media bytes are outside the Unity command JSON.
- `studioSceneBridge.ts` adds revisioned v3 audio metadata and clip start/trim/volume/fades. Scenes without audio still send the approved v2 shape. Clips extending beyond a scene are trimmed in this *preview payload*; saved clips do not change.
- The isolated Unity player downloads and hashes each referenced asset, decodes it before Play, and applies each clip on its existing scene clock. Missing, corrupt or undecodable media prevents Play with an explicit reason. Reset disposes sources. The existing Studio preview panel shows loading and the current bridge status.

## Verification

| Check | Result and evidence |
| --- | --- |
| Focused Studio bridge/transfer | 8/8 pass; binary transfer, deduplication, revisions, legacy v2 and missing/invalid asset handling. |
| Full Studio `npm test` | 42 files, 298/298 pass. |
| `npm run test:service` | 12/12 pass, including original voice-service lifecycle tests and new relay integrity/origin checks. |
| `npm run build` | Pass. Existing Vite 500 kB bundle-size advisory only. Built once with isolated bridge port 17844 for E2E proof and again with normal default settings. |
| Unity P3 Play Mode | [1/1 pass](unity-audio-playmode-results.xml): two WAV assets decode, saved speech/music start and independent volumes are measured; corrupt hash and missing file reject. |
| Unity Phase 2 regression | [1/1 pass](unity-phase2-regression-results.xml): saved scene actions, camera and reset/replay remain working. |
| Disposable browser | [All stages pass](browser-workflow-results.json): UI Audio Library import, timed music/speech clip editing, save, close/reopen, browser playback; no console errors or failed requests. Stable scene and clip IDs checked. |
| Browser → local relay → Unity | [Browser pass](unity-browser-e2e-results.json) and [Unity Play Mode 1/1 pass](unity-browser-playmode-results.xml). The browser uploaded exactly two assets outside scene JSON, then drove load/decode, play, status and reset through the existing bridge. At elapsed 1.500 s, Unity reported music volume **0.35** and edited speech volume **0.50** ([sample](unity-audio-sample.txt)); no browser errors or failed requests. |
| Review video | [Six-second browser editor playback](studio-audio-workflow.mp4), 1584×854, 30 frames, H.264. FFprobe measured 6.000 s and FFmpeg decoded the whole file without error. This is a review recording, not Unity export. |

The browser used a newly created Chrome user-data directory and generated disposable two- and three-second WAV tones imported through the visible Audio Library UI. It did not use Karl's normal browser profile or modify approved audio/art. The Unity Game view was not visually captured in this P3 proof; the automated Play Mode assertions observe actual decoded `AudioSource` objects and volumes. Listening quality and real recorded speech content require separate human review.

## Review media

- [Imported Audio Library assets](01-audio-library.png)
- [Saved scene music and speech timeline](02-scene-audio-timeline.png)
- [Browser playback after reopening](03-reopened-browser-playback.png)
- [Unity scene loaded with audio](04-unity-audio-loaded.png)
- [Unity bridge while the audio scene plays](05-unity-audio-playing.png)
- [Unity bridge after Reset](06-unity-audio-reset.png)
- [Editor walkthrough recording](studio-audio-workflow.mp4)
- Reproducible [browser authoring script](browser-workflow.mjs) and [browser-to-Unity script](unity-browser-e2e.mjs)

## Remaining P3 work and gate

The documented cross-scene music requirement cannot be fully exercised by the present single-scene Unity player; episode-level sequencing is P4. The current preview correctly stops at scene end without rewriting a longer saved music clip. MP3, OGG/Vorbis and OGG/Opus decoding in Unity were not tested in this run. Audio listening quality, the Game view's combined visual/audio presentation, and Karl's product approval remain pending. Existing Unity Bright Speak transfer, automatic Unity launch, embedded Game view and MP4 export are outside P3 and remain unsupported.

Stop at Karl's review. Do not merge P3 into main or start P4 without his decision.

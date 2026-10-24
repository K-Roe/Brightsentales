# BrightTales — Meet Max & Maxine: narrated V2

**Status:** Complete 84-second voiced review cut. **Not Karl-approved or published.** Karl must watch and listen to the whole file before either visual or narration acceptance is recorded.

## Deliverables

- [Complete narrated WebM episode](brighttales-meet-max-and-maxine-narrated-v2.webm) — 25,416,052 bytes; SHA-256 `036D1D8A1E54EB6E2A3807B7CDCD2182EE10135BE7681A771A91DC03ED91F3C2`.
- [Editable Studio Backup v8](brighttales-introduction-v2-studio-backup.json) — six original scene IDs, one original episode ID, 11 reusable narrator WAV assets, and a reusable BrightTales closing title; SHA-256 `6DCF6D04930D2CB9A23A1CE6274B378945A78680083CB4DB6FF4C0F6CBEA43B6`.
- [Eleven narration WAVs](narration/), [voice and script manifest](narration-manifest.json), [episode timing](timeline.json), [audio verification](audio-verification.json), [local speech recognition check](speech-recognition-check.json), [browser save/play/export results](browser-checks.json), and [decoded visual contact sheet](contact-sheet.png).

## Cause of V1 silence and production path

V1's Studio Backup had zero Audio Library assets and no scene audio clips. The V1 WebM contained an Opus stream, but it encoded silence. The existing pipeline itself was connected: Voice Maker creates `AudioAsset` records in the Audio Library; each scene holds timed `AudioClip` references; `episodePlaybackClips` offsets them on the production timeline; Episode Maker uses `useAudioPlayback` for browser playback and `renderTimelineVideo` to decode, mix and encode them into the WebM. No second voice or animation system was added.

The managed local service reported **ready**, owned by the Studio launcher, with **61 installed voices**. Voice Maker generated and saved every line in a disposable browser through its normal UI using Kokoro `bf_lily` at **0.90×** speed, selected as the most promising British female narrator from the earlier local Episode 1 voice comparison. Each original was retained separately as a WAV and as a named reusable Audio Library asset. Max has **no** spoken character line; all eleven clips are attributed to `narrator`.

The supplied V2 script says “Max's friend,” so that exact line was recorded. Earlier project material also calls Maxine his sister. This line is an editorial point for Karl to confirm; it does not alter the characters or V1 project.

## Scene plan and art preservation

| Section | Global time | Content |
|---|---:|---|
| Welcome | 0–10 s | Existing Living Room staging and individual front-facing waves; opening narration |
| Meet Max | 10–26 s | Approved Max bedroom, wave and solo walk; two narration lines |
| Meet Maxine | 26–36 s | Approved Maxine bedroom, wave and solo walk; one narration line |
| Bright Speak | 36–55 s | Existing visually accepted Max left-hand phone frames and three existing-style pop-ups: “I need help.”, “Bright Speak!”, and “Bright Speak helps kids talk.”; three narration lines |
| Together | 55–69 s | Approved Garden, original sprites and additional repetitions of the approved front-facing wave; two narration lines |
| Goodbye | 69–79 s | Approved house front, both wave; two narration lines |
| Closing title | 79–84 s | Existing static credits/title renderer over the same approved house-front background: “BrightTales”, “Meet Max & Maxine”, “See you soon!” |

Scene durations were set from the measured generated speech lengths with 0.8-second gaps between lines and at least **2.244 seconds** of scene margin after each final line. Solo walks retain V1's approved frames, destinations and five-second action length, then finish exactly at the scene cut so the known walk-to-idle snap is never shown. No original sprite, background, wave timing or phone artwork was modified. No rejected greeting, side-wave, sitting or Batch 3 action was used.

No particular music or effect recording has documented content approval for this cartoon, so V2 uses **narration only**. The reused credits/title feature is still separately awaiting Karl's broader roadmap review; this use is an explicit V2 review candidate, not an approval of that feature.

## Export, audio and playback verification

- The Studio UI restored the assembled Backup, listed all six scenes and the linked closing title, reopened the saved episode at **84 s**, exported the complete WebM, and exported a round-trip Studio Backup with all **11** speech assets. Browser result: **0 captured console errors and 0 failed requests**.
- Episode Maker's actual Play control created an audio player for the first narration clip. After 3.2 s, its audio clock had advanced to **2.30 s**, `paused=false`, `readyState=4`, volume **0.35**, and no media error. The browser episode player is therefore connected to the saved narrator assets.
- FFprobe/FFmpeg: VP9 **1672 × 941** video; Opus **48 kHz stereo** audio; **2,019** video frames ending at **84.104 s** and decoded audio through **84.120 s**. The full file decoded without errors; no video frame gap exceeded **0.2 s**.
- The final mono decoded audio has **−26.41 dBFS** overall RMS including silences, narration windows around **−24 to −25 dBFS** RMS, and **−3.18 dBFS** sample peak. No sample exceeds full scale. There is no competing music bed.
- [Per-line audio matching](audio-verification.json) compared each saved Voice Maker WAV to its expected window in the **exported WebM**, allowing for recording offset and Opus encoding. All **11/11** lines matched at correlation **0.9908–0.9926**, each beginning about **0.164–0.165 s** after its scheduled start; no narration clip reaches a scene cut. The local en-GB recognizer also returned an intelligible transcript from all **11 exported speech windows**. It confused some invented names and “BrightTales,” so its transcript is supporting evidence, not a substitute for Karl's listening review.
- I inspected decoded frames across every scene, all three Bright Speak messages, the together/goodbye shots and the title. Character identity, outfits, scale and floor placement remain visually consistent in those sampled frames. This is not a claim of human creative approval.
- Focused audio/episode/backup/voice tests: **28/28 passed**. Full frontend suite: **205/205 passed**. Voice service tests: **11/11 passed**. Python voice tests: **6/6 passed**. Production build: **passed** with the existing large-chunk advisory.

## Limits for Karl's review

- Lily's naturalness, warmth, accent and pronunciation of the brand names need Karl's complete listening review. Technical matching and local transcription establish audible, intelligible speech, not subjective voice approval.
- The script's “friend” wording follows this V2 brief while previous story records call Maxine Max's sister. Karl can settle that editorial wording after listening.
- The closing title uses the existing credits renderer. The cartoon has narration rather than a music bed because no specific music asset had recorded approval.
- This work changes saved production data and adds review evidence. It does not change application source, approved art, rejected actions or animation systems.

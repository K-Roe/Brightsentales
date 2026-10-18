# Batch review for Karl

Karl authorised sequential technical development with visual and listening acceptance deferred until the end of the current coding session. **No milestone in this batch is pre-approved.** Review each milestone individually. Technical verification and Karl's approval are recorded separately in [ROADMAP.md](ROADMAP.md) and [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Review checklist

| Milestone | Technical state | Karl's approval | Evidence | Karl should check |
| --- | --- | --- | --- | --- |
| F2 — MP3 and OGG | Implemented | **AWAITING KARL'S REVIEW** | [F2 report](../proofs/f2/REPORT.md) | Listen to the episode recording and try an MP3 and OGG in his own browser. |
| F3 — Documentation | Implemented | **AWAITING KARL'S REVIEW** | [F3 report](../proofs/f3/REPORT.md) | Confirm the guide is understandable and matches the Studio. |
| F4 — Backup reliability | Implemented | **AWAITING KARL'S REVIEW** | [F4 report](../proofs/f4/REPORT.md) | Review recovery behaviour after interrupted restore. |
| M6.4 — Dialogue and narration | Implemented | **AWAITING KARL'S REVIEW** | [M6.4 report](../proofs/m6-4/REPORT.md) | Listen to the recorded episode; check attribution and speech timing. |
| M6.5 — Intro Maker | Implemented | **AWAITING KARL'S REVIEW** | [M6.5 report](../proofs/m6-5/REPORT.md) | Check titles, styles and animation; listen to the intro recording. |
| M6.6 — Credits Maker | Implemented | **AWAITING KARL'S REVIEW** | [M6.6 report](../proofs/m6-6/REPORT.md) | Check credit readability, scrolling and the unsaved warning. |
| M6.6A — Music & sound studio | Implemented | **AWAITING KARL'S REVIEW** | [M6.6A report](../proofs/m6-6a/REPORT.md) | Listen to the instruments, effects and a rendered song. |
| M6.6B — Music Studio UI redesign | Implemented; song byte equality unresolved | **AWAITING KARL'S REVIEW** | [M6.6B report](../proofs/m6-6b/REPORT.md) | Compare dark/light screenshots, check the note editor and listen to the rendered song/effect. |
| UI Package A — Music Studio polish | Implemented; technical checks passed | **AWAITING KARL'S REVIEW** | [Package A report](../proofs/ui-package-a/REPORT.md) | Check the wide editor, collapse and note editing; listen to playback. |
| UI Package B — Global themes | Implemented; technical checks passed | **AWAITING KARL'S REVIEW** | [Package B report](../proofs/ui-package-b/REPORT.md) | Review all sections in Dark and Light and the shared appearance control. |
| Beginner Note Preview | Implemented; technical checks passed | **AWAITING KARL'S SPEAKER REVIEW** | [Note Preview report](../proofs/note-preview/REPORT.md) | Hear C4, switch instruments, add and drag notes, then check the preview volume and feel. |
| Voice Maker V1 | Implemented; technical checks passed | **AWAITING KARL'S MICROPHONE/SPEAKER REVIEW** | [Voice Maker report](../proofs/voice-maker/REPORT.md) | Record a voice, compare original/effects, listen to generated speech and the rendered scene in both themes. |
| Voice Maker V1.1 — automatic voice service | Implemented; technical checks passed | **AWAITING KARL'S REVIEW** | [V1.1 report](../proofs/voice-maker-v1-1/REPORT.md) | Open BrightTales normally, go to Voice Maker, confirm the engine says Ready without any second terminal, then generate a line and record his own voice. |
| Max Phone Interaction V1.2 | **Partially delivered; blocked on artwork** | **AWAITING KARL'S DECISION** | [V1.2 report](../proofs/max-phone-v1-2/REPORT.md) | Pop-up work is done and verified. The holding/tapping animation needs three new Max frames — see the decision question. |
| Max's Phone & Bright Speak V1 | Implemented; technical checks passed | **AWAITING KARL'S REVIEW** | [Phone report](../proofs/max-phone-v1/REPORT.md) | Watch the Max phone scene video: does the phone look held in his hand, is the pop-up clear, and does the device speaking read as Max communicating rather than talking? |
| M6.7 — Episode assembly | Not started | **AWAITING KARL'S REVIEW** | Pending `proofs/m6-7/` | Check the assembled production plays as one continuous piece. |

## Max Phone Native2D cut-out rig — built, proven, blocked

- **Built:** `scripts/build_max_rig.py` bakes approved `max-0.png` into 8 parts (torso, sleeves, hands, shoulder caps, head) plus `rig.json` with pivots, into `public/art/rig/max/`. Cut paths are explicitly authored anatomical polygons; head and hands use exact mask components. Approved PNGs are unmodified.
- **Proven:** the rest pose reconstructs the approved frame exactly (pixel diff is anti-aliasing only), arms rotate, hands stay attached after fixing their pivot, and phone-height poses are reachable by solved angles (+70.7 deg holding, -78.5 deg tapping). Waving needs no rig — approved wave frames swap in cleanly.
- **Blocked and reported, per Karl's gate:** raising an arm exposes empty armpit space, slices the hoodie star and tears the hood junction, because the artwork has no pixels behind the arms. Arms-behind-torso was tried and is worse. The rig is **not wired into the app**, `src/` is unchanged, and nothing is marked visually approved.
- **Unblock:** one additive "arms-removed torso" fill layer (new pixels only, no approved pixel changed), and optionally the pointing-hand asset.
- **Tests:** 184/184 and the production build pass; the app is unaffected. Close-up evidence of shoulders, hands and the star is in `proofs/max-phone-v1-3/`.

## Max Phone Interaction V1.2 — pop-up improvements, artwork blocked

- **Delivered and verified:** the Bright Speak pop-up is larger (235→348 px), nearer Max and the device (gap 130→42 px), with larger text (~24→~34 px) and a larger symbol (~64→~92 px). It is provably clear of the face and inside the frame at every position, asserted in tests. Message, device speech timing and fades are unchanged.
- **Blocked, and why:** the holding/tapping animation. The approved artwork has no holding or tapping pose (idle, five walk, three wave, per outfit; the sheets contain only those already extracted), the character pipeline only recolours existing frames, and the sibling Native2D repository holds a **different Max** — a pale-skinned, brown-haired, blue-hoodied 3D character whose own critique states it is "not recognisably Max". Posing that rig would redesign Karl's approved character, so nothing was changed there. Scripted arm re-posing in this repository was attempted three times and rejected as visibly unconvincing — the rejected frames are archived as evidence rather than shipped.
- **Specification:** three full-body 434×724 frames named `max-phone-hold.png`, `max-phone-tap-raise.png` and `max-phone-tap-touch.png`, described in the report. The renderer, timing, continuity, audio, export and Backup v8 are already ready to accept them.
- **Tests:** 184/184, 11/11 service tests, production build, and the full acceptance re-run with zero console errors all pass.
- **Karl's decision needed:** artwork route for the three frames — see the accompanying question. **Visual acceptance is not claimed.**

## Max's Phone & Bright Speak V1

- **Implementation:** Max can take out a phone, hold it, tap it and show a Bright Speak communication pop-up with a symbol and message while the **phone** speaks the line. Max stays non-verbal and nothing animates his mouth. The phone voice is chosen from saved Audio Library speech (generate it in Voice Maker first), starts a fraction after the tap, and carries no speaker attribution so it is never presented as Max's own voice. Scenes can start with the phone already in hand, so a held phone survives a shot change. Authored from the Scene Maker's **Phone & Bright Speak** director panel with sensible defaults; included in scene video export.
- **Scope honesty:** Brightlings in this project are whole-body sprite frames, not a rig, so this is a composited prop anchored at hand positions measured from the approved frames. Arms do not animate, and no new artwork was generated. The Native2D rig and Director named in the brief live in the sibling `BrightTales` repo, which is outside this project's working rules.
- **Changed files:** `src/phone.ts`, `src/phoneArt.ts`, `src/phone.test.ts`, `src/scenePreview.ts`, `src/timedScenes.ts`, `src/SceneMaker.tsx`, `src/studioBackup.test.ts`, `src/style.css`, documentation and `proofs/max-phone-v1/`.
- **Also fixed:** the Scene Maker kept a duplicate copy of the scene drawing loop, so the editor preview could not show what the exporter rendered. It now calls the shared `drawScenePreview` and adds only its selection ring.
- **Tests:** 183/183 across 23 files, 11/11 service lifecycle tests, 5/5 Python audio tests and the production build passed. The earlier Voice Maker flow and the ten-section regression smoke still pass with zero console errors.
- **Browser evidence:** [report, stage frames, exported WebM and decoded video frames](../proofs/max-phone-v1/REPORT.md).
- **Limits:** no arm/hand animation or "look at phone" pose until new artwork is approved; the far hand in one walking frame has no visible artwork so the phone is not drawn there; phone interactions are not yet on timeline lanes; one phone per Brightling at a time; the acceptance scene uses the Living Room because no kitchen background is approved.
- **Karl's check:** watch `proofs/max-phone-v1/max-asks-for-food.webm` and judge the phone against Max's hand and the pop-up's readability; then build a two-scene sequence and use "Start this shot with the phone already in hand" to check the continuity feels natural.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## Voice Maker V1.1 — automatic voice service management

- **Implementation:** The manual `py -3.12 voice_local.py` step is gone. `scripts/studio.cjs` is now the single launcher for both `npm run dev` and `npm start`, serves the app, and owns `scripts/voice-lifecycle.cjs`, which adopts an already-running compatible service or starts `voice_local.py` as its own child, polls a versioned health endpoint for real readiness, recovers from crashes within a bounded budget, offers Retry, and stops only the child it owns through a per-launch owner token. Voice Maker shows Starting, Ready, Unavailable and Error with a plain-English reason and a Retry button. Existing Voice Maker V1 features, Music Studio, scenes, saved projects and Backup v8 are unchanged.
- **Changed files:** `scripts/studio.cjs`, `scripts/voice-lifecycle.cjs`, `voice_local.py`, `src/VoiceMaker.tsx`, `src/voiceApi.ts`, `test_voice_service.cjs` (new), `package.json`, `vite.config.ts`, documentation and `proofs/voice-maker-v1-1/`.
- **Tests:** 156/156 frontend tests, 11/11 new service lifecycle tests, production build and the existing Python audio tests passed. Isolated Chrome ran the full Voice Maker workflow — Ready with no manual step, real Piper speech, effect edit, save, a 2.46 s microphone recording, its edited save and reload persistence — against both the production and development launches with zero console errors, and showed a plain error plus Retry when the interpreter was deliberately broken. Duplicate launch, a killed service, port fallback and cross-origin refusal were checked live.
- **Defects fixed in verification:** a second launcher could start a duplicate service on the same port while the owner restarted; a single slow health answer could be misread as a crash and wrongly report "stopped repeatedly"; stale messages still told users to start `voice_local.py`.
- **Browser evidence:** [V1.1 report, screenshots and results](../proofs/voice-maker-v1-1/REPORT.md).
- **Limits:** Python, FFmpeg and the voice models are not bundled, so a clean machine reports the missing dependency and a Retry button while the rest of the Studio keeps working. Ctrl+C shutdown is covered by automated manager tests rather than a real Ctrl+C. Two open windows share one service. Music Studio's starter-tune panel did not appear in a fresh automated profile, so a full browser music render was not re-verified (the audio code is unchanged and its tests pass).
- **Karl's check:** Open BrightTales the normal way, go to Voice Maker, watch it reach Ready with no PowerShell window, generate a line, record his own voice, edit and save it, then close and reopen BrightTales and do it again.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## F2 — real MP3 and OGG compatibility

- **Implementation:** No production code change. Tested genuine FFmpeg-encoded MP3, OGG/Vorbis and OGG/Opus in disposable Chrome profiles.
- **Changed files:** F2 evidence under `proofs/f2/`; roadmap/status and evidence ignore rules in `.gitignore`.
- **Tests:** 65/65 Vitest tests and production build passed. Chrome 155 imported/previews all five samples, retained them in IndexedDB, played scheduled scene and episode sounds and restored them through Studio Backup in a second empty profile. Zero console errors and failed assets; both profiles removed.
- **Browser evidence:** [Screenshots, captured playback with sound and observations](../proofs/f2/REPORT.md).
- **Limits:** Physical speaker playback and other browsers unverified. F4 still needs cross-store crash recovery.
- **Karl's check:** Listen to [the recorded episode](../proofs/f2/episode-with-audio.mp4) and try representative MP3/OGG files on his machine.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## F3 — documentation

- **Implementation:** Audited current source, updated README and continuity instructions, and added a [Studio user guide](USER_GUIDE.md).
- **Changed files:** `README.md`, `AGENTS.md`, `docs/ROADMAP.md`, `docs/PROJECT_STATUS.md`, `docs/BATCH_REVIEW.md`, `docs/USER_GUIDE.md`, and `proofs/f3/`.
- **Tests:** 46 local documentation links valid; 65/65 tests and production build passed. Isolated Chrome opened all six sections with no console or asset errors and no saved data; the disposable profile was removed.
- **Browser evidence:** [Screenshot and observations](../proofs/f3/REPORT.md).
- **Limits:** Navigation smoke does not re-accept every editor workflow.
- **Karl's check:** Read the user guide as a new user and flag any unclear or inaccurate instruction.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## F4 — backup reliability

- **Implementation:** Audio replacement and its old-library snapshot now commit atomically in IndexedDB. A localStorage marker coordinates recovery before the app mounts; pending restores roll back and committed restores finish cleanup.
- **Changed files:** `src/audioStore.ts`, `src/restoreCoordinator.ts`, `src/studioBackup.ts`, `src/App.tsx`, `src/main.tsx`, `src/restoreCoordinator.test.ts`, documentation and `proofs/f4/`.
- **Tests:** Full suite and build passed. Isolated Chrome recovered after three interruption points with real MP3/OGG assets and episode references. A normal Studio Backup UI export and fresh-profile restore passed with five real audio assets; zero console/asset errors.
- **Browser evidence:** [F4 report, screenshot and recordings](../proofs/f4/REPORT.md).
- **Limits:** Browser reload simulates interruption; hardware power loss and persistent storage failure remain outside the test. The audio snapshot temporarily needs additional quota.
- **Karl's check:** Review the restored library and episode, and confirm the failure message is clear if storage cannot recover.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## M6.6B — Music Studio UI redesign

- **Implementation:** Dark and light themes scoped to Music Studio, with dark as the default and a locally saved preference; illustrated inline SVG instrument/effect cards, three piano-roll zoom levels, named drum rows, styled overlays/forms/scrollbars/tooltips, large transport and replacement confirmation. The M6.6A synthesis and saved-song/Backup v8 formats were preserved. Beat Blocks remain deferred to M7.0; M6.7 was not started.
- **Tests:** 147/147 Vitest tests and production build passed. Isolated Chrome checked song/effect editing and previews, Audio Library export/replay, both themes, focus and reduced motion, narrow layout and a fresh-profile Backup v8 restore with zero console/asset errors.
- **Audio boundary:** The effect rendered byte-identically before/after. The song failed the requested SHA-256 equality check; 278/1,023,120 PCM samples differed by one 16-bit step, and two runs of the redesigned build also differed. No audio engine code was changed. See [comparison and screenshots](../proofs/m6-6b/REPORT.md).
- **Karl's check:** Review the [dark piano roll](../proofs/m6-6b/05-note-added-dark.png), [dark drum roll](../proofs/m6-6b/03-drum-track-dark.png), [light piano roll](../proofs/m6-6b/14b-roll-light.png), [light effects](../proofs/m6-6b/13-effects-light.png) and the full M6.6B report. Visual and listening acceptance is pending.

## M6.6A — Music & Sound Effects Studio

- **Implementation:** New **Music Studio** extending the Audio Library. A multi-track piano roll (click to add, drag to move, drag the edge to resize, delete) with eight locally synthesised instruments, tempo, bars, looping, master volume, per-track volume/pan/mute/solo, and a soft limiter that is transparent below a 0.7 threshold. Seven sound-effect presets built from oscillators, deterministic noise and envelopes, with pitch, length, volume, decay and a noise toggle. Beginner starter melodies and drum patterns. Finished songs and effects render to 16-bit PCM WAV and become ordinary Audio Library assets.
- **Architecture:** No new playback engine. Rendered audio is a standard `AudioAsset` played by the existing clock in scenes, episodes, intros and credits; the in-studio preview plays the same rendered bytes through an `HTMLAudioElement`. Rendering uses `OfflineAudioContext` at a fixed sample rate with a seeded noise source, so the future video exporter can re-render identical audio. Everything is local and offline.
- **Backup change:** Studio Backup is now **version 8** with editable music projects; versions 1–7 remain readable and restoring an older backup keeps existing projects rather than clearing them. The F4 restore journal is extended to version 7.
- **Changed files:** `src/wav.ts`, `src/instruments.ts`, `src/musicProject.ts`, `src/musicRender.ts`, `src/musicAssets.ts`, `src/MusicStudio.tsx`, `src/previewPlayer.tsx`, `src/studioBackup.ts`, `src/App.tsx`, `src/musicProject.test.ts`, `src/style.css`, `.gitignore`, documentation and `proofs/m6-6a/`.
- **Tests:** 147/147 across 18 files (32 new) and production build passed; 80 doc links valid. Isolated Chrome created an original three-instrument song (Piano 7 notes, Bass 9 notes, Drums 4 notes) and a custom effect through the real UI, with real captured browser audio at mean ≈ −31 dB / peak ≈ −8 dB both in-studio and through the existing Audio Library. Mixer mute/solo, save/reload/edit and a v8 backup round-trip into an empty profile all passed, and the restored song replayed audibly. Piano roll drawing was verified by reading canvas pixels. Zero console/asset errors; both profiles removed; exit code 0.
- **Defects fixed in verification:** drum notes were drawn outside the visible pitch range so drum tracks always looked empty (range now starts at MIDI 36 and the roll auto-scrolls); the auto-scroll then needed the note count as a dependency; the soft limiter was boosting quiet mixes ~31% (now transparent below threshold, with a test); and the studio layout clashed with existing Scene Maker styles.
- **Limits:** imported/previously rendered audio cannot be layered inside the studio — the mixer mixes the project's own instrument tracks (combining generated and imported audio with trim and fades is done via the existing Audio Panel in scenes, intros, episodes and credits). Instruments are synthesised approximations, not samples. Generated WAVs are uncompressed (~1.9 MB for 11.2s stereo). Capped at 12 tracks, 64 bars, 2000 notes per track; the roll shows MIDI 36–84; no per-track meters or loop-region selection.
- **Karl's check:** Build a song from the starters, listen to all eight instruments and the effect presets, mix two tracks, then render and place the result in a scene, intro or credits. Confirm the instruments and effects sound acceptable as cartoon music and sound.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## M6.6 — credits maker

- **Implementation:** New **Credits** Studio section producing reusable end credits: add/edit/delete/reorder credit lines with optional headings and roles, one-tap heading suggestions, Static or Scrolling presentation, adjustable duration and scroll speed, automatic slowing so the last credit always ends on stage, a place background, Audio Library music, preview, save/reopen/duplicate/delete, and unsaved-edit protection. Credits are presented through the same scene renderer and audio clock as scenes and intros, so the app still has one animation engine.
- **Backup change:** Studio Backup is now **version 7** with a `credits` field; versions 1–6 remain readable, and restoring an older backup keeps existing credits rather than clearing them. The F4 restore journal is extended to version 6, and the restore confirmation now reports credits and intros.
- **Changed files:** `src/credits.ts`, `src/CreditsMaker.tsx`, `src/scenePreview.ts`, `src/studioBackup.ts`, `src/App.tsx`, `src/Characters.tsx`, `src/credits.test.ts`, `src/style.css`, `.gitignore`, documentation and `proofs/m6-6/`.
- **Tests:** 112/112 across 17 files and production build passed. Isolated Chrome verified four credit lines built through the UI, reorder, credits music on the credits clock, static and scrolling playback each with one active player and captured sound at mean −28.6 dB / max ≈ −12 dB, visible upward scroll between 2.5s and 5.5s, save/reload retention, the unsaved-edit guard, and a v7 backup round-trip into an empty profile. Zero console/asset errors; both profiles removed.
- **Defect fixed in verification:** the layout counted one row per credit line while the renderer draws a heading and a name row, so long credits scrolled with wrong timing maths. Row counting now matches the renderer.
- **Browser evidence:** [M6.6 report, screenshots and recordings](../proofs/m6-6/REPORT.md).
- **Limits:** Text only — no fonts, per-line colours, logos, images or line animations. Uniform scroll speed with no easing. Line height shrinks automatically on very long lists. Credits show no Brightlings and are not yet attached to an episode.
- **Karl's check:** Create credits, try Static and Scrolling, and listen to [the recorded credits](../proofs/m6-6/scroll-credits.mp4). Confirm text size and readability over the artwork, that the heading suggestions cover what he wants, and that the unsaved-changes warning feels right rather than annoying.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## M6.5 — intro maker

- **Implementation:** New **Intros** Studio section producing reusable opening titles: series and episode titles, Plain or Banner style, an approved place background, Brightling entrance actions on the existing visual timeline, Audio Library music, preview, save, duplicate/delete and stable-ID reuse. An intro is modelled as a timed scene plus title text, so it reuses the existing animation engine, Canvas renderer, audio lanes and playback clock instead of adding a parallel engine. Approved artwork and animation timing were not modified.
- **Backup change:** Studio Backup is now **version 6** with an `intros` field; versions 1–5 remain readable, and restoring an older backup keeps existing intros rather than clearing them. The F4 restore journal was extended to version 5 so an interrupted intro restore rolls back with everything else.
- **Changed files:** `src/introductions.ts`, `src/IntroMaker.tsx`, `src/scenePreview.ts`, `src/studioBackup.ts`, `src/App.tsx`, `src/introductions.test.ts`, `src/style.css`, `.gitignore`, documentation and `proofs/m6-5/`.
- **Tests:** 89/89 across 16 files and production build passed. Isolated Chrome verified titles and Banner rendering, both Brightlings with a Wave action, music scheduling, four playback samples with one active player until the 7.36s music ended, captured sound at mean −29.7 dB / max −12.1 dB, reload retention, and a v6 backup round-trip into an empty profile. Zero console/asset errors; both profiles removed.
- **Defect fixed in verification:** titles originally faded in from zero opacity, so a saved intro opened on a blank stage. Titles are now visible from the first frame and only ease out at the end.
- **Browser evidence:** [M6.5 report, screenshots and recording](../proofs/m6-5/REPORT.md).
- **Limits:** Titles are plain canvas text — no fonts, letter animation, logos or per-line styling. No lip-sync. The intro action palette omits Disappear, so a character cannot walk off during an intro. Length capped at 600s, titles at 120 characters. No per-intro outfit override.
- **Karl's check:** Create an intro, try both title styles, and listen to [the recorded intro](../proofs/m6-5/intro-playback.mp4). Confirm the titles are the right size and position over the Living Room, and that the action choices are enough.
- **Approval status:** **AWAITING KARL'S REVIEW**.

## M6.4 — dialogue and narration

- **Implementation:** Speech & narration became a first-class Audio Library type reusing the existing asset, clip, timeline, playback and backup path. Clips carry an optional speaker (`narrator`, `max`, `maxine` or a `brightling-<uuid>`), gained a Voices lane and speaker selector, and use a speech-aware default volume. A voice clip running past its scene or episode end is warned about, rejected on save and clamped at scene boundaries, so dialogue is never silently truncated. Characters without a clip stay silent and unaffected; no sprite, animation timing or AI voice was introduced.
- **Changed files:** `src/audio.ts`, `src/AudioLibrary.tsx`, `src/AudioPanel.tsx`, `src/episodes.ts`, `src/EpisodeMaker.tsx`, `src/SceneMaker.tsx`, `src/App.tsx`, `src/studioBackup.ts`, `src/audio.test.ts`, `src/studioBackup.test.ts`, `src/style.css`, documentation and `proofs/m6-4/`.
- **Tests:** 74/74 across 15 files and production build passed. Independently re-run in isolated Chrome against the production build: two genuine WAV voice fixtures imported, Max dialogue trimmed and placed in a scene, episode narration spanning both scenes, four playback samples each with exactly one active player and zero at the 12.0s end, captured speech at mean −24.5 dB / max −5.9 dB over 13.56s, reload retention, and Studio Backup v5 round-trip into an empty profile preserving both attributions. Zero console and asset errors; both profiles removed.
- **Browser evidence:** [M6.4 report, screenshots and recording](../proofs/m6-4/REPORT.md).
- **Limits:** Attribution is metadata only — no lip-sync or talking animation. Character speech must sit inside one scene; cross-scene character speech needs an episode-level clip. No in-app recording, text-to-speech or voice cleanup. Browser reload simulates interruption; subjective audio quality is unverified.
- **Karl's check:** Import a real recorded voice as Speech & narration, attribute it to a Brightling and to the Narrator, then listen to [the recorded episode](../proofs/m6-4/dialogue-episode.mp4) for timing, trim and volume over music.
- **Approval status:** **AWAITING KARL'S REVIEW**.

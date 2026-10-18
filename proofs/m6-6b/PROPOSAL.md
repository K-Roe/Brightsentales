# M6.6B — Music Studio UI redesign: proposal for approval

17 October 2026. **PROPOSAL ONLY — no implementation has started.** M6.6A is implemented, verified and committed at `20e2d14` and is untouched by this document.

## Goal

Make the Music Studio feel like a BrightTales cartoon music room while every M6.6A audio feature keeps working, byte for byte.

## What the redesign will not do

No changes to the composition model, the eight instrument generators, sound-effect synthesis, the 44100 Hz `OfflineAudioContext` render, the seeded noise source, the mixer maths, the soft limiter, saved-data schemas, Studio Backup v8, or any existing audio playback path. No second audio engine and no audio-file timeline. M6.7 is not started.

## Design language

Reusing the existing BrightTales tokens so the studio feels native rather than bolted on:

| Role | Token already in the app |
| --- | --- |
| Primary purple | `#7164db`, tints `#eeeaff` / `#f0edff` |
| Teal | `#55cda4`, `#277e85`, tint `#e7f6f5` |
| Sky | `#edf4fb`, `#eaf6fb` |
| Yellow | `#ffd76a` / `#ffe89a` (already used in credits) |
| Coral | `#ec67aa` (already used for `h1 em`) |
| Panels | `#fff`, border `#e9eaf0`, radius 20–22px, shadow `0 12px 36px #353d7212` |
| Type | Segoe UI 900 headings, `letter-spacing:-.055em` on hero text |

Each instrument gets one stable colour that tints its card, its note blocks and its mixer strip, so a beginner tracks "the blue thing" rather than reading names.

## Layout proposal

### A. Song header

One rounded panel: **← All Songs**, editable song name (large, friendly), a **Saved / Unsaved** pill, then two clearly separated actions — **Save Song** (outlined purple) and **Add to Audio Library** (solid coral, labelled "Finish & use it"). The two are visually distinct so a beginner does not think saving exports audio.

### B. Playback bar

A wide pastel panel with a large circular **Play/Pause** and **Stop**, a progress bar with a **moving playhead**, plus Tempo (BPM), Bars, Loop toggle and Master volume. Tempo and Bars become large stepper-style steppers instead of small number boxes.

**Playhead implementation:** the preview already plays a rendered WAV through one `HTMLAudioElement`. The playhead reads `element.currentTime` on `requestAnimationFrame` — UI only, no audio change.

### C. Instrument cards

The current form-like rows become cards: large instrument icon on a tinted disc, instrument name, note count, colour swatch, volume and pan sliders, and **M / S / Remove** as friendly toggles. Selected card is raised with a coloured ring. A large **+ Add Instrument** button opens a friendly picker overlay showing all eight instruments as illustrated tiles.

Icons will be inline SVG (no image assets, no downloads) — small, colourable, and consistent with the rest of the app.

### D. Music editor

The piano roll is redrawn:

- A **visible piano keyboard** on the left (90px wide) with labelled keys; clicking a key previews that pitch on the current instrument.
- Drum tracks show **real drum names** (Kick, Snare, Closed Hat, Open Hat, Tom) instead of misleading C2/B2 labels.
- Bar numbers on a header strip, beat lines, and **bar shading** for orientation.
- Notes tinted with the **instrument colour**; velocity shown as a fill bar; selected note outlined.
- **Zoom control** (Compact / Normal / Big) scaling beat width, plus horizontal and vertical scrolling.
- **Playhead** line moving during playback.
- Auto-scroll to the selected track's notes, retaining the M6.6A fix.

Current constants (`BEAT_WIDTH 46`, `ROW_HEIGHT 18`, MIDI 36–84) become zoom-driven; the 36–84 window that fixed the M6.6A drum bug is preserved.

### E. Beginner melody tools

The four starters and three drum patterns become preset cards with a one-line description ("a bright bouncing tune") and a **Preview** button that auditions the phrase. Applying a preset when the track already has notes asks first, in plain language, whether notes will be **replaced** — this addresses the current ambiguity where a starter silently overwrites notes.

### F. Sound Effects Maker

The seven effects become illustrated cards (Footstep, Pop, Bounce, Sparkle, Whoosh, Bell, Cartoon transition) with a preview on the card. Selecting one opens the existing pitch, length, volume, decay and noise controls in the same playful style. Synthesis code is untouched.

### G. Mixer

Each track gets a clearly labelled volume slider with a value, a pan control marked L/R, and Mute/Solo. A master strip shows the master volume. **No auto-gain and no change to rendering output** — the transparent soft limiter is untouched, and I will not add per-track meters that would imply normalisation.

### H. Beginner experience

- Empty states with an illustration and one instruction ("Press **+ Add Instrument** to start").
- A numbered 8-step beginner path strip in the library view, matching the brief's workflow.
- Contextual hints under each panel.
- Advanced controls (pan, velocity, decay) stay available but visually quieter than the primary action.

### I. Beat Blocks (design only, no engine)

Requested as design only. The existing note model **can** support a block view without touching audio generation: a step sequencer is just notes with `start` on a grid, `duration` = one step, and `pitch` mapped to a block row. `scheduleNote` and therefore the rendered output would be identical.

**Recommendation:** implement it as a separate milestone with its own approval, not inside M6.6B, and treat the existing M7.0 BrightBeats entry as the place for it rather than duplicating it. **Karl's decision required** — I will not build Beat Blocks in this milestone.

## Files to change

| File | Change |
| --- | --- |
| `src/MusicStudio.tsx` | Rewrite of layout and interaction only. No audio or model code. |
| `src/musicDesign.ts` | **New.** Instrument/effect colour + icon tokens and inline SVG icons. No logic. |
| `src/previewPlayer.tsx` | Expose playback position for the playhead; no playback change. |
| `src/style.css` | New `.music-*` block appended; existing rules and other sections untouched. |

Not changed: `musicProject.ts`, `instruments.ts`, `musicRender.ts`, `musicAssets.ts`, `wav.ts`, `audio.ts`, `audioPlayback.ts`, `audioStore.ts`, `studioBackup.ts`, `App.tsx`.

## Verification plan

1. `npm test -- --run` — must stay **147/147**; no test changed to make it pass.
2. `npm run build`.
3. **Rendered audio must not change.** Render the M6.6A acceptance song from `proofs/m6-6a` before the redesign, record its SHA-256, then render the identical project after and compare byte for byte.
4. **Legacy data check.** Reopen the M6.6A song saved by the existing acceptance run in the redesigned UI and confirm it displays and edits correctly.
5. **Browser acceptance** covering the brief's list: multi-instrument song, add/move/resize/delete notes, key preview, play/pause/stop/loop, mute/solo/volume/pan, save/reload/edit, export to Audio Library and replay, sound effect create/save, Studio Backup v8 round-trip.
6. **Accessibility:** keyboard traversal and visible focus rings; reduced-motion honoured via a `prefers-reduced-motion` block that disables the playhead glide and card transitions.
7. Zero console errors; disposable profiles removed; before/after screenshots.

## Open decisions for Karl

1. **Beat Blocks** — leave out of this milestone and fold into M7.0, as recommended?
2. **Icons** — inline SVG (recommended, no assets) or skip icons and use colour only?
3. **Zoom** — include Compact/Normal/Big from the start, or ship Normal only and add zoom later?

On approval I will implement only the agreed items above and report files changed, before/after evidence, test and browser results, limitations, and anything that needs a scope decision.
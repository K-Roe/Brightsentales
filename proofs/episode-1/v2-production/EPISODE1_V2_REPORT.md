# BrightTales Episode 1: Meet Max — V2 Production Report

**Date:** 2026-10-19  
**Duration:** 173 s  
**Resolution:** 1672×941  
**Format:** VP9 + Opus stereo 48 kHz WebM  
**Deliverables folder:** `proofs/episode-1/v2-production/`

## Files Delivered

| File | Purpose |
|------|---------|
| `BrightTales-Episode-1-Meet-Max-V2.webm` | Final playable episode video |
| `BrightTales-Episode-1-Meet-Max-V2-studio-backup.json` | Editable Studio Backup v8 |
| `export-v2-results.json` | Browser-automation export log |
| `export-v2-ui.png` | UI screenshot at export time |
| `frame-003s.png` … `frame-165s.png` | Representative verification frames |

## What Changed from V1

1. **Grounded characters**  
   - Added `src/spriteGrounding.ts` with measured foot anchors for every approved Max/Maxine idle, side and wave frame.
   - Renderer now draws each sprite so the measured foot sits on the floor shadow, removing the floating look.
   - Shadows are drawn exactly at the foot point.

2. **Improved walking**  
   - Added per-character stride (`max` 56 px, `maxine` 62 px) and a repeating contact cycle `[1,2,3,2]`, reducing the sliding effect.

3. **Reusable action library**  
   - New `ActionType`s: `breathe`, `point`, `nod`, `shake`, `smile`, `surprise`, `clap`, `react`, `turn`.
   - Implemented as transform-based expressions in the shared renderer so they work in preview, playback and export.
   - Added Studio UI controls and timeline styling for the new actions.

4. **Bright Speak named and explained**  
   - All UI labels now say "Bright Speak" instead of "phone".
   - Scene 3 narration explains that Max uses Bright Speak to share what he wants and needs.

5. **Maxine is Max's sister**  
   - Narration updated across all scenes.
   - Credits list Maxine as a character.

6. **Maxine has a voice**  
   - Provisional friendly British voice `Emma` (`kokoro:bf_emma`).
   - Spoken lines in Scene 2 ("Hi everyone! I'm Maxine."), Scene 5 ("This is fun, Max!") and Scene 6 ("Goodnight, everyone!").
   - Max remains non-verbal; Bright Speak provides his "I'm hungry!" message.

7. **More alive scenes**  
   - Each scene now interleaves narration with breathing, waves, points, nods, smiles, claps, reactions, walks and turns to reduce silent standing gaps.

## Audio Assets

| Asset | Voice | Text |
|-------|-------|------|
| Narrator | Lily (`kokoro:bf_lily`) | Full narration across six scenes |
| Maxine | Emma (`kokoro:bf_emma`) | Three reaction/greeting lines |
| Bright Speak | George (`kokoro:bm_george`) | "I'm hungry!" |

All WAVs were generated locally via `voice_local.py` and embedded in the Studio Backup.

## Verification

```
ffprobe video packets: last ~173.091 s
ffprobe audio packets:  last ~173.127 s
ffmpeg volumedetect:    mean_volume: -22.0 dB, max_volume: -1.4 dB
npm test -- --run:      189/189 passed
npm run build:          passed
```

## How to Re-Export

1. Start the production Studio: `npm start`
2. Open the Characters tab.
3. Choose **Restore Studio Backup** and select `proofs/episode-1/v2-production/BrightTales-Episode-1-Meet-Max-V2-studio-backup.json`.
4. Open the Episodes tab, select **Meet Max — Episode 1 V2**, and click **Export Episode Video**.

## Notes and Limitations

- Maxine's speaking voice is provisional; replace with a final cast voice if requested.
- Expression actions are transform-based on approved sprites; they do not add new hand-drawn artwork.
- The original V1 first cut remains untouched at `proofs/episode-1/final-production/`.

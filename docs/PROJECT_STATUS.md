# BrightTales Project Status

**Project:** BrightTales — Animated 2D Children's Series  
**Studio:** BrightSenAppsTales  
**Current Gate:** Episode 1 — Meet Max V2 (improved cut delivered for Karl and Astra review)  
**Last Updated:** 2026-10-19

## Current Milestone

M6.8 — Episode 1 V2 improvements (grounding, actions, Bright Speak, sister, Maxine voice).

- Status: Completed
- Deliverable: `proofs/episode-1/v2-production/BrightTales-Episode-1-Meet-Max-V2.webm`
- Editable backup: `proofs/episode-1/v2-production/BrightTales-Episode-1-Meet-Max-V2-studio-backup.json`
- Next: Await Karl and Astra's review of V2.

## Previous Milestone

M6.7 — Deliver Episode 1 first cut to Karl and Astra for review.

- Status: Completed
- Deliverable: `proofs/episode-1/final-production/BrightTales-Episode-1-Meet-Max.webm`
- Note: Original first cut preserved unchanged under `proofs/episode-1/final-production/`.

## Active Work

- None. Awaiting creative review.

## Blocked

- None.

## Recent Changes Summary

1. **Grounding fix** — measured foot anchors for all approved Max/Maxine sprites; characters now stand on the floor with aligned shadows.
2. **Walking improvement** — per-character stride and repeating contact cycle reduce sliding.
3. **Reusable action library** — added `breathe`, `point`, `nod`, `shake`, `smile`, `surprise`, `clap`, `react`, `turn` actions available in the Studio scene workflow.
4. **Bright Speak naming** — all UI labels and phone interactions now call the device Bright Speak.
5. **Maxine is Max's sister** — narration and credits updated.
6. **Maxine voice** — added friendly British `Emma` voice with spoken lines in Scenes 2, 5 and 6.
7. **More alive scenes** — V2 scenes include more frequent gestures, reactions, walks and turns during narration to reduce dead gaps.

## Verification

- `npm test -- --run`: 189/189 passed.
- `npm run build`: passed.
- Exported V2 video: 173 s, VP9 + Opus stereo 48 kHz, mean volume −22.0 dB, max volume −1.4 dB.

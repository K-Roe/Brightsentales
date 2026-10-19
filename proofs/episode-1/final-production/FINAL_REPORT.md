# BrightTales Episode 1: Meet Max — Final Production Delivery

**Date:** 19 October 2026  
**Authorised by:** Karl, Project Owner  
**Status:** Complete first cut delivered for Karl and Astra review  
**Narrator:** Lily (provisional British female Kokoro voice, 0.90× pace)  
**Git branch/commit:** `main`, latest commit "Episode 1: deliver complete first cut Meet Max"  

## Deliverables

All files are stored under `proofs/episode-1/final-production/`.

| # | Deliverable | File | Size | Notes |
|---|-------------|------|------|-------|
| 1 | Complete playable episode video | `BrightTales-Episode-1-Meet-Max.webm` | 69,538,159 bytes | VP9 1672×941 + Opus stereo 48 kHz, ~256 s |
| 2 | Editable Studio Backup v8 | `BrightTales-Episode-1-Meet-Max-studio-backup-v8.json` | 12,625,634 bytes | Restores places, scenes, episode, intro, credits, audio assets |

### SHA-256 checksums

```
BrightTales-Episode-1-Meet-Max.webm
  C3AF3E3BFA0DDFB749DFBEE12F1AD0DD1ACE2EF4C265E33452A565AC95C7F21A

BrightTales-Episode-1-Meet-Max-studio-backup-v8.json
  F516EB215A045D806D48377A966C67D9F164DB9C46B6799BDA0B3CFBB0BFDEED
```
| 3 | Production report | `FINAL_REPORT.md` | — | This document |
| 4 | Verification frames | `frame-003s.png` – `frame-248s.png` | — | Ten representative decoded frames |

## Episode structure

| Section | Place | Duration | Content |
|---------|-------|----------|---------|
| Intro / title | Max's bedroom | 14 s | BrightTales — Meet Max |
| 1. Meet Max | Max's bedroom | 36 s | Max appears, waves; Lily introduces him as a non-verbal Brightling |
| 2. Meet Maxine | Maxine's bedroom | 34 s | Maxine waves and walks; her friendship with Max is established |
| 3. Breakfast Time | Kitchen | 50 s | Max uses his Bright Speak phone: take out → hold → tap → "I'm hungry!" pop-up → put away |
| 4. Bright Stars | Living Room | 34 s | Max celebrates a Bright Star moment with gentle waving |
| 5. Playing Together | Garden | 43 s | Max and Maxine walk, wave and enjoy the garden together |
| 6. Goodbye for Now | Front of Max's house | 31 s | Both characters wave goodbye and look forward to more adventures |
| Credits | Front of Max's house | 14 s | Closing credits with gentle music |

**Total runtime:** 256 seconds (4 min 16 s).

## Production method

Every scene, intro, credits, music asset, narration clip and the final episode were assembled through the BrightTales Studio UI. No hand-authored project JSON or external video pipeline was used. The six approved Episode 1 backgrounds were imported through Studio Places; the protected Living Room artwork was not modified. Max and Maxine use the approved Native2D sprites.

## Audio

- **Narration:** Lily (`kokoro:bf_lily`) at 0.90× speaking pace, generated and saved through Voice Maker as seven reusable Audio Library speech assets.
- **Device voice:** George (`kokoro:bm_george`) delivers Max's Bright Speak message "I'm hungry!" as a device voice, not attributed to Max.
- **Music:** "Meet Max — gentle morning theme" composed in Music Studio at 72 BPM, exported to the Audio Library and placed under narration at low volume.
- **Sound effect:** "Bright Star soft sparkle" placed during the Bright Stars scene.

## Verification evidence

### Build and test gates

- `npm test -- --run`: **186/186 passed** across 23 files
- `npm run build`: **passed**

### Video technical verification

```
Video: VP9, 1672×941, 60/1 fps reported (avg 0/0 due to variable frame timing)
Audio: Opus, 48 kHz, stereo
Last video packet timestamp: 256.123 s
Last audio packet timestamp: 256.121 s
File size: 69,538,159 bytes
Audio mean volume: -24.0 dB
Audio max volume:  -1.2 dB
```

FFmpeg decoded the complete file with exit code 0. Video and audio packet timestamps both reach ~256.1 s with no large gaps.

### Representative frames

Extracted with FFmpeg at the following global timestamps:

- `frame-003s.png` — Intro title
- `frame-025s.png` — Scene 1: Max waving
- `frame-065s.png` — Scene 2: Maxine
- `frame-105s.png` — Scene 3: phone held
- `frame-108s.png` — Scene 3: phone tap
- `frame-110s.png` — Scene 3: Bright Speak pop-up
- `frame-150s.png` — Scene 4: Bright Stars
- `frame-185s.png` — Scene 5: Garden interaction
- `frame-225s.png` — Scene 6: Goodbye
- `frame-248s.png` — Credits

### Studio Backup v8 verification

- Format version: 8
- Timed scenes: 6
- Episodes: 1
- Intros: 1
- Credits: 1
- Audio assets: 11

All six scenes reference the approved Episode 1 place IDs plus the protected Living Room.

## Known limitations

- This is a **first cut** for Karl and Astra's creative review, not a final approved production.
- Lily's naturalness and the music balance have not been judged by human ears in this environment.
- The Garden and front-of-house backgrounds show daylight while the goodbye narration says "goodnight"; no approved artwork was altered.
- A later UI-only editorial revision (changed Garden walk direction, removed the credit phrase "Provisional British voice") produced exports with broken media timing (silent audio tails / frame gaps). That revision was therefore rejected; this delivery uses the verified 256 s first cut.
- Max has no spoken dialogue track. His communication is shown through the approved Bright Speak phone interaction and the device voice.

## Restoration instructions

1. Open BrightTales Studio in the intended browser.
2. First back up any existing browser data you wish to keep.
3. Go to **Characters → Import Studio Backup**.
4. Select `BrightTales-Episode-1-Meet-Max-studio-backup-v8.json`.
5. Confirm the import. This replaces the current Studio data with the Episode 1 project.
6. Go to **Episodes** and open **Meet Max — Episode 1** to preview or export again.

## Git status

Commits made during final delivery:

- `18ab41b` — Episode 1: deliver complete first cut Meet Max
- `2f50791` — Episode 1: add production plan and reports
- `0e4465e` — Episode 1: add automation scripts and result records

Remaining untracked files (kept in the working tree as additional evidence but not committed because of size):

- `proofs/episode-1/background-candidates/` — approved background artwork and prompts
- `proofs/episode-1/background-import/` — Places import evidence and restored-place screenshots
- `proofs/episode-1/production/` — full first-cut production frames and the original 256 s export
- `proofs/episode-1/*.webm`, `*.wav`, `*.mp3` — smoke-test videos and narrator voice samples
- `proofs/episode-1/*.png` — additional smoke-test screenshots and Voice Maker samples

Run `git status` for the exact current list.

## Result

**Episode 1 first cut: technically complete and playable.** The full six-scene episode, intro, title, narration, music, sound effects, Bright Speak phone interaction and credits are present in the exported WebM and editable Studio Backup v8. Final creative acceptance awaits Karl and Astra's review.

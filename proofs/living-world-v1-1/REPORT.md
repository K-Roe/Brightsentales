# Living World V1.1 — natural behaviour polish

**Status: visually rejected by Karl on 23 October 2026; experimental code and evidence retained.**

## What changed

V1 remains the existing `livingWorld: { enabled: true }` path. The optional `mode: "v1.1"` uses the same deterministic character controller and shared renderer. It chooses from a few safe Living Room standing spots near the window, rug and bookshelf, plus an occasional position near the other Brightling. It keeps recent destinations to avoid immediate repeats, limits social approaches, and checks the route and pause spot against other planned and scripted movement. Max remains calmer; Maxine is somewhat more exploratory and sociable. Personality values remain experimental and configurable in saved scene data.

Longer seeded pauses and a minimum dwell at each chosen spot reduce V1's back-and-forth movement. A small anticipation and a short hold on the approved side-standing frame soften autonomous starts and stops. The planner reserves a return window before the director's next action; the action still begins at its exact saved time and position. Brightling Life V2 keeps blinking and breathing across compatible poses. V1 scenes, scenes with Living World OFF, approved sprite files and approved action timing are unchanged.

## Review media

| File | Purpose |
| --- | --- |
| [V1.1 experimental episode](living-world-v1-1-episode.mp4) | Complete 45-second H.264 review episode at 30 FPS. |
| [Approved V1 baseline](living-world-v1-baseline.mp4) | Same 45-second cast, scene and directed actions using the V1 planner. |
| [Side-by-side V1 / V1.1](side-by-side-v1-v1-1.mp4) | V1 left, V1.1 right. |
| [V1.1 Scene Maker export](living-world-v1-1-scene.mp4) | Confirms scene export uses the same controller. |
| [Editable scenes](demo-scenes.json) | V1.1 and V1 baseline in the existing timed-library format. |
| [Studio Backup](living-world-v1-1-studio-backup.json) | Restore in a disposable Studio profile to edit both scenes and the episode. |
| [Browser checks](browser-results.json) and [restore checks](restore-results.json) | Save/reopen/export and fresh-profile Backup restore evidence. |

Max and Maxine have a long quiet opening; Maxine then approaches and pauses. Max's directed walk begins at 17 seconds and ends at 21 seconds. Maxine's directed wave begins at 27 seconds and ends at 28.7 seconds. Both resume independent quiet activity afterward. The scene has no authored audio, so its AAC track is silent.

## Verification

- V1.1 focused tests passed. Full `npm test -- --run`: **223/223 passed** across 33 files. `npm run build` passed with Vite's existing large-chunk advisory.
- The 45-second fixture was sampled at 10 Hz. The two characters spent more than 60 combined character-seconds in autonomous quiet rest/observe states. Their autonomous walking occupied 6.4 combined seconds, versus 29.7 seconds in the V1 baseline. One approach occurred, and sampled separation stayed at least 255 stage pixels. These figures describe this fixture, not every scene.
- Disposable Chrome showed the V1.1 opt-in, saved and reopened it, exported both 45-second Scene Maker versions, exported the episode and Studio Backup, and reported no console errors. A fresh disposable Chrome profile restored the Backup through the UI, reopened V1.1 and retained the V1 baseline and episode without console errors.
- All native WebMs and review MP4s decoded fully. The V1.1 episode is 45.15 seconds, H.264 at 1672 × 942 and constant 30 FPS with AAC audio. One bottom pixel was padded from the Studio's 1672 × 941 Canvas for H.264 compatibility; no character art was cropped or stretched. Exported approach, scripted-walk and later quiet frames were visually inspected.

## Remaining limits and approval gate

The approved whole-body artwork still changes from the profile walk pose to a front-facing idle pose without an illustrated turning sequence. V1.1 holds the approved side-standing frame briefly but cannot make that final pose change fully natural. There is no independent eye aim, head turn, prop interaction or room depth map. Walking stays in the conservative foreground corridor. When a future directed action needs the original scripted position, a visible return trip can still occur; V1.1 gives it a longer dwell first. Karl should judge the full 45-second rhythm, especially whether quiet periods and the approach feel purposeful. **V1.1 remains experimental until Karl watches and approves it.**

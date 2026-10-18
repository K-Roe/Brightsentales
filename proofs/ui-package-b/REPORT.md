# Global BrightTales themes — Package B

18 October 2026. Implemented after Package A's focused, full-suite, build and browser checks passed. Technical checks passed; Karl's visual acceptance is pending.

## Changes

- One shared Dark/Light/System choice applies before the app first renders, lives in the sidebar and persists locally. Dark is the no-preference default. The old Music Studio choice is used if no shared choice exists. System responds to OS changes.
- Shared semantic CSS tokens now drive the shell, all nine Studio sections, Music Studio, forms, overlays, dropdowns, scrollbars and empty states. The piano-roll UI colours follow the resolved theme. Instrument identity colours and approved artwork remain unchanged. The preference is outside project data and Backup v8.
- Core palette contrast calculations: dark text/surface 15.19:1, dark muted/surface 9.16:1, light text/surface 13.37:1, light muted/surface 5.44:1, light text/accent 5.31:1. These are token-pair checks, not an automated audit of every rendered pixel.

## Verification

- Preference migration/System/storage-failure unit tests passed 2/2. The final full suite passed 151/151 and `npm run build` passed.
- [Browser capture](capture.mjs) opened all nine sections in both Dark and Light, with no desktop page overflow or captured console, exception or failed-request events. It also captured character forms, scene editor, instrument picker, Music Studio editor and Sound Effects Maker in both modes. See [browser results](browser-results.json), [errors](browser-errors.json), and the [dark](dark-characters.png) and [light](light-characters.png) shell examples. The full 18-section screenshot set and detail screenshots are in this folder.
- [Preference results](preference-results.json) confirmed Light persisted after reload; System followed emulated dark and light OS settings; a legacy Music Studio Light choice migrated; no saved choice defaulted Dark; 390px mobile had no horizontal overflow. See [mobile screenshot](dark-mobile.png).
- Package A's browser run after theme integration checked song save/reopen, playback reaching Playing, WAV export, and Backup v8 UI export/import. The audio engine, project validation/schema, WAV encoder and Backup v8 files have no changes in this follow-up.

## Audio hash investigation and limits

- Re-ran the existing [M6.6B comparison](../m6-6b/compare_renders.py) on its reference WAVs: song before/after differed in 278 of 1,023,120 PCM samples, maximum one 16-bit step; two renders from the same redesigned build differed in 590 samples, also at most one step. The effect render was byte-identical. Project audio fields matched after removing generated IDs.
- `renderMusic` uses `OfflineAudioContext` and a `DynamicsCompressor`; the tiny repeat-run differences may arise in that browser audio path, but the responsible node has not been isolated. **Song byte-identical rendering is not verified.** Investigating or changing synthesis is outside these UI packages.
- Screenshots and browser checks do not establish Karl's visual acceptance, physical speaker playback, or exhaustive contrast for every interactive state. Native browser confirmation dialogs follow the browser/OS appearance.

# BrightTales UI follow-up proposal

17 October 2026. **Proposal only. Neither package is authorised for implementation. M6.7 and M7.0 Beat Blocks remain unstarted.** Package A and Package B have separate approval and acceptance gates.

## Current architecture and theme inventory

- `App.tsx` renders one shared `.app-shell`, a sticky `.studio-sidebar` with nine navigation sections, and `.main`. It owns navigation and saved project libraries. `main.tsx` imports `style.css`, then `music-studio.css`.
- `style.css` sets the page, sidebar, cards, forms, timelines, Audio Library and other section surfaces to fixed light colours. It has no global appearance state or semantic theme palette; a source scan found more than 400 hex-colour occurrences. At large widths `.app-shell>.main` is capped at 1540px with side padding.
- Music Studio alone owns a `dark | light` state and the `brightsenappstales.music-theme` localStorage key in `musicDesign.tsx`. It defaults to dark, applies `data-theme` to `.music-studio-wrap`, and defines `--ms-*` colours in `music-studio.css`. `.music-studio` is capped at 1320px. No System setting exists.
- The piano roll is drawn in `MusicStudio.tsx` on Canvas, with hardcoded grid/key/playhead colours. Instrument colours in `musicDesign.tsx` identify sounds and should remain distinct from theme surface colours. Scene/Playground Canvas art and character colours are intentional content and must not be recoloured by a UI theme.
- The preview transport in `previewPlayer.tsx` renders the current draft into a WAV and plays it through an `HTMLAudioElement`. Song/effect synthesis, saved project validation, Audio Library assets and Backup v8 live in separate modules.
- M6.6B browser checks passed both local Music Studio themes, editing, export and Backup v8 restore. Its song before/after SHA-256 comparison failed: repeated renders varied by at most one 16-bit PCM step in a small fraction of samples. The audio engine was unchanged; the cause and exact-byte reproducibility remain unresolved.

## Package A — Music Studio polish

**Boundary:** Music Studio interaction and layout only. Keep the current local dark/light theme until Package B is separately approved. Do not alter `instruments.ts`, `musicRender.ts`, `musicProject.ts` validation/schema, `musicAssets.ts`, `wav.ts`, audio playback/storage, or Studio Backup.

### Scope

1. **Desktop width:** add a Music Studio-specific main-area layout class in `App.tsx`; let `.music-studio` use the available content width rather than the current 1320px cap. On wide screens, place the piano roll beside a 300–360px instrument/inspector rail. Keep the transport full width and constrain text line lengths. Stack the rail and editor on narrow screens. Preserve the existing Compact/Normal/Big roll zoom and horizontal scrolling for long songs.
2. **Collapsible tracks:** keep each track's icon, name, selected state, note count and mute/solo status visible in a header. Add an independent disclosure button with `aria-expanded`/`aria-controls` for volume, pan, mute, solo and Remove. Opening/selecting a collapsed track must still open its notes. Store expansion only in component state; never write it into a song or Backup.
3. **Selected-note editor:** make selection obvious in the roll and provide a persistent, labelled inspector area that explains how to select a note. When selected, expose pitch/drum name, beat start, length, velocity and Delete with validated bounds. Add a keyboard-reachable note list or equivalent control to select notes without using Canvas coordinates. Keep mouse drag and edge-resize behaviour.
4. **Note Undo/Redo, if the isolated editor history proves safe:** hold a bounded in-memory history of note-array changes by track ID. Record one entry per completed add, move, resize, numeric edit, delete or confirmed preset replacement; coalesce a drag into one entry. Undo/Redo changes notes only, preserving intervening tempo and mixer edits. Clear or invalidate history when a project changes or a track is removed; clear redo after a new note edit. Saving does not bake history into the schema, and undoing after Save correctly marks the draft unsaved. Offer labelled buttons and Ctrl+Z/Ctrl+Shift+Z (plus Ctrl+Y), scoped to the note editor so normal text-input undo still works. If these boundaries cannot be met without corrupting draft state, omit Undo/Redo from A and report the blocker before claiming A complete.
5. **Playback and keyboard feedback:** show explicit Preparing, Playing, Paused and Stopped states while keeping the current WAV/HTMLAudioElement path. Indicate when a draft edit makes the currently playing preview stale; stop or restart it consistently. Provide clear Play/Pause/Resume/Stop labels, focus order, visible focus, keyboard operation of note selection/editing, and `aria-live` feedback without announcing every animation frame. Respect reduced motion.

### Likely affected files

| File | Proposed change |
| --- | --- |
| `src/App.tsx`, `src/style.css` | Music-only main width/layout hook; no global theme work. |
| `src/MusicStudio.tsx`, `src/music-studio.css` | Rail layout, collapsible cards, note inspector, keyboard controls and history wiring. |
| `src/previewPlayer.tsx` | UI transport state and stale-preview handling; retain the current render/playback functions. |
| `src/musicNoteHistory.ts`, `src/musicNoteHistory.test.ts` (new, if viable) | Pure, bounded note-only history operations and focused tests. |
| `proofs/<approved-A-id>/`, status/roadmap/batch docs | Browser evidence and an explicit implementation/approval record after authorisation. |

### Risks and verification

- **Risk:** a full-project snapshot Undo could silently revert mixer/tempo edits; use note-only commands and test edits interleaved with non-note controls. **Risk:** pointer moves may create many history entries; commit once at pointer up/cancel. **Risk:** keyboard shortcuts may override text editing; scope them to the note editor and test focused inputs. **Risk:** wide layouts can weaken scanability or overflow; test 1366, 1920 and 2560px desktop plus 860px and phone widths.
- Focused tests for add/move/resize/delete/preset Undo/Redo, redo invalidation, track removal, Save/unsaved state, bounds and history limit. Then `npm test -- --run`, `npm run build`, documentation links, and isolated-browser editing through pointer and keyboard, playback, save/reload and Backup v8 round-trip. Capture wide/narrow screenshots, console errors and failed requests.
- Compare audio output with the M6.6B reference project and check that engine files are unchanged. Treat the known one-step song render variation honestly; do not claim song SHA-256 equality unless observed.

## Package B — Global BrightTales themes

**Boundary:** a shared appearance system for the shell and every current Studio section. No feature, project-schema, audio-engine, artwork or Backup v8 format changes. Implement only after separate Package B approval; Package A approval does not imply B approval.

### Scope

1. Add one shared `Dark | Light | System` appearance preference. Recommend **System for users with no saved preference**. Store the choice under a new UI-only localStorage key; resolve System with `matchMedia('(prefers-color-scheme: dark)')` and update live when the OS changes. If the new key is absent but the old `brightsenappstales.music-theme` key is `dark` or `light`, use that value so an existing Music Studio choice is respected. Leave the old key intact for rollback. Appearance is browser UI preference, not project data or part of Backup v8.
2. Put the control in the shared sidebar/header so it is available in every section. Set one resolved theme on the application/root element before the first visible render to avoid a light flash, with a safe fallback if localStorage or matchMedia is unavailable. Music Studio must use the same resolved theme; remove its independent theme state and make any in-studio shortcut control the shared setting.
3. Create semantic tokens for page background, raised/sunken surfaces, text, muted text, border, focus, accent, success, warning, danger, overlays and scrollbars. Reuse the existing purple/teal brand and Music Studio `--ms-*` palette through aliases where practical. Replace fixed UI light/dark colours in `style.css` and `music-studio.css` with tokens, including section cards, forms, dropdowns, dialogs, timelines, Audio Library, empty states and navigation. Keep instrument identity colours, character swatches and protected rendered artwork intact. Give native form controls the matching `color-scheme`.
4. Theme the Music Studio piano-roll Canvas from resolved semantic colours and redraw when the theme changes. Theme other editor chrome and timeline labels through CSS; do not recolour scene/intro/credits/Playground artwork or change scene rendering data. Keep accessible contrast and focus visibility in both resolved themes; disable decorative transitions under reduced motion.

### Likely affected files

| File | Proposed change |
| --- | --- |
| `src/appearance.ts`, `src/appearance.test.ts` (new) | Preference parsing, legacy Music Studio fallback, System resolution and storage failure handling. |
| `src/AppearanceControl.tsx` (new), `src/App.tsx`, `src/main.tsx` | Shared control, state, OS-change subscription and pre-render root theme application. |
| `src/theme.css` (new), `src/style.css`, `src/music-studio.css` | Semantic palettes and replacement of hardcoded UI colours across all sections. |
| `src/MusicStudio.tsx`, `src/musicDesign.tsx` | Consume shared appearance; remove local theme ownership and repaint UI Canvas. Preserve instrument identity colours and the old preference key for fallback only. |
| Other section `.tsx` files only where inline UI colours block theming | Replace presentation-only colours; leave data, canvas artwork and editor behaviour alone. |
| `proofs/<approved-B-id>/`, status/roadmap/batch docs | Full visual matrix and implementation/approval record after authorisation. |

### Risks and verification

- **Risk:** `style.css` contains many fixed colours, including `!important` timeline/audio rules; partial token conversion can leave unreadable islands. Audit every section and interactive state, and avoid a broad blind replacement. **Risk:** a separate Music Studio preference can conflict with the global choice; use one shared state with the fallback rule above. **Risk:** System changes can flash or fail to propagate; test first load and live OS changes. **Risk:** theming content Canvas colours may alter approved art; scope Canvas changes to UI grids/controls only.
- Focused preference/migration/System tests, then `npm test -- --run`, `npm run build` and documentation links. In disposable browser profiles, capture all nine sections in dark and light at desktop and mobile widths, plus representative forms, dropdowns, dialogs, empty states, timelines and scrollbars. Test System switching, persistence/reload, keyboard focus, measured text/non-text contrast and reduced motion. Exercise save/reopen and a Backup v8 round-trip to confirm appearance changes do not change projects or exports. Record console errors and failed requests.
- Keep audio-engine files untouched and repeat the M6.6B render comparison with its documented exact-byte limitation. Karl's visual and listening acceptance remains a separate final gate.

## Approval boundary

Karl may approve, amend or reject A and B independently. Approval of a proposal authorises only that package's named scope. Neither package starts M6.7 or Beat Blocks, and implementation evidence will not be recorded as Karl's visual approval.

# F1 — Unsaved Episode Changes Protection

Status: **IMPLEMENTED — AWAITING REVIEW**. Karl approved M6.3 in the F1 brief; this report does not approve F1.

## What changed

- `src/episodeDraft.ts` compares an open episode with its saved snapshot. Name, ordered scene IDs and every audio clip field are included. Missing and empty audio arrays compare equally; undoing an edit back to the saved values clears the dirty state. A new episode has no saved snapshot and is treated as unsaved until its first successful save.
- `src/EpisodeMaker.tsx` shows a small **Unsaved changes** or **Saved** state. Back to Episodes and both Edit Scene paths use one native in-app dialog with **Cancel**, **Discard Changes**, and **Save and Continue**. The episode-opening helper also guards against a future in-editor switch to another episode.
- `src/App.tsx` routes sidebar exits from an open Episode Maker through the same guard. Navigation proceeds only after a successful Save or an explicit Discard. A failed save leaves the dialog, edited draft and unsaved state in place.
- A standard `beforeunload` listener is present only while the draft is dirty. It is removed after save or discard. The browser controls the refresh/close warning text.
- No episode schema, backup format, scene renderer, audio playback, artwork or animation timing changed.

## Isolated browser verification

The browser script created one disposable Chrome profile with no initial localStorage entries, seeded two valid saved scenes and one existing episode **only in that profile**, exercised the visible UI and removed the profile. It recorded no console errors or failed asset requests.

| Check | Browser observation |
| --- | --- |
| Existing episode and playback | Opened as **Saved** without a dialog; the existing preview clock advanced to about 0.6 seconds of 12. |
| Name edit, Cancel | **Unsaved changes** appeared; Back opened the three-choice dialog; Cancel kept the edited name and editor open. |
| Sidebar exit, Discard | Places opened; the persisted episode name remained **Saved Episode**. The beforeunload handler was no longer active. |
| Scene order, Save and Continue | Reordered scenes and chose Edit Scene → Save and Continue. Scene Maker opened only after save. Reopening showed **Second, First**; the saved IDs matched that order. |
| Audio edits | Imported a disposable WAV through the Audio Library, added an episode music clip, set volume to 25%, trim start to 0.5 s and fade-in to 0.25 s. The indicator became dirty and the clip fields persisted after Save. |
| Failed save | Temporarily made the episode localStorage write throw. Save and Continue kept the dialog open, draft name and dirty indicator intact; persisted name stayed unchanged and an error appeared. |
| Refresh | After a trusted browser interaction, refresh while dirty raised Chrome's standard `beforeunload` dialog with empty browser-controlled text. Dismissing it kept the draft. After successful save, refresh raised no dialog. |
| Reload and compatibility | The saved episode reopened with its name and audio clip, marked **Saved**. Clean Back to Episodes showed no warning. |

Evidence: `browser-results.json` contains the exact observed values, dialog event, console/asset lists and profile cleanup. `unsaved-indicator.png`, `navigation-dialog.png` and `navigation-dialog-mobile.png` show the desktop and mobile UI. `browser-check.mjs` reproduces the isolated run.

## Automated checks

- `npm test -- --run`: **65 tests passed** across 14 files. New focused tests cover unchanged drafts, first saves, reverted edits, scene ordering, clip start/trim/fades/volume and removal.
- `npm run build`: TypeScript and Vite production build passed.
- `git diff --check`: passed (Git only reported its existing LF→CRLF working-copy notices).

## Limits

- Browsers choose whether to show a beforeunload prompt, generally requiring a user interaction. The application cannot set its wording. The isolated Chrome run used a trusted click and observed the native dialog.
- The current editor does not expose an Open Another Episode action while an episode is open. Its opening helper uses the same guard, so that future path is covered in code but has no visible browser flow to demonstrate yet.
- This protects episode drafts. Broader undo/redo and unsaved-change protection in other editors remain separate roadmap work.

Await Karl's visual and functional approval before starting F2 or another milestone.

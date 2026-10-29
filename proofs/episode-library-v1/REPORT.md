# Episode Library V1 — implementation report

Date: 2026-10-26  
Repository: BrightSenAppsTales, branch `main`  
Starting commit: `4c78b6fb7bbc3890bff029fa1cc8bd43e643f079`  
Commit status: implementation is uncommitted; no push was made.

## What changed

- Extended the existing Episode Maker library with folder create/rename/delete, episode search, folder navigation, rename, duplicate, move and confirmed delete.
- Episode cards show an available first-scene thumbnail, runtime, scene count and last-save date. The editor retains explicit **Save Episode** and the saved/unsaved state.
- Added validated folder and visual-preview metadata without changing the native Episode v1 or TimedScene schemas.
- Added immutable episode/scene-timing preview snapshots. They play read-only through the existing Episode Maker renderer and transport. Shared character/place/audio assets remain linked to the current Studio profile.
- Extended the managed loopback-only Studio service with private project, folder, preview and WebM-export storage under `.brighttales-local/`. Startup creates all dedicated directories. Episode project files are native Backup v8 snapshots scoped to the selected episode and its referenced scenes, Brightlings, Places and audio.
- Local project writes are atomic and use an expected `updatedAt` revision. A stale second Studio window/profile receives a conflict response rather than silently overwriting the newer local file.
- Added a **Saved on this PC** list and additive recovery. Recovery validates the native backup, appends only the selected episode's referenced data, preserves existing records, and refuses same-ID content conflicts. It does not call the destructive full-profile backup restore path.
- Added a local WebM copy when the existing export completes and the local service is ready. The existing browser download remains available if that copy fails.
- Added precise `.gitignore` entries for runtime local data and `proofs/episode-1-hello-max/`. No extension-wide ignores were added.

## Existing data and Git protection

Before changing ignore rules, `git ls-files` showed no tracked `.brighttales-local/` data and no tracked files under `proofs/episode-1-hello-max/`. It did show **166 tracked historical proof files under `proofs/episode-1/`**, including episode Backup JSON and WebM files. Those existing tracked files were left untouched and were not removed from the index; Karl's approval is required before any tracking removal.

`git check-ignore -v` confirmed the rules for episode project JSON, WebM exports, visual preview index, recordings, temporary files, media cache, and the local Episode 1 working folder. The managed service initialized all six private directories and copied the existing seven-scene Episode 1 Backup v8 into `.brighttales-local/episode-projects/` only because the destination did not exist. The source under `proofs/episode-1-hello-max/` was not modified. That private copy is about 8.7 MB and remains ignored.

No existing browser profile was opened, cleared or changed. No files were staged or committed. Pre-existing untracked Playwright artifacts, proof XMLs and Episode 1 working files remain untouched.

## Architecture

- Browser profile remains the live editing cache: existing `EPISODES_KEY`, `TIMED_SCENES_KEY`, Audio Library IndexedDB and existing restore validation are reused.
- `src/episodeWorkspace.ts` stores folder assignments, edit dates and preview snapshots in a new versioned localStorage record.
- `scripts/episode-local-store.cjs` exposes only fixed JSON/media endpoints on the Studio's existing 127.0.0.1 server. It validates IDs and project shape, restricts cross-origin requests to the exact local Studio origin, bounds request size and confines file paths to dedicated directories.
- `src/App.tsx` creates a scoped native Backup v8 per-episode copy and implements additive recovery. Existing IDs are preserved; conflicting scene or character definitions stop recovery.
- `src/EpisodeMaker.tsx` hosts the library and Test Previews UI. Preview snapshots reuse the existing Episode Maker Canvas renderer and playback clock; no renderer or storage format was replaced.

## Verification

- `npm test -- --run`: **398/398 tests passed** across 59 files.
- `npm run build`: passed (`tsc -b` and Vite production build). Vite reports the existing large JavaScript chunk advisory (~744 KB); no build failure.
- `npm run test:service`: **25/25 passed**, including 3 new local-store tests. The existing busy-but-healthy service case took about 29.5 seconds; the suite exited normally in about 47.2 seconds.
- `node --test test_episode_local_store.cjs`: **3/3 passed**.
- `git diff --check`: final source/documentation diff is checked at delivery.
- `git check-ignore -v`: all new private directories and the Episode 1 working folder matched their path-specific rules.
- `git ls-files .brighttales-local proofs/episode-1-hello-max`: no tracked local data found.

Service tests cover directory initialization, persistence across store recreation, read/download, folder validation, loopback origin checks, invalid project data, optimistic revision conflicts, WebM write/list/read, content-type rejection and refusal to overwrite an existing export ID.

## Not verified in a real Studio session

No real browser workflow, screenshot, 120-second playback, audio listening, WebM watch-through or browser-profile restart was performed. The current Studio server was not stopped or replaced. It must be restarted to load the new `scripts/studio.cjs` endpoints. Consequently, the UI and additive Episode 1 recovery path are implemented and type/build tested, but still require Karl's browser review. Tests do not establish visual or audio acceptance.

## Review steps

1. Restart Studio so `episode-local-store.cjs` is active. For Studio-only review, run `npm run dev` from the repository root (or `npm start` after building); stop the old process from its owning terminal with Ctrl+C first. The review launcher also works but starts Unity, which is optional here.
2. Open **Episodes**. If the episode is not yet in the current browser profile, find **Hello, I'm Max!** in **Saved on this PC** and click **Add local copy to My Episodes**.
3. Open and play the episode. Confirm all seven scenes, 120-second timeline, narration and all three Bright Speak exchanges are present.
4. Save, return to the library, reopen, and scrub/play. Confirm the status reports a local PC copy.
5. Create a folder, move the episode, and verify the card metadata.
6. Save a **Visual Test Preview** with a review purpose, then test Play, Pause, Restart and scrubbing. Use **Edit Source Episode** to return to the editable project.
7. Download **Local Backup**. Optionally export WebM and check `.brighttales-local/exports/` for the private copy.

Full instructions and the browser-profile storage recommendation are in [`docs/EPISODE_LIBRARY.md`](../../docs/EPISODE_LIBRARY.md).

## Remaining limits

- Browser localStorage/IndexedDB remain the live session store. The filesystem copy protects saved episodes from browser-profile loss, but Studio does not silently replace an occupied profile with a disk backup.
- Scene/episode IDs that collide with different local data require a human resolution; recovery rejects instead of overwriting.
- Test snapshots capture episode and scene timing data. They reference current character definitions, approved artwork and audio in the Studio profile; deleting/changing those shared assets can change or block the old preview.
- WebM local copies are bounded to 160 MB. If the disk-copy request fails or reaches its timeout, the normal browser download continues and Studio reports that the extra local copy was not saved.
- The repository has historical tracked media/backup artifacts as noted above. They remain tracked pending separate authorization.

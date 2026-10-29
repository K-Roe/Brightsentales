# Episode Library and Local Project Storage V1

## How storage works

BrightTales keeps its live editing state in the browser profile that opens Studio: episode and scene records are in localStorage and audio assets are in IndexedDB. Browser profiles are isolated, so use the same Chrome/Edge profile for everyday editing. Do not clear that profile's site data.

The managed Studio service now makes a second, private project copy on this PC when an episode is explicitly saved. It stores a native Studio Backup v8 scoped to that episode, including its referenced scenes, custom Brightlings, Places artwork and audio. Files are written atomically under `.brighttales-local/episode-projects/`; a revision check refuses to replace a newer copy. This directory is created when `npm run dev`, `npm start`, or the existing review launcher starts the Studio service.

On another browser profile, open **Episodes → Saved on this PC → Add local copy to My Episodes**. Studio validates the native backup and adds only missing records used by that episode. Existing records with the same IDs are preserved; incompatible conflicts stop the recovery with an explanation. The standalone **Download Local Backup** action also saves a normal Backup v8 JSON file for offline safekeeping.

This remains local to this Windows checkout. It is not synchronized through GitHub or cloud storage. For a durable second copy, download the native backup and place it on Karl's separate backup device. Keep the original browser profile for the simplest reopen workflow.

## Folders and saved episodes

In **Episodes**, create folders, select a folder to browse, search by name, rename/duplicate/move episodes and delete with confirmation. Deleting an episode leaves its source scenes and audio assets in the Studio libraries. The selected episode's folder and last-saved time are metadata; episode, scene and audio data continue to use the existing Studio schemas.

**Save Episode** updates the browser project first and then writes the private PC copy. The editor reports separately if the second copy could not be written. Keep the browser profile and use **Download Local Backup** if that status reports a local service problem. Runtime exports are still downloaded through the existing WebM flow and are additionally copied to `.brighttales-local/exports/` when the managed local service is available.

## Test Previews

On an episode card, select **Save Visual Test Preview**, enter its review purpose, and the current episode and referenced scene timing are captured. **Test Previews** keeps these snapshots in their episode folder. **Play Preview** opens the snapshot read-only in the existing Episode Maker renderer with Play/Pause, Restart and timeline scrubbing. **Edit Source Episode** returns to the editable saved episode. Older snapshots remain available alongside newer ones for side-by-side review.

Snapshots preserve the episode and scene timing records. Character definitions, Place artwork and audio files remain references to the current Studio profile; the snapshot does not embed duplicate copies of those shared assets. A playable preview is a way to inspect a visual result, not a unit-test result and not Karl's visual acceptance.

## Local-only directories

The managed service creates these paths under `.brighttales-local/`:

- `episode-projects/` — native per-episode backups and folder index
- `exports/` — locally retained WebM files
- `test-previews/` — playable snapshot index
- `recordings/` — local recording artifacts
- `temp/` — temporary render output
- `media-cache/` — local media cache

All six directories are ignored by Git. Episode 1's generated working project in `proofs/episode-1-hello-max/` is also path-specifically ignored. Intentional reusable art/source files and historical proof artifacts retain their current version-control rules; extension-wide image, audio, video and JSON ignores were not added.

The repository already tracks historical proof assets under `proofs/episode-1/` (166 tracked files total, including previous Backup JSON files and WebM exports). They were not removed from tracking because doing so needs Karl's separate approval. Newly generated Episode 1 files in `proofs/episode-1-hello-max/` and all new runtime project/media directories are local-only.

## Manual review

1. Restart Studio so the updated local file service is active. For Studio-only use, open PowerShell in the repository and run `npm run dev` (or `npm start` for the production build); stop the old Studio process from its own terminal with Ctrl+C first. The review launcher also works but starts Unity as well, which this workflow does not need.
2. Open **Episodes** and find **Hello, I'm Max!** under **Saved on this PC** if it is not already in the browser library.
3. Click **Add local copy to My Episodes**. Wait for the success message, then open the episode.
4. Confirm all seven scenes, narration/dialogue clips and the exact 120-second timeline are present. Make a small harmless edit, click **Save Episode**, return to the library, and reopen it.
5. Create a folder and move the episode into it. Confirm the card shows the runtime, seven scenes and edit date.
6. Select **Save Visual Test Preview**, enter a purpose, then use **Play Preview** to inspect the saved version. Pause, restart and scrub; confirm **Edit Source Episode** opens the editable project.
7. Download a Local Backup and confirm a native Backup v8 JSON arrives. Optionally export a WebM and confirm a private copy appears in `.brighttales-local/exports/`.

Automated checks verify schemas, local writes, restart persistence, conflict detection and export file handling. They do not establish that Karl has visually watched the episode or listened to its audio.

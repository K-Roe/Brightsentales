# BrightSenAppsTales

A local React/TypeScript 2D cartoon maker. The living room, Max, Maxine, and the V3 walking cycle are Milestone 1 artwork and behaviour approved by Karl.

Start with the [user guide](docs/USER_GUIDE.md), [current project status](docs/PROJECT_STATUS.md), [development roadmap](docs/ROADMAP.md), and [architecture](docs/ARCHITECTURE.md). The Studio has Characters, Places, timed Scenes, Episodes, Audio and Playground sections. F2 MP3/OGG testing is implemented and awaits Karl's batch review; see [BATCH_REVIEW.md](docs/BATCH_REVIEW.md) for implementation and approval status.

## Milestone 2 wave

Select Max or Maxine and press **Wave**. The selected character starts from the existing front idle, raises one arm, moves the hand twice, lowers the arm, and returns to the exact original idle image. The wave uses complete transparent character poses; the walking sprites, living room, and scene JSON format are unchanged. Wave is unavailable during walking. Starting a walk, dragging a character, resetting, or reopening a scene cancels an active wave.

- [Wave frame contact sheet](milestone2-wave-contact.png): original idle and every new wave pose for both characters at equal display scale.
- [Browser recording](milestone2-wave-demo.mp4): Max waves, Maxine waves, then Max walks behind Maxine, stops, waves, and returns to idle.

Karl approved the Milestone 2 wave. Its source sheets and `scripts/prepare_wave_sprites.py` remain available for review; its artwork and timing are unchanged in Milestone 3.

## Current Studio

The app opens on the **Characters** library overview. The left sidebar switches between Characters, Places, Scenes, Episodes, Audio and Playground. Max and Maxine appear as protected originals. Select **Create Brightling** to choose a name, template and three colours; select **Edit** to update a saved Brightling without changing its ID or scene placements. **Cancel** returns to the overview without saving. **Delete** confirms before removing only that custom character and its scene references. The preview and Playground use the same source frames and recolouring masks.

**Places** starts with House (Living Room, Bedroom and Garden) and an empty Park folder. Create and rename one-level custom folders, press **Move** on a place to choose a destination folder or **Move to Places (top level)**, or delete an empty custom folder after confirmation. **Add Place** accepts a name and PNG, JPEG or WebP background image. Bedroom, Garden and other nonprotected places also offer **Upload Artwork** or **Replace Artwork**. Nonprotected places can be deleted after confirmation. The approved Living Room artwork remains protected. Previewing uploaded artwork does not change the Playground or saved scene. Only Living Room ships with approved background artwork.

**Playground** contains the original living room, dragging, walking, waving, depth ordering and position save/reset controls. **Scenes** creates timed cartoons with Brightling actions and a visual timeline. **Episodes** arranges saved scenes into continuous playback. **Audio** imports local music and effects; scene and episode editors place their clips on audio lanes. Older saved scenes with the historical procedural Oliver still open. No AI service runs in the application. Follow the [step-by-step Studio workflows](docs/USER_GUIDE.md) to create a character, scene and episode.

Library and scene JSON are stored in this browser profile. **Export Library** downloads a version 1 JSON backup of custom Brightlings only; it does **not** contain saved scene JSON and is not a complete Studio backup. **Import Library** validates the whole file before applying it. Merge updates matching IDs and adds new ones; Replace uses exactly the imported custom characters and removes missing custom IDs from the saved scene. Both require confirmation. If stored library JSON is invalid, the app leaves it untouched and offers **Export Stored Data** before a confirmed replacement.

**Export Studio Backup** downloads custom Brightlings, the saved Playground scene, Places organisation and uploaded artwork, timed scenes, episodes and imported audio assets. Format version 5 includes a creation timestamp and audio checksums. **Import Studio Backup** validates before confirmation and accepts earlier backup versions. Keep downloaded backups somewhere safe: clearing browser site data removes local work. Uploaded place images are resized to at most 1672 pixels along their longest side and saved as WebP; imported audio blobs live in IndexedDB. Browser storage quota can prevent new saves. F4 adds coordinated crash recovery across audio and scene storage; see its [technical evidence](proofs/f4/REPORT.md) and [review status](docs/BATCH_REVIEW.md).

See the [proof folders](proofs/) for implementation evidence. A proof report does not itself establish Karl's approval. [Batch review](docs/BATCH_REVIEW.md) lists the current evidence and Karl's pending checks.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://127.0.0.1:5173/`). Use **Characters** to create Brightlings; **Playground** for free placement, walking and waving; **Scenes** for scheduled action editing; **Episodes** to arrange and play scenes; and **Audio** to import local music and effects. Save scene and episode changes before leaving. Episode Maker warns about unsaved changes; other editors do not yet have the same protection. The [status document](docs/PROJECT_STATUS.md) records current limits.

## Checks

```sh
npm test
npm run build
```

Storage is per browser profile on this device. Clearing site data removes local work. Use **Export Studio Backup** for a complete downloadable copy; **Export Library** contains only custom character definitions.

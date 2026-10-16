# BrightSenAppsTales

A local React/TypeScript 2D cartoon maker. The living room, Max, Maxine, and the V3 walking cycle are Milestone 1 artwork and behaviour approved by Karl.

## Milestone 2 wave

Select Max or Maxine and press **Wave**. The selected character starts from the existing front idle, raises one arm, moves the hand twice, lowers the arm, and returns to the exact original idle image. The wave uses complete transparent character poses; the walking sprites, living room, and scene JSON format are unchanged. Wave is unavailable during walking. Starting a walk, dragging a character, resetting, or reopening a scene cancels an active wave.

- [Wave frame contact sheet](milestone2-wave-contact.png): original idle and every new wave pose for both characters at equal display scale.
- [Browser recording](milestone2-wave-demo.mp4): Max waves, Maxine waves, then Max walks behind Maxine, stops, waves, and returns to idle.

Karl approved the Milestone 2 wave. Its source sheets and `scripts/prepare_wave_sprites.py` remain available for review; its artwork and timing are unchanged in Milestone 3.

## Studio and Brightling library (Milestone 3.3 review)

The app opens on the **Characters** library overview. The left sidebar switches between Characters, Places, Scenes and Playground. Max and Maxine appear as protected originals. Select **Create Brightling** to choose a name, template and three colours; select **Edit** to update a saved Brightling without changing its ID or scene placements. **Cancel** returns to the overview without saving. **Delete** confirms before removing only that custom character and its scene references. The preview and Playground use the same source frames and approved recolouring masks.

**Places** starts with House (Living Room, Bedroom and Garden) and an empty Park folder. Create and rename one-level custom folders, press **Move** on a place to choose a destination folder or **Move to Places (top level)**, or delete an empty custom folder after confirmation. **Add Place** accepts a name and PNG, JPEG or WebP background image. Bedroom, Garden and other nonprotected places also offer **Upload Artwork** or **Replace Artwork**. Nonprotected places can be deleted after confirmation. The approved Living Room artwork remains protected. Previewing uploaded artwork does not change the Playground or saved scene. **Scenes** remains a placeholder. **Playground** contains the existing living room, dragging, walking, waving, depth ordering, and scene controls. Fresh scenes contain Max and Maxine; older saved scenes with the historical procedural Oliver still open. No AI service runs in the application.

Library and scene JSON are stored in this browser profile. **Export Library** downloads a version 1 JSON backup of custom Brightlings only; it does **not** contain saved scene JSON and is not a complete Studio backup. **Import Library** validates the whole file before applying it. Merge updates matching IDs and adds new ones; Replace uses exactly the imported custom characters and removes missing custom IDs from the saved scene. Both require confirmation. If stored library JSON is invalid, the app leaves it untouched and offers **Export Stored Data** before a confirmed replacement.

**Export Studio Backup** downloads custom Brightlings, the saved Playground scene, custom places, uploaded background artwork and Places folder organisation together, with a format version and creation timestamp. **Import Studio Backup** validates these before confirmation and restores them together. Older backups without custom-place or artwork fields still import. Older version 1 backups without folder data restore to the default House and Park layout. An interrupted restore is recovered on the next launch. Keep downloaded backups somewhere safe: clearing browser site data removes local characters, scenes and places. Uploaded images are resized to at most 1672 pixels along their longest side and saved as WebP in browser storage. Very large images or a full browser storage quota may prevent saving; existing data is kept.

Milestone 3.3 remains pending Karl's visual and functional approval. [Review Studio Backup screenshots and browser recording](proofs/milestone3-3/).

Milestone 4A Places Library is pending Karl's visual approval. [Review Places screenshots and browser recording](proofs/milestone4a/).

Milestone 4A.1 Custom Place Folders is pending Karl's visual and functional approval. [Review folder screenshots and browser recording](proofs/milestone4a-1/).

The 4A.1 movement correction is pending Karl's review. [Review the visible Move controls and browser recording](proofs/milestone4a-1-move-fix/).

The Places artwork upload and Add/Delete extension is pending Karl's review. [Review desktop and mobile screenshots](proofs/place-add-delete/).

## Run

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. Use **Characters** to create or manage Brightlings. Open **Playground** to select or drag a character, click the floor for a walking destination, and press **Play scene**. **Wave** works while stationary. **Save scene** stores starts and destinations; **Open saved** reloads them; **Reset positions** returns to the saved starts.

## Checks

```sh
npm test
npm run build
```

Storage is per browser profile on this device. Clearing site data removes the library and scene. Use Export Studio Backup to preserve custom characters and saved scene positions together; Export Library preserves custom character definitions only.

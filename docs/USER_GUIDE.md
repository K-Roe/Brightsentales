# Using BrightSenAppsTales

The Studio runs locally in your browser. Start it with `npm install` (first use) and `npm run dev`, then open the URL Vite prints. **Characters** opens first. Work is saved in this browser profile; download a [Studio Backup](#keep-a-backup) before clearing site data or moving computers.

## Create and use a Brightling

1. Open **Characters** and select **Create Brightling**.
2. Choose the Max-based or Maxine-based template, enter a name and select body, hair and main clothing colours. The front preview updates as you choose.
3. Select **Save Brightling**. Its card appears in the library with Edit, Delete and Add to Playground controls. Editing updates the same character ID; Cancel leaves the saved version unchanged.
4. Select **Add to Playground** on its card. In **Playground**, drag the character to place it, select it and click a walking destination, or press **Wave**. Use **Save scene**, **Open saved** and **Reset positions** for its free-placement scene.

Max and Maxine are protected default characters. Their cards offer the approved original and T-shirt outfit choices; custom Brightlings currently use their template's original outfit with chosen colours.

## Create a timed scene

1. Open **Scenes**, select **Create Scene**, name it, choose an artwork-ready place and set a positive duration. The approved Living Room is available by default.
2. Choose a Brightling from **Add Brightling**. At time zero, drag it on the stage to set its starting position.
3. Select the character on the stage or in the director panel. Choose **Appear**, **Walk To**, **Wait**, **Wave** or **Disappear**. For a Walk To action, select **Choose position on stage** and click its destination. The Left edge and Right edge buttons support entrances and exits.
4. Select an action block on the timeline to change its start and length. Drag blocks to move them, drag their right edges to resize, or click the ruler to seek. The selected-action inspector also has exact time fields and optional advanced coordinates.
5. Use **Play**, **Pause** and **Restart** to preview. Select **Save Scene** before leaving. Saved scenes can be opened, duplicated or deleted from the Scenes library.

Only places with artwork are offered for a scene. Upload your own background in **Places** if you need another location; the supplied Bedroom and Garden entries do not include approved artwork.

## Arrange an episode

1. Open **Episodes** and select **Create Episode**.
2. Add saved scenes from the scene list. Move each scene left or right, remove it from the sequence, or add the same scene more than once. The total duration updates automatically.
3. Use the preview's **Play**, **Pause**, **Restart** and time slider. Scenes advance automatically; seeking chooses the corresponding scene and local time.
4. Enter an episode name and select **Save Episode**. Opening **Edit Scene** takes you to the existing Scene Maker. If an episode has unsaved changes, a dialog offers **Save and Continue**, **Discard Changes** or **Cancel** when you navigate away. Browser refresh/close uses the browser's standard unsaved-changes warning where supported.

Episodes keep references to saved scenes. Editing a saved scene changes episode playback. If a referenced scene is missing, the episode shows a warning and blocks playback until you restore or remove that reference.

## Add music and effects

1. Open **Audio**, choose Music or Sound Effect, and import a browser-decodable MP3, WAV or OGG file. Preview it in the Audio Library.
2. Open a saved scene or episode. In **Music & sound**, choose an imported file and select **Add Music** or **Add Sound Effect**.
3. Drag its block in the music/effects lane or edit **Start (s)**. Select a block to adjust volume; open **Trim and fades** for clip bounds and music fades. Save the scene or episode after editing.

Episode music uses the full episode clock and continues across scene boundaries. Scene audio plays at its scene-local time. Browser support varies by codec; [F2 evidence](../proofs/f2/REPORT.md) covers real MP3, OGG/Vorbis and OGG/Opus in isolated Chrome, but does not certify every browser.

## Make and use a voice

1. Start BrightTales normally: `npm run dev`, or `npm run build` followed by `npm start` for the built application. BrightTales starts the local voice service for you — there is no second terminal and nothing to type. Wait for the **Voice engine** status above the Voice Maker tabs to say **Ready**. If it says Starting, wait. If it says Unavailable or Error, the line underneath explains the problem in plain English, for example "Required Python executable is missing" or "Voice model could not be loaded", and a **Retry voice engine** button appears; your recording and edits are not lost when you retry. The service uses locally installed Piper/Kokoro models and FFmpeg.
2. In **Voice Maker > AI Voices**, choose who speaks and an installed voice, enter dialogue, then select **Generate dialogue**. Play and save the original, or edit it. You can set a default AI voice or effect for a Brightling or narrator without requiring that character to speak.
3. Alternatively, use **Record Voice** to choose a microphone and Start/Stop/Retry, or import a WAV, MP3 or OGG recording. Imported originals are saved immediately; recorded originals can be saved in the editor.
4. In **Voice Editor**, choose an effect preset or adjust trim, cuts, pitch, speed, tone, volume, normalization, fades, echo or reverb. Use **Preview edited voice**, Undo/Redo, then **Save as new voice**. Save your effect as a custom preset to use on later recordings. Your original stays in the Voice Library.
5. In **Scenes > Music & sound**, choose the saved voice and **Add Speech**. Select the speaker, play the scene, and save it. Adding speech can extend the scene to fit. **Export scene video (WebM)** includes saved voice, music and effect clips for scenes up to two minutes.

## Keep a backup

In **Characters**, use **Export Studio Backup** to download custom Brightlings, the Playground scene, Places organisation and uploaded artwork, timed scenes, episodes, audio assets and Voice Maker presets/defaults. **Import Studio Backup** validates the file and asks before replacing current Studio data. Keep the downloaded JSON somewhere safe. Browser site-data clearing removes the live library. F4 protects an interrupted restore across audio and other data; if recovery cannot finish because storage is unavailable, the Studio blocks editing and asks you to reload and retry.

**Export Library** and **Import Library** handle custom Brightlings only. A library export is not a complete Studio Backup.

## Current boundaries

Voice Maker uses installed Piper/Kokoro models and FFmpeg through the local voice service that BrightTales starts automatically; it needs no cloud account and no second terminal. It does need Python with those packages and the model files present on the computer: on a machine without them the Voice Maker reports Unavailable or Error with the reason and a Retry button, while recording, import and every other Studio feature keep working. Generated dialogue and original/edited recordings are saved in the Audio Library, can be placed in a scene, and are included in Studio Backup v8. Scenes can export a scene-only WebM with their saved audio; complete episode export remains [planned](ROADMAP.md). [PROJECT_STATUS.md](PROJECT_STATUS.md) tracks verified behaviour and known limitations; [BATCH_REVIEW.md](BATCH_REVIEW.md) distinguishes implemented milestones from Karl's approval.

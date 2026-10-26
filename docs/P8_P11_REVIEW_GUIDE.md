# P8–P11 evening review guide

## Start Studio and Unity

1. In File Explorer, open `C:\Users\karlr\repos\BrightTalesP10MakerStudio`.
2. Double-click **Start-BrightTales-Review.cmd**.
3. Read the preflight summary. PASS items are ready; WARN items need attention but do not block; BLOCK items stop startup. The launcher never kills processes, installs packages, changes Unity settings, or alters Git worktrees.
4. When ready, it opens Studio in your default browser and opens the Unity project. In Unity, open `Assets/Scenes/StudioLivingRoomExperimental.unity` from the Project window and press **Play**.
5. In Studio, use its existing Unity connection panel and press **Connect**. The launcher checks that the bridge port is free or belongs to this Unity project; it does not claim a Studio connection until Studio confirms it.

The launcher writes timestamped logs under `%LOCALAPPDATA%\BrightTales\ReviewLauncher`. `Check-BrightTales-Review.cmd` runs preflight only and does not start applications. To override a workspace for diagnosis, pass documented script options from a terminal; normal review needs no command line or environment setup.

## P8 — Camera and audio

- Open the camera episode in Studio. Choose Wide, Medium, Close-Up or Custom shots; change targets and Static, Pan or Follow movement.
- Play, scrub, replay from the beginning, and check cuts/compatible fades in the Studio preview and Unity Game view.
- Listen to the episode audio through physical speakers/headphones. Check timing and the ending. Record this as a human listening review; automated playback is not approval.

## P9 — Brightling Auto-Builder

- In Brightling Maker create or open a supported Brightling, save it, and use **Send to Unity**.
- Confirm Studio reports the Unity acknowledgement and that Unity constructs the character.
- Trigger Idle, Blink, Walk and Wave where available. Edit the same saved character and send again; confirm its identity updates without a duplicate.

## P10 — Modular Brightling Maker

- Create two visibly different experimental Brightlings using supported modular features. Save each, close/reopen the Maker state, then send both to Unity.
- Confirm each keeps its identity, modular appearance and supported animation.
- Add them to a saved scene and episode cast, save/reopen, and check that the same characters remain selectable.

## P11 — Episode production

- Create/select two modular Brightlings and add them to an episode using an existing location.
- Set positions and add Idle/Wait, Walk and Wave actions. Add at least two camera shots with targets/movement and one supported audio cue; include a beginning and ending.
- Preview, scrub, replay, save and reopen. Send the episode to Unity and play it through; check character identity, timing, camera, scene order and audio.
- Export the complete WebM with the existing export control. Open it in a media player and watch/listen through the ending. Check the full duration and note any decoder or media issues.

## Stop safely

- Stop Studio in the dedicated launcher console with **Ctrl+C**. Close its browser tab as desired.
- In Unity, leave Play mode, then close Unity normally with **File → Exit**. Do not force-kill either application.
- If an app was already running before launch, it is reused only when its identity and configuration can be verified. Existing unrelated processes are never stopped.

## Troubleshooting

- **BLOCK: existing Studio has a different/unverified bridge configuration:** close that Studio server normally using its own console (Ctrl+C), then double-click the launcher again. The launcher intentionally will not reuse a server that cannot prove its repository and bridge port. It will not terminate the process.
- **Port 17844 occupied by an unidentified process:** do not send episode data to it. Identify and close the owning app normally, then retry. A free port is expected before Unity Play mode starts the bridge.
- **Missing Node/npm, Unity, project, scene or dependencies:** check the path shown in the preflight. The launcher does not install dependencies or change system PATH.
- **Studio does not become ready:** inspect the timestamped launcher and Studio logs; close only the launched Studio console normally and retry.
- **Unity opened but bridge is unavailable:** open the specified scene, press Play, then Connect from Studio. Confirm Unity is in Play mode and the bridge shows port 17844.
- **Voice service warning:** Studio owns and starts its local voice service. Wait for readiness or inspect the Studio console; other review features can be checked separately.

## Manual approval record

Keep these unchecked until Karl reviews the applications and exported media:

- [ ] P8 Studio camera appearance and timeline
- [ ] P8 Unity Game-view camera playback
- [ ] P8 physical audio listening
- [ ] P9 Unity construction, actions and update behavior
- [ ] P10 modular Studio and Unity appearance, persistence and cast
- [ ] P11 complete episode authoring, Unity playback and complete WebM

Automated checks, screenshots and successful exports are technical evidence only. P8–P11 human acceptance remains pending.

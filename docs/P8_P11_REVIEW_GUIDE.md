# P8–P11 evening review guide

## One-click episode preview and WebM export

Open a saved episode, then click **Preview Episode in Unity**. Studio validates its saved scenes, camera targets, custom Brightling cast and audio references; it starts Play Mode only when needed, waits for the Unity Editor and runtime bridge, transfers the episode, waits for audio preparation, and starts playback from the beginning. The episode status reports each stage and Unity's playback confirmation. If Unity Editor is closed, start it with `Start-BrightTales-Review.cmd`; the episode action never chooses or opens another Unity project. Cancel is available while preparation is running. Existing manual Unity Connection controls remain for troubleshooting.

For **Export WebM**, save the episode first. Progress reports preparation stages and measured rendered-frame counts, then encoding and final validation. The export includes supported episode/scene audio and stops on invalid or undecodable audio rather than dropping it. It renders the timeline end frame and validates the WebM container header before starting the browser download. The browser cannot confirm that the user accepted or saved the download; check Downloads, then watch and listen to the entire file through the ending. Automated checks do not replace Karl's visual or physical-audio review.

The existing Unity player supports the episode features recorded in P11. Unity preview currently rejects intros and credits; use Studio playback/export for episodes containing them.

## Start Studio and Unity

1. In File Explorer, open `C:\Users\karlr\repos\brightsenappstales`.
2. Double-click **Start-BrightTales-Review.cmd**.
3. Read the preflight summary. PASS items are ready; WARN items need attention but do not block; BLOCK items stop startup. The launcher never kills processes, installs packages, changes Unity settings, or alters Git worktrees.
4. When ready, it opens Studio in your default browser and opens the Unity project. In Unity, open `Assets/Scenes/StudioLivingRoomExperimental.unity` from the Project window and press **Play**.
5. In Studio, use its existing Unity connection panel and press **Connect**. The launcher checks that the bridge port is free or belongs to this Unity project; it does not claim a Studio connection until Studio confirms it.

The launcher expects Studio `main` and Unity `cartoon-foundation`; it opens `C:\Users\karlr\repos\BrightTalesUnityFoundationIntegration`. It writes timestamped logs under `%LOCALAPPDATA%\BrightTales\ReviewLauncher`. `Check-BrightTales-Review.cmd` runs preflight only and does not start applications. Normal review needs no command line or environment setup.

## Automatic Cartoon Preview startup

In Studio's **Cartoon Preview** connection panel, click **Start Unity**. The status proceeds through **Launching Unity**, **Loading Project**, **Opening Scene**, **Entering Play Mode**, **Connecting** and **Ready**. The trusted local launcher reuses the correct Unity project if it is already open or starts the installed Editor with the BrightTales project. The Editor-side controller opens `Assets/Scenes/StudioLivingRoomExperimental.unity`, enters Play Mode, then Studio connects automatically after Unity confirms the runtime bridge on port 17844.

If a loaded Unity scene has unsaved changes, startup stops and asks you to save in Unity. It never replaces dirty scenes. If Unity is compiling or importing, Studio waits and retries the scene-open request; startup timeout or port conflicts show an error and a **Retry** action. The Editor control endpoint is loopback-only at `127.0.0.1:17845`, separate from the runtime bridge at `127.0.0.1:17844`. Legacy port 17843 is not used by automatic Cartoon Preview startup.

The **Stop Unity** button remains available after Play Mode starts. The manual **Connect preview**, **Disconnect**, Ping and other troubleshooting controls remain below. If automatic startup is unavailable, start Unity with `Start-BrightTales-Review.cmd`, open the review scene and use the manual connection controls.

For manual acceptance, verify that an already-open correct project is reused, a closed Unity Editor opens the correct workspace and scene, Play Mode starts, and Studio reports **Ready** only after the 17844 bridge health response succeeds. Also test once with a dirty Unity scene and confirm it remains open and unchanged while Studio displays the save-first error.

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

- **BLOCK: existing Studio has a different/unverified bridge configuration:** close every Studio URL listed by preflight normally using that server's own console (Ctrl+C), then double-click the launcher again. The current workspace has legacy servers at `http://127.0.0.1:4177/` and `http://127.0.0.1:5173/`; the launcher intentionally will not reuse a server that cannot prove its repository and bridge port. It will not terminate the processes.
- **Port 17844 occupied by an unidentified process:** do not send episode data to it. Identify and close the owning app normally, then retry. A free port is expected before Unity Play mode starts the bridge.
- **Missing Node/npm, Unity, project, scene or dependencies:** check the path shown in the preflight. The launcher does not install dependencies or change system PATH.
- **Studio does not become ready:** inspect the timestamped launcher and Studio logs; close only the launched Studio console normally and retry.
- **Unity opened but bridge is unavailable:** open the specified scene, press Play, then Connect from Studio. Confirm Unity is in Play mode and the bridge shows port 17844.
- **Voice service warning:** Studio owns and starts its local voice service. Wait for readiness or inspect the Studio console; other review features can be checked separately.

## Episode Health Check V1

Open a saved episode and click **Check Episode** in the Episode Maker. Read the Errors, Warnings and Passed checks groups and use **Go to scene/shot/cue** where shown. Fix blocking errors in the existing scene, camera or audio editors, save, and run the check again. Scene audio extending past a scene cut is shortened by the current episode clock; move it to episode audio if it must continue across scenes. A closed/unreachable Unity Editor is reported without starting Play Mode; start it using this guide's launcher instructions before Unity preview. The check inspects saved references and metadata but does not decode every asset or replace a real preview/export. See [Episode Health Check proof](../proofs/episode-health-check-v1/REPORT.md).

## Manual approval record

Keep these unchecked until Karl reviews the applications and exported media:

- [ ] P8 Studio camera appearance and timeline
- [ ] P8 Unity Game-view camera playback
- [ ] P8 physical audio listening
- [ ] P9 Unity construction, actions and update behavior
- [ ] P10 modular Studio and Unity appearance, persistence and cast
- [ ] P11 complete episode authoring, Unity playback and complete WebM

Automated checks, screenshots and successful exports are technical evidence only. P8–P11 human acceptance remains pending.

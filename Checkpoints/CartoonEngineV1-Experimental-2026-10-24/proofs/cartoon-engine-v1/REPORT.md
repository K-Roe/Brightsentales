# Cartoon Engine V1 — Studio handoff

**Experimental; awaiting Karl's visual approval.** The Unity Connection panel now sends the bounded 26-second Max and Maxine Living Room configuration and starts playback after Unity confirms it loaded the scene. It reports completion only after Unity's status response says the playback clock finished. Director Controls, Blink Max and the separate experimental Portal V1 panel remain available.

Open `Assets/Scenes/CartoonLivingRoomV1Experimental.unity` in the Unity project and press Play. In Studio, open **Unity Connection → Connect → Send Scene to Unity → Play scene**. Use **Check status** after disconnection; **Reset** frees the run. The run ID survives a reload in tab session storage.

The [Unity report and continuous 26-second H.264 recording](../../../BrightTalesUnityTest/CartoonEngineV1Review/REPORT.md) contain live playback evidence and the main art-layer limit. [Studio completion screenshot](studio-complete.png) shows the final acknowledgement. Focused bridge tests passed 20/20 and `npm run build` passed. The standard Unity Editor path has not yet been visually approved by Karl; the live test used an isolated copy while his Editor retained the bridge port. No BrightTales production renderer, Scene Maker data or approved artwork was changed.

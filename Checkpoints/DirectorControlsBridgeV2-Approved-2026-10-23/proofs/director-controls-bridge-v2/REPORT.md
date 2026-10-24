# Director Controls Bridge V2 — approved

The Unity Connection tab now has a small Director Controls panel for Max and Maxine. It sends typed Look At, Wave and Idle commands over the existing localhost bridge and reports Unity's matching main-thread acknowledgement, rejection or timeout. The existing Connect, Ping and Blink Max controls remain.

Focused `src/unityBridge.test.ts` check passed 8/8. In the Unity Play check, the Studio panel sent Look At and Wave for both characters and Unity captured each pose from its Game camera. Invalid actor and self-look requests were rejected; Blink Max and Idle also passed. See the [Unity review report](../../../BrightTalesUnityTest/DirectorControlsBridgeV2Review/REPORT.md) for the test result and Game-camera frames. The [Studio panel screenshot](studio-director-controls.png) shows the experimental controls.

Open `Assets/Scenes/CharacterActingV1_2Experimental.unity` in Unity, press Play, then open Studio → Unity Connection → Connect. Select character, action and Look At target, click Send to Unity, and watch Unity's Game view. Acknowledgement confirms command acceptance, not animation completion.

Karl personally tested and approved Director Controls Bridge V2 on 2026-10-23. Character Acting V1.2 remains experimental. No full BrightTales suite, production renderer changes or Git commit.

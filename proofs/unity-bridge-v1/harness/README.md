# Disposable Unity test harness

These files were used only in a disposable copy of `BrightTalesUnityTest`. They are not part of the production Unity scene or runtime assets.

To reproduce the Play mode test, copy `BridgePlayTests.asmdef` and `MaxBridgePlayModeTest.cs` into `Assets/BridgePlayTests/` in a **copy** of the Unity project, add `MaxBridgeDemo` to that copy's Build Settings scene list, then run Unity Test Runner in Play mode. The test waits for an external BrightTales `max.blink` command and records Game camera frames and open/closed/reopened images in the copied project root. Start the Studio, connect and click **Blink Max** after `test-play-ready.txt` appears. The runner must remain active until the command arrives.

`MaxBridgeProtocolTest.cs` was a separate disposable Editor test of the HTTP status paths. Its pass result is retained one directory above. Do not import these test files into Karl's real Unity project merely to review the demo.

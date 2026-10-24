# Unity Bridge V1 — main-thread response fix

**Status: fixed source and disposable real-scene Play mode integration test passed. Karl's normal Editor session must reload the changed Unity scripts before its live result can be checked. Visual approval remains pending.**

## Root cause and reproduction

In Karl's running Unity Editor, `GET /health` and `GET /ping` returned HTTP 200, but `POST /command` with `max.blink` returned HTTP 503 after the two-second wait: `Unity main thread did not respond`. The listener's worker thread could answer health and Pong independently. Blink alone enqueued a command for `MonoBehaviour.Update()`, so a stopped or paused player loop left that command unprocessed while the panel incorrectly displayed **Connected**.

The Unity project had `runInBackground: 0`. Switching focus from the Game view to BrightTales is a plausible trigger for a paused player loop; [Unity's Play mode pause documentation](https://docs.unity3d.com/ja/6000.0/ScriptReference/MonoBehaviour.OnApplicationPause.html) describes this behaviour when Run In Background is disabled. The exact focus state of Karl's Editor at the time of the failure was not captured, so the observed root cause is the worker/main-thread readiness mismatch, with the disabled background setting as the likely trigger. The demo scene contains an enabled receiver and Max component; the listener was live on `127.0.0.1:17843`.

## Fix

- Unity project settings now enable **Run In Background**. The bridge also sets `Application.runInBackground = true` on enable and restores its previous value on disable, so switching to the Studio does not stop its player loop.
- `/health` returns ready only after recent `Update()` ticks. A paused or stalled Play mode now returns HTTP 503 rather than a false ready state.
- The listener starts and stops with the receiver component. On disable, queued commands are failed and released. A worker is tied to its own listener instance, preventing an old worker from surviving a quick restart. Unity API access remains only in `Update()`. Any exception during command processing produces a failed acknowledgement instead of silently waiting for a timeout.
- The Studio treats `Unity main thread did not respond` or an unready health response as unavailable and moves its panel to **Disconnected** with reconnect instructions. Connect, Ping, Pong and the localhost-only transport remain unchanged.

No approved sprite, blink timing, Studio animation, Scene Maker or export code was changed.

## Test and review evidence

- The actual `MaxBridgeDemo` scene ran in Unity Play mode in a disposable copy of the complete project, using port 17844 so Karl's open Editor on 17843 was untouched. [Unity Test Runner: 1/1 passed](unity-play-results.xml). The test verified the enabled scene receiver and Max component and observed two complete closed-to-open blink cycles.
- [HTTP result record](http-results.txt): Connect 200, Ping/Pong 200, first blink 202 accepted, immediate repeat 409 busy, second blink 202 accepted, reconnect health 200, Pong 200. The test ended without a freeze.
- [Updated H.264 review MP4](max-blink-twice-after-fix.mp4), 1280 × 720 at 30 FPS, shows the two open/closed/reopened Game camera states observed during that Play mode test. It is assembled from the captured state frames with review holds; it is **not** a continuous real-time recording of the Studio click. [Open](fix-open.png), [first closed](fix-closed-1.png), [first reopened](fix-reopened-1.png), [second closed](fix-closed-2.png), [second reopened](fix-reopened-2.png). Both open returns have the same PNG hash as the initial open frame, and both closed frames match. The MP4 decoded without FFmpeg errors.
- In a disposable browser profile, the updated Studio panel was driven against Karl's still-running **old** receiver. Its timeout now shows **Disconnected** and a useful message: [screenshot](studio-unavailable.png). Disconnect, Connect and Ping then returned to **Connected / Pong received**: [screenshot](studio-reconnected-pong.png). These validate the error and reconnection UI paths, not the fixed live Editor success path. The only browser console error was the expected HTTP 503 resource entry.
- BrightTales bridge tests **5/5 passed**; full suite **230/230 passed across 35 files**; production build **passed** with the existing bundle-size advisory. The Unity project's copied Max PNG still hashes identically to approved `public/art/max-0.png` (`7D1C4A26BEBDABD85B2114B8CA61DF4E5F83302AB21AA8C895F5438D75A98D24`).
- The disposable [scene test source and runner](harness/) are retained for reproduction. The test-only copy used port 17844; production code remains fixed to `127.0.0.1:17843`.

## Live Editor check still needed

The normal Unity Editor continued to serve its earlier compiled receiver while out of focus. Karl should bring Unity forward, wait for script compilation, **stop and re-enter Play mode** in `MaxBridgeDemo`, then use the Studio panel: Connect, Ping, Blink Max twice with a pause, Disconnect, Connect and Ping again. The panel should acknowledge each accepted blink, and Max should visibly close and reopen both eyes each time. If the Game view is manually paused, unpause it before connecting. The normal Editor success path is **not yet verified** here; the Play mode scene test above is verified.

No commit was made. Bridge V1 remains experimental until Karl visually accepts the fixed live result. No rigging, breathing, Maxine or further Unity integration follows from this fix.

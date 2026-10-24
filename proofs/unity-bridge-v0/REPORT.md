# BrightTales × Unity Bridge V0

**Status: experimental communication proof; awaiting Karl's approval.** This milestone does not import artwork or change scene rendering.

## Architecture and scope

BrightTales remains the React/TypeScript Studio. The separate Unity 6.6 Universal 2D template project gains one runtime C# receiver at `C:\Users\karlr\repos\BrightTalesUnityTest\Assets\BrightTalesBridgeV0.cs`. It binds a small HTTP receiver to `127.0.0.1:17843` only while Unity is in Play mode. No Unity packages or BrightTales dependencies were added. The Studio has an experimental **Unity Connection** tab; it makes no request until Connect is pressed and does not persist bridge settings in scenes or backups.

The V0 protocol is fixed: `GET /health` returns `{"status":"ready","source":"unity","version":0}`; `GET /ping` returns `{"type":"pong","source":"unity","version":0}`. Other commands return 404. The listener accepts browser origins only from local HTTP `localhost` or `127.0.0.1` and returns CORS headers for those origins. Disconnect stops client requests; the HTTP connection itself is short lived. Status reflects the last request, so a stopped Unity Editor is reported on the next Ping or Connect.

## Start and test

1. Open `C:\Users\karlr\repos\BrightTalesUnityTest` in Unity 6.6. Let Unity import and compile `BrightTalesBridgeV0.cs`, then open the Console and press **Play**. Look for `BrightTales Bridge V0 listening on http://127.0.0.1:17843`.
2. In `C:\Users\karlr\repos\brightsenappstales`, run `npm run dev`. Open the local URL printed by the launcher in a disposable browser profile.
3. Open **Unity Connection**. Its initial status is **Disconnected**. Press **Connect**, then **Ping**. The panel should display **Pong received from Unity**. Press **Disconnect** or leave Play mode to stop the test.

The port must be free. If Unity logs a bind error, stop the other process using port 17843 and re-enter Play mode. This V0 fixed port is deliberately not configurable in scene data.

## Verification

- `npm test -- --run src/unityBridge.test.ts`: 2/2 passed.
- `npm test -- --run`: 227/227 passed across 35 files.
- `npm run build`: passed; the existing large-bundle advisory remains.
- Browser UI in a disposable Playwright profile: Unity Connection opens disconnected with Ping disabled and no bridge request before Connect.
- Unity 6.6 compiled the receiver without C# errors. In a disposable copy of the Unity project, a batch mode Editor harness explicitly invoked the receiver's Play mode startup method. The Unity process bound `127.0.0.1:17843` and returned the exact health and Pong JSON above. The browser then completed Connect (`GET /health`, HTTP 200) and Ping (`GET /ping`, HTTP 200), displaying **Pong received from Unity**; Disconnect returned the panel to its off state. See [the Studio screenshot](studio-pong.png), [browser network record](network-requests.txt), [accessible UI snapshot](studio-pong-snapshot.yml) and [Unity log excerpt](unity-log-excerpt.txt).
- A foreign browser origin returned HTTP 403 and an unknown command returned HTTP 404. The disposable Unity process shut down and released the port.

The already-open normal Unity Editor could not be activated from this automation session, so clicking **Play** in that Editor was not verified. The batch mode harness exercised the same compiled receiver in a real Unity process by invoking its startup method in Edit mode. Karl can use the steps above to check the Play mode lifecycle in the normal Editor. An initial Connect attempt before Unity was ready produced expected connection-refused console entries; the successful requests produced no new console errors.

No approved characters, animation timing, scene exports, Living World behaviour, or Unity scene assets were modified. No commit was made. The bridge remains an experimental opt-in proof until Karl reviews it.

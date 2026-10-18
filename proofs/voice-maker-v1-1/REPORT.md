# Voice Maker V1.1 — automatic voice service management

18 October 2026. Scope: make the existing Voice Maker Python service start, report, recover and stop with BrightTales, so nobody has to run `py -3.12 voice_local.py` by hand. No cloning, no cloud, no new repository, no Music Studio audio changes.

## Result

**Karl opens BrightTales normally, goes to Voice Maker and the voice engine reaches Ready on its own.** Verified on the normal production launch (`npm start`) and the normal development launch (`npm run dev`), in a disposable Chrome profile, with real Piper/Kokoro speech and a real microphone recording.

## Startup architecture used

BrightTales is a local web application with no Electron shell and no separate backend. The V1.1 work reuses that one application lifecycle rather than adding a launcher of its own:

- `scripts/studio.cjs` is now the single entry point. `npm run dev` runs it in development (it creates the Vite server and installs the voice middleware as a plugin), and `npm start` runs it in production (it serves `dist/` from `127.0.0.1:4177`, falling back to 4178–4181 if a port is busy).
- The same process hosts `/voice-api/*` and `/voice-manager/*` on the app's own origin, so the browser never needs to know a second port and cannot start a process itself.
- `scripts/voice-lifecycle.cjs` (`VoiceServiceManager`) owns the service: it probes candidate ports for a compatible running service (name + protocol version 2), otherwise spawns `voice_local.py --port <n>` as its own child with a random owner token, and polls `/voice-api/health` for real readiness rather than sleeping a fixed time.
- `voice_local.py` exposes `/voice-api/health` (including dependency/model readiness) and `/voice-api/owner/shutdown`, which requires the owner token. The manager never exposes that endpoint to the browser.

## Files changed in this milestone

- `scripts/voice-lifecycle.cjs` — service manager, middleware, health probe, restart budget, shared-service grace window, transient-failure tolerance.
- `scripts/studio.cjs` — single launcher for dev and production; owns the manager and stops it on shutdown.
- `voice_local.py` — health endpoint and token-protected owner shutdown.
- `src/VoiceMaker.tsx`, `src/voiceApi.ts` — status indicator, Retry, plain-English errors, no manual-start instructions.
- `test_voice_service.cjs` (new), `package.json` (`test:service`), `vite.config.ts` (proxy removed; middleware is owned by the launcher).
- Docs: `README.md`, `docs/USER_GUIDE.md`, `docs/ARCHITECTURE.md`, `docs/VOICE_MAKER_V1_1_AUDIT.md`, `docs/ROADMAP.md`, `docs/PROJECT_STATUS.md`, `docs/BATCH_REVIEW.md`.
- Verification: `proofs/voice-maker-v1-1/verify-v1-1.mjs`, `regression-smoke.mjs`, `browser-results.json`, `browser-results-unavailable.json`, `regression-results.json`, screenshots.

## Defects found during verification and fixed

1. **Duplicate service.** A second launcher sharing the first launcher's service started its own copy during the owner's restart window. Two Python processes then held the same port, which Windows permits. Fixed with an explicit shared/owned flag and a 9-second grace window in which a launcher waits for the owner to restore the service before considering a private copy.
2. **False "stopped repeatedly".** One failed health check was treated as a crash. While the service was synthesising or running FFmpeg (health failed 1 of ~120 polls under four concurrent requests), a launcher could exhaust its restart budget and report an error for a healthy service. Fixed by requiring three consecutive failures and allowing the health probe 2500 ms; the startup readiness loop keeps a tighter 900 ms probe.
3. **Stale instructions.** `voiceApi.ts` still told users to "Start voice_local.py". Removed.
4. **Verification hazard.** The first browser harness killed browsers with `taskkill /PID`, which twice took down unrelated Node processes when a PID had been recycled. The harness now matches the disposable profile path instead and never kills by PID.

## Verification evidence

Automated:

- `npm test` — **156/156 passed** across 22 files.
- `npm run test:service` (`test_voice_service.cjs`) — **11/11 passed**, covering: foreign servers and wrong protocol versions are never adopted; a compatible running service is adopted rather than duplicated and is never stopped; an occupied preferred port falls back without touching the occupier; a missing Python interpreter reports a plain error and never a false Ready; shutdown stops only the owned child and leaves nothing listening; a crash is recovered and the restart loop is bounded; a second launcher waits for the owner's restart instead of duplicating; a busy-but-healthy service is not treated as a crash; Retry clears the budget; only loopback Studio requests reach the endpoints; voice requests are refused while not ready and proxied when ready.
- `npm run build` — passed.
- `py -3.12 test_voice_local.py` — existing audio processing tests unchanged.

Live service behaviour (production launcher, ports 8766):

- Launch → `/voice-manager/status` = `{"state":"ready","owned":true,"port":8766}` with no manual Python step; a real `voice_local.py --port 8766` child was present.
- Real synthesis through the app origin: Kokoro line produced a 125,996-byte WAV in 2.4 s.
- Second launcher on 4178 adopted the same service (`owned:false`); still exactly **1** voice process.
- Killing the managed Python child: the owner restarted it within ~2 s and the second launcher reconnected; still exactly **1** voice process for the whole 30-second observation.
- Retry without the Studio header → 403; `POST /voice-api/owner/shutdown` from the app origin → 404 (a browser cannot stop the service); Retry with the Studio header → 202 and Ready again.
- Deliberate broken interpreter (`BRIGHTTALES_PYTHON=C:\no-such-folder\python.exe`): status `error`, detail "Required Python executable is missing."

Browser (disposable Chrome profile, fake microphone device):

- `verify-v1-1.mjs ready` against **both** `http://127.0.0.1:4177/` (production) and `http://127.0.0.1:5173/` (development): app loaded, **Voice engine: Ready** with no manual step, status read from the health check, 61 voices listed, generated Piper dialogue, applied an effect preset, saved the edited speech, recorded 2.46 s through the microphone, edited and saved it, and after a reload the engine was Ready again with all 4 saved voices intact. **0 console errors, 0 failed requests.**
- `verify-v1-1.mjs unavailable` with the broken interpreter: the panel showed **Voice engine: Error / Required Python executable is missing.**, a **Retry voice engine** button was offered, **Generate dialogue** was disabled, and clicking Retry moved to Starting without ever showing a false Ready.
- `regression-smoke.mjs`: all ten sections opened, Music Studio editor rendered its export control, Studio Backup exported **version 8** with audio assets intact, Audio Library opened, **0 console errors and 0 failed requests**.

Evidence files: `browser-results.json`, `browser-results-unavailable.json`, `regression-results.json`, `voice-engine-ready.png`, `voice-engine-unavailable.png`, `voice-generated.png`, `voice-recorded-edited-saved.png`, `voice-after-reload.png`, `auto-launch-kokoro.wav`.

Restart: BrightTales was fully closed (launcher and voice process both gone) and reopened; the engine returned to Ready automatically and the full browser workflow passed again.

## Remaining limitations

1. **Python and models are not bundled.** A clean machine without Python 3.12, Piper/Kokoro, ONNX Runtime, FFmpeg and the model files (currently read from the sibling `C:\Users\karlr\repos\BrightTales\assets\voices`) reports Unavailable/Error with the reason and a Retry button, and every other Studio feature still works. Nothing is downloaded or installed automatically. The safest reproducible route is a project `.venv` (used automatically when present) plus a documented model directory; a fully self-contained installer is a separate decision for Karl.
2. **Graceful shutdown was verified at the manager level, not by Ctrl+C.** Node on Windows cannot receive SIGINT from a test harness, so `npm run test:service` proves the owned child is stopped and no orphan remains. Closing the terminal with Ctrl+C runs the same `shutdown()` path. A window killed outright (Task Manager) leaves the Python child running; the next launch adopts it instead of duplicating it, which is the intended safety net.
3. **Two BrightTales windows share one service.** If both are open, closing the window that owns the service restarts it for the other window within the grace window; recordings and unsaved edits are held in the page and are not lost by a service restart.
4. **Karl's microphone and speakers remain unverified by this automated run.** The recording here used Chrome's fake capture device; he should still record his own voice and listen to generated and edited speech.
5. **Music Studio's starter-tune panel did not render in a fresh automated profile**, so this run did not re-verify a full music render in the browser. `MusicStudio.tsx`, `musicRender.ts`, `musicProject.ts`, `musicAssets.ts` and `instruments.ts` are byte-identical to the last commit (`git diff` empty), and the Music Studio audio tests pass; this is a pre-existing UI detail, not a V1.1 change.
6. **Song SHA-256 equality remains unresolved** from M6.6B and is unaffected by this milestone.
7. **One unreproduced transient.** While switching between launcher configurations, a `npm start` launcher printed its URL and then exited silently with no output on stdout or stderr. Two deliberate close-and-reopen cycles afterwards both reached Ready with exactly one voice process, so it could not be reproduced and no cause was identified. Worth watching during Karl's own review.

## Approval state

Technically verified. **Not approved by Karl.** The batch gate stays where `AGENTS.md` left it: Karl still owes his microphone, speaker and visual review, and M6.7 and Beat Blocks remain unstarted.
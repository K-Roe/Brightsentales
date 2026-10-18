# Voice Maker V1.1 startup audit and plan

18 October 2026. Approved scope: automatic management of the existing local Voice Maker service in this repository.

## Findings before implementation

- The application is a local web app: React/TypeScript in Vite. There is no Electron desktop process or existing backend. The normal development path is `npm run dev`, which starts Vite on `127.0.0.1`; production is `npm run build`, a static `dist/` directory. No production application launcher is currently defined.
- V1 added `voice_local.py`, a loopback Python server on port 8766 that also serves `dist/`. Vite proxies `/voice-api` to that port. Users must separately run `py -3.12 voice_local.py`. Closing Vite does not own or stop that Python process. The frontend calls `/voice-api/voices`, `/synthesize` and `/process`; it infers availability from the voice-list request and has no actual service-health state or retry control.
- There is no existing service registry, health endpoint, ownership protocol, restart limit or managed shutdown. A browser page cannot launch Python by itself. Tests use disposable Chrome profiles and must keep them isolated from Karl's normal browser.
- This Windows environment has `py -3.12`, Piper, Kokoro, ONNX Runtime, FFmpeg and the models under the sibling `BrightTales/assets/voices` directory. The repository does not bundle Python, FFmpeg or models. A clean machine or static-only deployment is not yet sufficient for AI speech.

## Implementation plan and acceptance checklist

1. Add a versioned loopback health endpoint with a real dependency/model readiness check and an owner-token shutdown endpoint to the existing Python service. Keep model synthesis and effects intact.
2. Add one small Node service manager used by both launch modes. Vite's existing plugin lifecycle will own it for `npm run dev`; `npm start` will serve the built application and own it for production. Both proxy voice calls on the same origin. The manager will recognize a compatible already-running service, use another loopback port if an unrelated process occupies the preferred port, and stop only its own child.
3. Expose Starting, Ready, Unavailable and Error plus controlled Retry in Voice Maker. Check the versioned health endpoint before Ready; monitor bounded crash recovery without clearing current recording/editor state.
4. Test normal development launch and built production launch without a manual Python command, two concurrent launchers, an occupied preferred port, crash/retry, restart and ownership-safe shutdown. Then run existing voice workflow, frontend/audio tests and build. Report Python/model packaging limits separately; do not silently install or download them.

## What was implemented

- `scripts/studio.cjs` is now the single entry point for both `npm run dev` and `npm start`, so the application lifecycle owns the service rather than a second terminal. It serves the app and installs the same-origin `/voice-api/*` and `/voice-manager/*` middleware in both modes.
- `scripts/voice-lifecycle.cjs` holds the `VoiceServiceManager`: compatibility probe by service name and protocol version, port fallback, readiness polling against the real health endpoint, bounded crash recovery, shared-service grace window, Retry, and ownership-safe shutdown through the owner token.
- `voice_local.py` gained `/voice-api/health` (with real dependency/model readiness) and `/voice-api/owner/shutdown` (token required). Synthesis and effects are unchanged.
- `VoiceMaker.tsx` shows Starting, Ready, Unavailable and Error with a plain-English reason and a Retry button, and never shows Ready before the health check passes.

## Defects found during verification and fixed

1. A second launcher that was sharing another launcher's service started its own copy while the owner was restarting, leaving two Python services bound to the same port (Windows allows this). Fixed with an explicit shared/owned flag and a bounded grace window; covered by `test_voice_service.cjs`.
2. The monitor treated a single failed health check as a crash. While the service was busy synthesising or running FFmpeg, a launcher could report "Voice service stopped repeatedly" even though the service was healthy. Fixed by requiring consecutive failures and allowing more time for a health answer; covered by `test_voice_service.cjs`.
3. Stale user-facing messages still told users to "Start voice_local.py". Removed from `voiceApi.ts`.
4. After the owner's service died, the passive launcher reported the shared service as missing instead of waiting for it. Reported as "Waiting for the shared voice service to come back."

# Episode Health Check V1

**Status:** Implemented and automated verification passed. Real Studio UI click-through was not captured in this session; Karl's visual/manual review remains open.

## Repository and commit

- Studio: `C:\Users\karlr\repos\brightsenappstales`, branch `main`.
- Implementation commit: `d3777bdfec8852b7459803fef4618ce8d7763509`.
- Cue-selection navigation follow-up: `09911771ef4941b3f1a375a5e5228dc0a57d624c`.
- Unity: `C:\Users\karlr\repos\BrightTalesUnityFoundationIntegration`, branch `cartoon-foundation` at `46e2b30a4807e699f81d42cea45132780c93c8c6`. No Unity files were changed because this work only reports Unity's existing Editor status and transfer compatibility.
- Pre-existing Unity modifications to `Settings.json` and `ProjectAuditorSettings.asset`, plus unrelated Studio untracked proof/browser artifacts, were preserved and not staged.

## Implementation

The Episode Maker now includes **Check Episode**. It groups findings into Errors, Warnings, and Passed checks, shows error and warning totals, and offers **Go to** actions for scene, camera, and audio findings where the existing editor has a usable destination.

`src/episodeHealthCheck.ts` composes existing validators rather than defining another episode model: `validateEpisodeLibrary`, `validateTimedLibrary`, `episodeTimingIssue`, `episodeCameraIssue`, `episodePlaybackClips`, the shared audio reference validator used by WebM export, and the exporter's `videoFrameCount`. It checks saved scene/intro/credits references, scene actions and character identities, available saved Brightlings, camera targets/timing, referenced audio metadata and blobs, voice-to-audio compatibility, location background references, scene-boundary audio trimming, episode-end cues, duration/frame boundaries, and known Unity episode limitations.

Unity Editor status is queried through the existing authenticated status endpoint only. The health check never starts Play Mode. An unavailable status endpoint is reported as a warning with the existing review-launcher instruction. Preview-only and export-only findings are scoped separately; warnings do not block operations. The same report rules are applied before one-click Unity preview and WebM export, while their existing specialized validators and error handling remain in place.

Scene audio that extends beyond a source-scene/occurrence boundary is retained as a warning because the existing episode clock shortens it at that boundary. Episode audio that extends beyond the ending is reported as shortened; a voice overrun remains an error. No episode content is modified automatically.

## Verification

- Focused command: `npx vitest run src/episodeHealthCheck.test.ts src/sceneVideoExport.test.ts src/studioEpisodeBridge.test.ts` — **24/24 passed**.
- Full Studio suite: `npm test -- --run` — **370/370 passed**, 53 test files.
- TypeScript and production build: `npm run build` — passed. Vite reports the existing style of advisory for the 691 kB JavaScript bundle.
- `git diff --check` — passed.
- Unity/service tests were not run because no Unity, service, or bridge implementation changed.

Coverage includes valid episodes; empty and missing scenes; missing saved Brightlings; scene action boundaries; invalid camera targets; missing audio; audio crossing a scene cut; voice cues beyond the episode end; export-duration limits; final-frame boundary calculation; and operation-specific blocking.

## Application evidence and limitations

**Not verified:** a real Episode Maker click-through, rendered screenshot, Unity-status response from a live browser session, or manual navigation from a finding. The required in-app browser automation runtime was unavailable, so no alternate browser profile was used. Automated tests and the production build verify the report model and integration compile, not Karl's visual acceptance.

The asset check verifies saved location/background references, Brightling definitions, and audio file metadata/Blob compatibility. It does not decode every background/sprite image or audio file when the Check button is pressed. The existing render/export path still performs its actual image and audio loading and reports failures. Unity readiness reflects the authenticated Editor-control status at check time and can change immediately afterward.

## Manual review

1. Start BrightTales using the existing `Start-BrightTales-Review.cmd` launcher and open a saved episode.
2. Click **Check Episode**. Review the error/warning totals and each Passed checks group.
3. If a finding offers **Go to scene**, **Go to shot**, or **Go to cue**, use it and correct the item in the existing editor. Save, then run Check Episode again.
4. Confirm a closed Unity Editor is reported as not ready, and that the check does not start Play Mode. Open the BrightTales Unity project with the launcher and check again to see Editor readiness.
5. Once blocking errors are resolved, test **Preview Episode in Unity** and **Export WebM** through their existing workflows. The health check does not replace watching/listening to the full exported episode or Karl's manual acceptance.

## Remaining review

- Karl's Studio visual/usability review of the Episode Maker panel and finding navigation.
- Confirm the displayed findings are understandable against a real saved episode.
- Existing P8-P11 visual and physical-audio acceptance gates remain unchanged.

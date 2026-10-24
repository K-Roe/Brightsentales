# Cartoon production foundation audit — 2026-10-24

This is a source and evidence audit, not a visual acceptance result. The approved recovery commits are Studio `137219da60565a780995c44201834ce820d41544` and Unity `9cf90954a54c66fd53d0a05890b18fa4cb7c0d21`. Studio `main` is `39e089d88fa90a7efe1002789c3df779651e95b1`; it has additional Camera/Life/Scene Maker work and is not a descendant of the approved Studio commit. Both approved branches remain intact. Work continues on isolated `cartoon-foundation` worktrees.

| System | Classification | Implementation | Proof / focused checks | Integration finding |
| --- | --- | --- | --- | --- |
| Max, Maxine, custom Brightling identities and template recolouring | EXISTS AND APPROVED for originals and Maker foundation | `src/maker.ts`, `src/library.ts`, `src/Characters.tsx`, `public/art/`, `public/recolour-masks/` | `src/maker.test.ts`, `src/library.test.ts`, `README.md` | Unity has approved Max/Maxine sprites only; custom sprite transfer is missing. |
| Places and Living Room artwork | EXISTS AND APPROVED for supplied Living Room | `src/Places.tsx`, `src/places.ts`, `public/art/` | `docs/USER_GUIDE.md`; Unity `Assets/CartoonEngineV1Experimental/living-room.png` | Other places require supplied artwork; Unity mapping is missing. |
| Timed Scene Maker, actions and visual timeline | EXISTS AND APPROVED for core actions; other actions retain their individual gates | `src/timedScenes.ts`, `src/SceneMaker.tsx`, `src/SceneTimeline.tsx`, `src/timelineEditing.ts`, `src/scenePreview.ts` | `src/timedScenes.test.ts`, `proofs/max-maxine-greeting-v3/REPORT.md`, `docs/BATCH_REVIEW.md` | Saved scenes are not sent to Unity; current bridge sends fixed 26-second config. Rejected sitting/toy actions must stay disabled. |
| Episode Maker and complete browser WebM export | EXISTS BUT NEEDS TESTING for this mission | `src/episodes.ts`, `src/EpisodeMaker.tsx`, `src/sceneVideoExport.ts`, `src/audioPlayback.ts` | `src/episodes.test.ts`, `proofs/episode-1/`, `docs/USER_GUIDE.md` | Source includes real-time complete-episode WebM export. Current architecture docs still call it planned. Unity episode playback/export is missing. |
| Camera System V1 | EXISTS AND APPROVED | `src/camera.ts`, `src/CameraPanel.tsx`, `src/scenePreview.ts` | `proofs/camera-system-v1/REPORT.md`, `src/camera.test.ts` | Unity fixed demo has bounded camera shots; saved keyframes are not transferred. |
| Audio Library, Voice Maker, Music Studio, Bright Speak | EXISTS BUT NEEDS INTEGRATION with Unity | `src/audio.ts`, `src/audioStore.ts`, `src/audioPlayback.ts`, `src/VoiceMaker.tsx`, `src/musicRender.ts`, `src/phone.ts`, `scripts/studio.cjs` | `proofs/voice-maker-v1-1/REPORT.md`, `proofs/m6-6a/REPORT.md`, `src/audio.test.ts`, `src/phone.test.ts` | No Unity audio resolution or transfer. Max remains non-verbal; device speech uses existing clip metadata. |
| Backup v8 and crash recovery | EXISTS BUT NEEDS TESTING for end-to-end example | `src/studioBackup.ts`, `src/restoreCoordinator.ts`, `src/Characters.tsx` | `proofs/f4/REPORT.md`, `src/studioBackup.test.ts`, `src/restoreCoordinator.test.ts` | Preserve stable IDs and v1–v7 import; use disposable browser data. |
| Director Controls Bridge V2 and Blink Max | EXISTS AND APPROVED | `src/unityBridge.ts`, `src/UnityConnection.tsx`; Unity `Assets/BrightTalesBridgeV0.cs` | `src/unityBridge.test.ts`, Unity `DirectorControlsBridgeV2Review/APPROVAL.md` | Keep localhost/main-thread command handling and truthful acceptance messages. |
| Cartoon Engine V1.1 | EXISTS AND APPROVED as a fixed scene | `src/CartoonEngineV1Panel.tsx`; Unity `Assets/CartoonEngineV1_1Experimental/CartoonSceneV1_1.cs`, `Assets/Scenes/CartoonLivingRoomV1_1Experimental.unity` | `proofs/cartoon-engine-v1-1/APPROVAL.md`, Unity `CartoonEngineV1_1Review/APPROVAL.md`, MP4 and focused Play XML | Its authored timeline, cast and room are deliberately fixed; do not alter it while building general transfer. |
| Character Acting V1.2 and Portal V1 | EXPERIMENTAL | Unity `Assets/CharacterActingV1_2Experimental/`, `Assets/PortalV1Experimental/` | Unity `CharacterActingV1_2Review/REPORT.md`, `PortalV1Review/REPORT.md` | Reuse approved Director Controls seam only. Do not integrate Portal V1. |
| Greeting V1/V2, Batch 3, sitting and toy pickup | REJECTED OR DEFERRED | `src/timedScenes.ts`, `src/SceneMaker.tsx`; disabled source retained | `proofs/max-maxine-greeting-v3/REPORT.md`, `docs/BATCH_REVIEW.md` | Reject these in Unity compatibility validation. Greeting V3 artwork remains blocked. |
| Saved-scene/episode Unity transfer, audio sync, MP4 export | GENUINELY MISSING | Current `src/unityBridge.ts` accepts only `living-room-greeting-26s-v1` or `living-room-story-26s-v1-1`; Unity receiver dispatches to those controllers | `src/unityBridge.test.ts`, Unity `CartoonEngineV1_1Review/REPORT.md` | Implement in phases on the existing localhost bridge, with a single timeline clock and explicit unsupported-feature reports. |

## Phase 0 acceptance checklist

- [x] Read repository instructions, project docs, approval evidence and relevant source in both repositories.
- [x] Confirm local branch/commit state and create isolated worktrees.
- [x] Record source-backed feature and approval classifications before broad implementation.
- [ ] Create and verify a private Unity GitHub repository with approved commit and LFS evidence.
- [ ] Push Studio approved branch only after remote destination and history are verified.

No scene, episode, audio, export or browser-to-Unity end-to-end acceptance has been claimed by this audit.

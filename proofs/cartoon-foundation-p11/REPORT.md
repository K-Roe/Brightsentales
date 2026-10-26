# P11 Episode Production & Polish

**Authorised by Karl: 2026-10-26.** Development is on the existing `brighttales-active-development` branch in Studio and Unity. No milestone branches or protected-branch merges are authorised. P8–P10 backups, reports and unrelated Unity workspace changes must be preserved. No P12.

## Approved scope

Deliver a beginner-friendly end-to-end episode workflow using existing BrightTales systems. A director must be able to select two modular Brightlings, compose them into saved scenes at an existing location, position them, use existing walking/waving/idle actions, add camera shots/targets/movement and supported voice/music audio, scrub and preview the episode, save/reopen it, transfer it to Unity for playback, and export through the existing supported exporter. Unity must use the existing Brightling auto-builder and episode/scene player; it must construct missing supported cast members without manual asset creation.

Create one short experimental demonstration episode without overwriting approved episodes. It must include two visibly different modular Brightlings, an existing location, walk and wave actions, at least two camera shots, one supported audio cue, and a beginning and ending.

Keep the existing Episode Maker, character/scene stores, deterministic preview/export, audio path, camera director and Unity bridge. Preserve character identity, appearance, action timing, camera targets, scene order and legacy episodes. Do not modify Max/Maxine artwork or add a rendering/animation architecture, Blender, Vue, AI services, unrelated features or P12.

## Verification requirements

Run Studio tests/build and relevant Unity character builder, bridge, camera, episode and audio tests. Complete a real disposable-browser-to-Unity workflow where possible. Capture real application screenshots, logs and export evidence. Document unverified graphical/audio checks honestly; automated checks do not grant Karl's manual acceptance.

## Implementation and verification update (2026-10-26)

P11 extends the existing Episode Maker and Unity episode player; it does not introduce a second editor or renderer. The episode camera target list now resolves modular Brightling stable IDs to saved character names in the Inspector. The Unity episode payload validator now accepts only correctly shaped modular Brightling target IDs that are present in the episode cast, while retaining the `max`, `maxine` and fixed-point targets. The scene action editor labels the existing canonical `wait` action as **Idle / Wait**, preserving compatibility with saved episodes and Unity's current rest action. Episode Unity Preview help now describes the supported modular cast and accurately states which Studio-only elements are omitted.

Automated Studio coverage adds named modular camera targets, a two-character/two-scene bridge contract preserving character definitions, appearance, actions, camera targets, episode audio and occurrence timing, plus a deterministic experimental episode manifest check. The Unity Play Mode test adds two distinct modular cast members, camera targeting/following, walk/wave playback, deterministic replay, identity deduplication and reset assertions.

The demonstration episode fixture is [`demo-episode.json`](demo-episode.json), titled “Pip and Mallow: A Friendly Visit.” It references the existing Living Room, two P10-supported modular library definitions, idle/walk/wave actions, four camera shots, a beginning and ending, and the existing soft-chime audio asset. This is a deterministic manifest fixture, not a live Studio UI-authored saved episode or application screenshot.

### Studio results

- Focused episode/camera/bridge/demo suite: **27/27 passed**.
- Complete Studio suite: **50 files, 342 tests passed** (`npm test -- --run`).
- Production build: **passed** (`npm run build`); Vite reports its existing advisory about the approximately 656 kB main chunk.
- `git diff --check`: passed.

### Unity and application results

- Unity modular saved-episode/camera test: **1/1 passed**, [`unity-focused-camera.xml`](unity-focused-camera.xml). It constructed two distinct modular actors, evaluated walk/wave, directed wide/medium/follow shots at their stable IDs, checked replay framing, prevented duplicate actors and reset the cast. The raw Editor log is present in the local proof folder and ignored by the repository's `*.log` rule.
- Existing Unity episode timing/audio/camera regression class: **5/5 passed**, [`unity-episode-regression.xml`](unity-episode-regression.xml). This covers ordered playback/replay, occurrence timing/fades, episode and scene audio through cuts, camera cuts/pan/follow determinism and malformed camera rejection. Its raw Editor log is present locally and ignored by `*.log`.
- A separate broad Unity Play Mode invocation was inconclusive: it selected the whole test assembly and blocked in an existing browser-transfer test waiting for an external Studio request. I stopped only the batch Editor process I launched; its partial local `unity-playmode.log` is ignored by the repository's `*.log` rule and is not presented as a test result.
- A separate P9 review Editor process was left untouched. The five unrelated settings files' before/after SHA-256 values match; no settings changes were staged or committed.
- Browser-to-Unity P11 episode workflow, Unity Game-view appearance/playback, Studio UI screenshots and a complete exported episode were **NOT VERIFIED** in this run. The available browser control does not expose the required disposable-browser session tool.
- P10's prior focused builder/bridge tests remain baseline evidence; this run did not repeat the builder HTTP bridge tests because the actual browser-to-Unity application workflow is still unverified.

### Review boundaries and remaining work

P11 has focused technical verification in Studio and Unity but its full definition of done is **not yet established** because the live end-to-end workflow did not complete. Karl should run the launch instructions in [`docs/ACTIVE_DEVELOPMENT.md`](../../docs/ACTIVE_DEVELOPMENT.md), then review P8 camera/audio, P9 auto-builder, P10 modular Maker and this P11 episode workflow. Studio visual approval, Unity Game-view visual approval and physical audio listening remain pending; automated tests do not grant acceptance. Do not merge the active branch into protected integration branches.

P11 implementation commits are pushed on the authorized active branches:

- Studio `brighttales-active-development`: implementation and evidence `5d2ba8ad3231fad7bc0b9cf1e05df852c4490835`.
- Unity `brighttales-active-development`: source and focused Play Mode coverage `623a2651acd4a37c236467f8201a97d5454c0a48`.

The subsequent Studio state-document refresh is recorded in the branch history after the implementation commit. Neither protected integration branch was changed.

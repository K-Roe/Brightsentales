# Editable Bright Speak message — Studio 3.1 amendment

**Status:** technically verified; awaiting Karl's final Studio 3.1 freeze approval. Karl approved the core direct-animation workflow at `ae859ef5ff1f2a557afb6c69295033a10660a4d6`. This amendment stays on the isolated `studio-3.1-direct-animation` branch. No merge, P3 work, Unity source change, artwork change or project-format migration.

## Change

`TimedScene.phone` already stored a `message` on each Communicate Message interaction, and the shared `phoneStateAt`/Canvas renderer already displayed it. The professional timeline did not show phone interactions, and the Inspector message field was only accessible from a nested advanced list. The editor now shows compact Bright Speak clips on the existing timeline; selecting a clip opens its contextual Inspector with its free-text Message field and a Preview message on stage button. Optional starter phrases remain tucked away. Message text stays on each action ID, so different clips can say different things.

New text-only Communicate actions start with an empty message to invite Karl to write the line. Play and Save become available after valid text is entered. They no longer receive an unmatched voice clip ID. Older saved Communicate actions with no `message` field validate and display the previous starter text, **“I'm hungry!”**, without rewriting the stored action. Existing symbols, pop-up placement and optional saved speech remain available.

## Automated checks

| Check | Result |
| --- | --- |
| Focused phone, timed-scene and timeline tests | 44/44 pass |
| Full `npm test` | 41 files, 295/295 pass |
| `npm run build` | Pass; existing Vite bundle-size advisory |
| `npm run test:service` | 11/11 pass |

Focused tests cover validation and playback for custom text, two independent messages, JSON save/reopen/edit, and an older message-less action. The Unity bridge contract test still rejects unsupported Bright Speak scenes with its explicit reason. The disposable-browser script checks UI creation, timeline selection, both text values, save, browser close/reopen, edit, replay and Classic playback. It reads browser storage only to assert the saved data; it does not write scene JSON.

The disposable-browser run passed all five stages with no console errors or failed requests. It saved a ten-second Living Room scene with Max taking out Bright Speak, `Can I have a drink?` at 0.55 seconds and `I need a break.` at 3.55 seconds. After reopening the same disposable profile, it selected each timeline block, edited the second message to `Thank you!`, saved and replayed. Classic playback visibly showed the first custom message.

## Review evidence

- [Editable message Inspector](01-editable-message-inspector.png)
- [First message on the stage](02-first-message-preview.png)
- [Two selectable Bright Speak clips](03-independent-timeline-actions.png)
- [Second message on the stage](04-second-message-preview.png)
- [Edited message on the stage after reopen](05-edited-message-preview.png)
- [Classic playback](06-classic-playback.png)
- [Playback recording](bright-speak-editable-playback.mp4)
- [Browser assertion result](browser-workflow-results.json) and [reproducible browser script](browser-workflow.mjs)

The H.264 recording captures the built Studio's browser playback. FFprobe measured 10.000 seconds, 1584×854 and 50 frames; FFmpeg fully decoded it without error. It is a review recording, not an in-app exporter. The Unity saved-scene bridge was not changed; Bright Speak phone actions remain outside its supported scene-transfer subset. Karl's final visual freeze decision remains pending.

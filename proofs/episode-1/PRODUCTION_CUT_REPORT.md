# Meet Max — complete first cut for Karl and Astra review

19 October 2026. **Production cut delivered; final production acceptance pending.**  
**Final deliverables:** see [proofs/episode-1/final-production/FINAL_REPORT.md](final-production/FINAL_REPORT.md).

## Deliverables

- Complete, playable Studio export: [meet-max-episode-1-first-cut.webm](production/meet-max-episode-1-first-cut.webm) (69,538,159 bytes; SHA-256 `C3AF3E3BFA0DDFB749DFBEE12F1AD0DD1ACE2EF4C265E33452A565AC95C7F21A`).
- Matching editable [Studio Backup v8](production/meet-max-episode-1-studio-backup.json). Import through Characters → Import Studio Backup to reopen the six scenes, intro, credits, voice assets and episode. Back up the receiving Studio profile first because import replaces its current data.
- UI production record: [automation script](produce-episode-1.mjs), [session results](production/session.json), [episode reopened](production/episode-reopened.png), [episode exported](production/episode-exported.png).
- Representative exported frames: [intro](production/00-intro.png), [Max](production/01-max-wave.png), [Maxine](production/02-maxine-walk.png), [phone held](production/03-phone-held.png), [phone tap](production/03-phone-tap.png), [Bright Speak message](production/03-phone-popup.png), [Bright Stars](production/04-stars.png), [garden friendship](production/05-garden-interaction.png), [goodbye](production/06-goodbye.png), [credits](production/07-credits.png).

## Production content

The episode runs 256 seconds by its video and audio packet timestamps, within the requested 3–5 minutes. Intro/title (14 s) precedes six scenes: Max's bedroom (36 s), Maxine's bedroom (34 s), Kitchen (50 s), Living Room (34 s), Garden (43 s), and front of Max's house (31 s). Credits close the episode (14 s). The approved Native2D Max and Maxine and six approved Places are used; the Living Room is the protected existing artwork. The scene images show both Brightlings together in the Garden and at the house front.

Lily was selected provisionally from the four British female local voice samples. The Voice Maker UI generated all seven narration passages at 0.90× pace and saved them as reusable Audio Library assets; a distinct device voice delivers “I'm hungry!” during Max's established Bright Speak interaction. Max has no character dialogue track. Each narration clip ends inside its scene, and the device line does not overlap narration. Gentle piano music was composed and placed through Music Studio and the existing audio lanes at low volume; a sparkle effect accompanies Bright Stars. The intro, title and credits were built through their Studio makers. The episode and its scenes were saved, reloaded and reopened through the UI before export. No project JSON or database was manually authored to create the production.

## Media and visual checks

FFprobe reports VP9 1672×941 video and stereo 48 kHz Opus audio. Video packet timestamps reach 256.123 s and audio packets reach 256.121 s. The video has 6,132 frames with no gap over 0.417 s. FFmpeg decoded the complete file with exit code 0; it reported four duplicate/nonmonotonic DTS warnings through its null output muxer. Representative frames from all sections, including the full phone sequence, were extracted from the exported WebM and inspected. The phone is held and tapped; the Bright Speak bubble displays the food icon and “I'm hungry!”; Max's mouth does not animate for that device line. The approved backgrounds and Native2D designs appear intact in the sampled exported frames.

Final regression checks: frontend tests **186/186 passed**, voice-service tests **11/11 passed**, Python voice tests **6/6 passed**, and `npm run build` passed. These checks support the code paths; they do not replace the media and human reviews.

The export was checked technically for audio tracks, levels and narration placement, but this agent environment has no physical audio listening capability. Whether Lily sounds sufficiently natural, whether the music balance feels right, and final creative quality are **pending Karl and Astra's playback review**. This document does not claim human production acceptance.

## Known limitations and later export defect

- In this first cut, Maxine's garden walk moves away from Max before they gesture together. Both remain visible, correctly scaled, and interact; staging can be refined after review.
- The first-cut credits include the editorial phrase “Provisional British voice.” It is visible in the credits, not spoken.
- The garden and house-front artwork depict daylight although the goodbye narration says “goodnight.” No approved background was altered to simulate dusk.
- A later UI-only editorial revision changed the garden walk direction and removed the credit phrase in the [revised editable backup](production/meet-max-episode-1-review-cut-studio-backup.json). Its two Studio exports have broken media timing: one has large video-frame gaps and a silent audio tail to ~383 s; a fresh-browser re-export has no large frame gaps but video ends around 250 s and a silent audio tail continues to ~342 s. Neither is the delivered review video. The matching 256 s first cut above is the reliable playable export. This long-export timing defect needs investigation before a revised cut is delivered; the later files must not be substituted for the first cut.

## Result

**First complete episode production: PASS. Full production acceptance: PENDING Karl and Astra review.** The delivered video is an end-to-end UI-produced episode, with the noted editorial limitations and technical warnings. No judgement of narrator naturalness or final suitability is asserted here.

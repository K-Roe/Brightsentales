# BrightTales — Meet Max & Maxine (V1 review cut)

**Status:** Complete 56-second Studio export for Karl's visual review. **Not approved or published.** No new animation milestone has started.

## Deliverables

- [Complete WebM cartoon](brighttales-meet-max-and-maxine.webm) — 16,503,467 bytes, SHA-256 `FB42C9A82791D4DA32ABE1935EA5B7269FB7568254A5D9C5A2A5E89F282B6D77`.
- [Editable Studio Backup v8](introduction-studio-backup-v8.json) — six timed scenes, one episode, approved Places; no intros, credits or audio assets. SHA-256 `EBFE4E07E7CE4C991314EBD71A4247A0FFD2F7FC2BCE64B2130DAEC0121B9A62`.
- [Asset approval checklist](ASSET_APPROVAL_CHECKLIST.md), [production script](produce.mjs), [browser results](production-checks.json), [Episode Maker screenshot](episode-maker.png), [Scene Maker screenshot](scene-maker-phone.png), [Scene Maker phone preview at 13 s](scene-preview-phone-13s.png), [Episode Maker phone preview at 35 s](preview-phone.png), and [decoded contact sheet](final-contact-sheet.png).

The project was built from the approved Places-only Studio Backup in a disposable Chrome profile, saved in Scene Maker, reloaded, reopened in Episode Maker and exported through the existing Studio UI. The final backup was downloaded from that same Studio profile after the save/reopen check. Importing it into another Studio profile replaces that profile's local data, so make a backup there first.

## Sequence

| Time | Scene | Approved content |
|---|---|---|
| 0–6 s | Welcome | Max and Maxine standing and waving in the Living Room |
| 6–14 s | Meet Max | Max waves, then walks across his approved bedroom |
| 14–22 s | Meet Maxine | Maxine waves, then walks across her approved bedroom |
| 22–41 s | Bright Speak | Max uses his visually accepted original-outfit left-hand phone frames. Three silent pop-ups say “Welcome to BrightTales!”, “Maxine is my sister.”, and “Bright Speak helps kids talk.” |
| 41–49 s | Together | Both stand and wave individually in the approved Garden; no face-to-face greeting or turn |
| 49–56 s | Goodbye | Both wave outside the approved front of Max's house |

The solo walk shots cut while the walk action is active, before the known side-walk to front-idle pose change. They do not present the rejected greeting transition. Every shown character uses the original approved outfit and existing full-body frames. No approved artwork or application source was edited for this production.

## Verification

- `npm test -- --run`: **205/205 passed** in 28 files. `npm run build`: **passed** (Vite reported its existing large-chunk advisory).
- Disposable browser: six scenes restored, the Bright Speak scene saved in Scene Maker, a reload kept all six scenes, Episode Maker reopened all six in the intended order, and the exported Studio Backup retained the scenes and episode. **0 captured console errors**.
- FFprobe: VP9 **1672 × 941**, Opus audio stream, **1,331** decoded video frames. Frame timestamps reach **56.121 s**; the complete file decodes with FFmpeg without a decode error. The silent Opus stream measured **−91.0 dB** mean and peak; no generated voice or music content was used.
- Export timing: one **0.75 s capture gap from 0.420 to 1.170 s**, before the first wave starts at 1.7 s. No later frame gap exceeded 0.2 s. The opening holds the neutral pose during the gap.
- I inspected decoded frames in every scene, both solo walks, all three message beats, the together scene and the closing frame. Feet remain on their floor anchors in the sampled standing and wave frames; the walking shots show the approved side sprites at consistent size, and no sampled frame shows floating, morphing or a disappearance.
- A second disposable-browser run restored the final Studio Backup and captured the Scene Maker preview at local **13.0 s** ([check record](scene-preview-check.json)); it reported zero browser errors. That image and the Episode Maker preview at global **35.0 s** have identical pixels. The decoded video frame at 35.0 s shows the same phone pose and third message. Mean absolute RGB differences from preview to video were **2.08, 1.12, 2.63** per channel, consistent with WebM compression. This is a sampled preview/export match, not a frame-by-frame identity claim.

## Limits for Karl

- The reusable title and credits makers are implemented but **await Karl's approval** (roadmap M6.5/M6.6); general timed captions are **not started** (M7.5). Therefore this cut has no separate title or closing text card. “Welcome to BrightTales!” appears through the approved Bright Speak pop-up, and the episode name remains editable metadata. The closing is a visual wave.
- No voice recording or music composition has documented content/listening approval for this specific cartoon. The video is deliberately silent; the Bright Speak pop-up is text only. A real device voice would need a separately approved audio asset.
- The phone pop-up supports three visible text lines. The final three messages were individually checked in the preview and exported frames; longer draft text was discarded after it clipped.
- Episode WebM export and Backup v8 are existing production tools used to supply the requested evidence. Their presence here does not change the roadmap's pending Karl review for the broader M6.7 assembly milestone.
- Karl must watch the full video and decide visual/creative acceptance. Technical checks and sampled frames do not make this an official approved or published cartoon.

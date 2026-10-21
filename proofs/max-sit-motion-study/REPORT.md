# Max sit/stand motion study — not accepted

21 October 2026. This isolated study follows Karl's approval of the **static** Max Seated V2 identity and seated pose. It has **not** met the motion requirements. Batch 3 remains **REJECTED**; Batch 4 remains **LOCKED**. Nothing here is connected to Scene Maker or replaces production sprites.

## Evidence

- [Rendered 2.54-second candidate cycle](max-sit-stand-candidate.mp4) — 1200 × 1100, 24 fps, 61 decoded frames. Standing → halfway → seated hold → halfway → standing. This is a diagnostic failure recording, not an approval candidate.
- [Decoded video contact sheet](video-contact.png) shows the full cycle, including the failed transitions.
- [Standing](01-standing.png), [halfway](02-halfway.png), and [seated](03-seated.png) are the registered key poses.

The approved `public/art/max-0.png` and accepted V2 `public/art/experimental/max-seated-v2/max-seated.png` were read only. The head, face, hair, hoodie and arms in the middle pose are copied approved pixels, translated 20 source pixels. The accepted V2 seated lower body is used at the seated endpoint. A separate [provisional halfway lower-body study](../../public/art/experimental/max-seated-v2/motion-halfway-source.png) was made for the middle pose. `scripts/build_max_sit_motion_study.py` assembles complete key poses with the existing experimental chair layers and encodes the recording through FFmpeg motion interpolation. The independent in-between artwork studies that produced tall legs or oversized shoes were rejected and are not included in the cycle.

## Visual result and blocker

The endpoints retain Max's recognizable identity, and the halfway still has connected knees, shins and shoes. The motion **fails**: interpolated frames show doubled/ghosted knees and shoes, particularly as the feet widen during descent and narrow on ascent. The standing and seated shoes occupy materially different horizontal positions, so feet slide instead of staying planted. The chair front is correctly in front of Max and the hands remain visible in the seated endpoint, but the approved straight-hanging arms do not convincingly reposition the hands onto the armrests during the motion. The chair/hand relationship therefore also remains unapproved.

The source artwork supplies only two accepted lower-body endpoints, and one provisional halfway pose is not enough to describe a believable planted-foot transition. Optical interpolation creates extra pixels rather than supplying the missing step, knee-bend and weight-shift drawings. Moving the torso or scaling the lower body would disguise that missing anatomy and would not meet Karl's standard. The next artwork step needs registered complete transition poses that explicitly show foot placement/weight transfer and arms/hands reaching the armrests, drawn against the same measurements as V2. Those poses must be visually checked before another full-cycle render.

## Checks

- `py -3.12 scripts/build_max_sit_motion_study.py`: rendered three key poses and the candidate video.
- `ffprobe`: 2.541667 seconds, 1200 × 1100, 24 fps, 61 frames.
- `npm test -- --run`: 197/197 passed.
- `npm run build`: passed (existing bundle size advisory).
- No Scene Maker playback, save/reopen or episode export test applies to this isolated, unwired study.
- No browser visual test was claimed. I inspected the generated key poses and decoded video contact sheet directly; the visual verdict is **FAIL**.

**Do not integrate or visually approve this motion study.** Karl's V2 static seated approval remains valid and limited to the still pose and identity.

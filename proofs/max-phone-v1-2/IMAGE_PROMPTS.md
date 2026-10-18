# Built-in imagegen pose prompts

The six selected transparent candidates in `generated-candidates/` were created with the built-in imagegen edit tool. The approved `public/art/max-0.png` was the reference for the hold pose. Subsequent poses used the selected hold or raise candidate as the edit target. `scripts/bake_max_phone_frames.py` restored the approved Max head pixels on every production frame.

| Candidate | Final edit instruction |
| --- | --- |
| `hold.png` | Keep approved Max's head, face, hair, torso, star, hoodie, shorts, shoes, proportions, colours, outlines, shading, transparent canvas and front stance. Bend only the viewer-right arm inward to hold a vertical smartphone at the lower chest with teal fingers crossing its near edge; leave the viewer-left arm relaxed. No extra limbs, floating object or text. |
| `enter.png` | Preserve the hold candidate's character and transparent canvas. Lower the gripped phone and viewer-right hand to waist height as an intermediate take-out pose; keep the viewer-left arm relaxed and the shoulder connected. |
| `tap-start.png` | Preserve the hold candidate's phone, holding arm, face, clothes and stance. Bend only the viewer-left arm partway up; place the hand at the lower hoodie with the index finger beginning to extend toward the phone. |
| `tap-mid.png` | Preserve the raise candidate's phone, grip, character and canvas. Lower only the viewer-left pointing arm halfway from its raised pose so the extended finger points from lower chest height, several centimeters from the screen. |
| `raise.png` | Preserve the hold candidate's face, clothes, stance, phone position and viewer-right grip. Raise only the viewer-left arm across the torso, with the extended index finger hovering just short of the screen. |
| `touch.png` | Preserve the raise candidate's composition and phone grip. Move only the viewer-left extended index finger so its tip visibly touches the screen; add a small white contact glint. |

All prompts requested transparent backgrounds, clean shoulder connections, matching cartoon linework and no character redesign. The tool produced identity drift outside the arms, so the baker restores Max's approved head exactly; the remaining newly illustrated torso and limbs are pending Karl's visual review.

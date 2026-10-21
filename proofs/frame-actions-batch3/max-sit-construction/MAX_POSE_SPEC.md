# Max sitting pose registration — source measurements and review targets

**Status: specification only; no sitting artwork approved.** Source of truth is `public/art/max-0.png`. This is for Max's original outfit and front orientation only.

| Landmark | Approved source pixels | Use |
| --- | --- | --- |
| Canvas | 434 × 724, transparent RGBA | Every new complete pose frame uses the same canvas; do not auto-fit each silhouette. |
| Nontransparent bounds | x 47–425, y 19–698 | Baseline comparison. Isolated edge pixels are included. |
| Approved head piece | x 63–374, y 41–382 | Keep exact head, hair and face pixels where the head remains front-facing. Its translation must follow the torso. |
| Shoulder pivots | viewer-left `(150,410)`, viewer-right `(300,410)` | Arm attachment reference, not a runtime rig. |
| Hand pivots | viewer-left `(98,521)`, viewer-right `(333,522)` | Track hands relative to chair arms in every baked frame. |
| Floor | lowest approved pixel y 698; stage foot anchor comes from `spriteGrounding.ts` | Both shoes need measured contact at the scene floor point through standing and seated idle. |
| Pelvis/seat target | **not present in source**; provisional geometric target near `(217,610–625)` | Must be established by actual new seat-contact art and a layered chair, then measured. Do not use this estimate as a renderer offset. |

Required ordered drawings for the first deliverable: approved standing, weight shift, shallow knee bend, deeper knee bend, pelvis approaching cushion, first seated contact, seated settle and held seated idle. Standing up can reverse these only if weight transfer and hand support read correctly in reverse; otherwise it needs its own frames. Register each frame by the same floor baseline, seat landmark and head/torso measurements. Compare a contact sheet before using the sequence in Scene Maker.

The source contains a separable head and arm pixels, but the shorts, hips, thighs, knees, shins and shoes form one painted silhouette. The source has no hidden pelvis or chair-contact artwork. A new seated lower body therefore must be drawn and checked against the approved upper body. Translating the existing torso over approximate legs does not create sitting; see [failed deterministic sheet](deterministic-contact.png).

# Living World V1.2 — physical-life feasibility

**Status: blocked on artwork; no production integration or approval.** Karl rejected the V1.1 visual result on 23 October 2026. Its autonomous walking planner was not changed. Approved Living World V1, Brightling Life V2, artwork and action timing remain intact.

## What the approved assets support

- Both standing characters are whole-body PNG frames. The existing independent eye overlays and character-seeded blink schedule can continue across compatible actions.
- Brightling Life V2 currently applies roughly 0.45% vertical and 0.15% horizontal breathing scale to the **entire** character, plus a small lift. This does not make the chest or shoulders visibly breathe.
- Max has experimental head, torso, sleeve, shoulder and hand cutouts. The cutouts are not production-wired. Their torso contains old arm fragments and lacks hidden armpit pixels. Its head leaves facial/hair pixels in the torso and has no neck underpaint. Prior AC-01 and phone-rig inspections documented gaps, torn hoodie details and seams when moved.
- Maxine has no equivalent separated head, torso or shoulder assets.

The current art therefore cannot support convincing independent breathing, posture shifts, head movement or shoulder/arm movement for **both** Brightlings without new reviewed layers. Repeatedly scaling or warping the whole figure would preserve the rigid look and violate the requirement.

## Visual diagnostic

[18-second side-by-side H.264 MP4](physical-life-feasibility.mp4): approved standing source pixels on the left; existing Max head-cutout movement on the right for the first nine seconds, then Maxine unchanged on both sides because no safe cutout exists. The crop brings the head and chest close enough to inspect. This is an **offline feasibility diagnostic**, not a successful physical-life animation or a Studio episode. It does not reproduce the Studio blink overlay. The source PNGs are read-only; [the repeatable script](render_feasibility.py) uses Pillow and FFmpeg only for this proof artifact, not the application.

## Smallest safe art addition

For **each** standing character, an artist should supply a registered neutral layer set using the approved sprite as the visual source: (1) complete head/hair/face including all outline pixels; (2) a complete torso and neckline painted behind the head and shoulders; (3) separate left/right shoulder and upper-arm silhouettes with the concealed hoodie/sleeve regions filled; and (4) a small chest/hoodie surface with enough hidden overlap for a restrained inhale/exhale. Preserve approved visible pixels, colours, facial features, clothing and proportions. Define neck, shoulder and chest pivots, overlap order and a narrow safe motion range. First require a pixel-matched neutral composite and close-up tests at both extremes and during blended motion. Maxine needs the same treatment; Max's existing incomplete cutouts alone are insufficient.

Only after Karl approves those **experimental** layers should a character-level breathing/posture controller be tried in the shared Canvas renderer. It should compose below approved action poses and above the existing independent eye channel, retain the V1/V2 comparison switches, use scene time and character ID for deterministic playback, and leave the director's action clock unchanged. No such controller or artwork is integrated here.

## Verification

- MP4: H.264, 1920 × 1080, 24 FPS, exactly 18.000 seconds; FFmpeg decoded the full clip without error. Frames at 1.25 and 12 seconds were inspected as [Max](max-trial.png) and [Maxine](maxine-trial.png) close-ups.
- Existing app suite: `npm test -- --run` passed **223/223**. `npm run build` passed with the existing Vite large-chunk advisory. `git diff --check` found no whitespace errors.
- No new app code, saved scene, Studio Backup or exported Studio episode was produced. The proof cannot validate save/reopen or preview/export parity for a physical-life feature that has not been integrated.

## Acceptance boundary

The requested 15–20-second successful breathing/posture comparison cannot be honestly delivered with current approved assets. This diagnostic is supplied so Karl can see the blocker. It is **not** evidence that Max and Maxine feel physically alive for 20 seconds. No Living World V2, planner tuning, artwork replacement or commit was made. Karl's visual decision remains required before proceeding.

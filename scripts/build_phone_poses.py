"""UNFINISHED PROTOTYPE — its output was rejected; see proofs/max-phone-v1-2/REPORT.md.

It removes an arm from Max's approved idle frame and redraws a replacement sleeve, forearm
and mitten hand in the same flat cartoon style, then bakes the phone into the holding hand.
Three iterations produced visible artefacts (sleeve slabs, mitten "bubbles", chewed torso
edges) rather than convincing art, because the approved art has no bent holding arm to match
and the arm is only ~96px long, so a drawn arm cannot reach a naturally-held phone.

What it does prove, and what to keep:
  * the hands are separate skin components, and the sleeve can be separated from the torso by
    finding the hoodie-mask row run that does not contain the midline (see analyse_sprites.py);
  * the geometry a replacement pose must satisfy.

Left in place only as the pipeline that will consume approved phone-pose frames, which need
to be full-body 434x724 RGBA PNGs matching max-0.png. Do not ship its output as artwork.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "public" / "art"
MASKS = ROOT / "public" / "recolour-masks" / "male"
OUT = ART / "phone"

SKIN = (72, 215, 195)
SKIN_LIGHT = (126, 236, 219)
SKIN_SHADE = (48, 168, 152)
SLEEVE = (114, 71, 206)
SLEEVE_LIGHT = (146, 104, 232)
SLEEVE_SHADE = (86, 52, 162)
CUFF = (96, 58, 180)
OUTLINE = (43, 29, 77)
PHONE_BODY = (60, 74, 122)
PHONE_EDGE = (38, 48, 90)
SCREEN = (214, 234, 246)
SCREEN_LIT = (143, 243, 255)

LINE = 6


def components(mask, min_size=400):
    height, width = mask.shape
    labels = np.zeros((height, width), dtype=np.int32)
    stack, found, current = [], [], 0
    for y in range(height):
        for x in range(width):
            if not mask[y, x] or labels[y, x]:
                continue
            current += 1
            stack.append((y, x))
            labels[y, x] = current
            pixels = []
            while stack:
                cy, cx = stack.pop()
                pixels.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = current
                        stack.append((ny, nx))
            if len(pixels) >= min_size:
                ys = [p[0] for p in pixels]
                xs = [p[1] for p in pixels]
                found.append({"bbox": (min(xs), min(ys), max(xs), max(ys)), "size": len(pixels), "pixels": pixels})
    return found


def hands_of(parts):
    candidates = [p for p in parts if p["bbox"][1] > 450 and p["bbox"][3] < 640]
    left = max((p for p in candidates if p["bbox"][0] > 250), key=lambda p: p["size"], default=None)
    right = max((p for p in candidates if p["bbox"][2] < 200), key=lambda p: p["size"], default=None)
    return left, right


def clear(image: ImageDraw.ImageDraw, pixels) -> None:
    for y, x in pixels:
        image.point((x, y), fill=(0, 0, 0, 0))


def clear_sleeves(image: ImageDraw.ImageDraw, hoodie: np.ndarray, left: bool) -> None:
    """Erase one sleeve by row, keeping the run that belongs to the torso."""
    height, width = hoodie.shape
    midline = width // 2
    for y in range(height):
        row = np.nonzero(hoodie[y])[0]
        if len(row) == 0:
            continue
        runs, start, previous = [], row[0], row[0]
        for x in row[1:]:
            if x != previous + 1:
                runs.append((start, previous))
                start = x
            previous = x
        runs.append((start, previous))
        torso = next((run for run in runs if run[0] <= midline <= run[1]), None)
        for x0, x1 in runs:
            if torso is not None and (x0, x1) == torso:
                continue
            if left and x0 >= midline:
                continue
            if not left and x1 <= midline:
                continue
            image.rectangle([x0, y, x1, y], fill=(0, 0, 0, 0))


def tapered(draw, start, end, start_width, end_width, fill, shade=None):
    """A limb that narrows towards the wrist, drawn outline-first like the original art."""
    (x0, y0), (x1, y1) = start, end
    dx, dy = x1 - x0, y1 - y0
    length = max(1e-6, (dx * dx + dy * dy) ** 0.5)
    nx, ny = -dy / length, dx / length
    polygon = [
        (x0 + nx * start_width / 2, y0 + ny * start_width / 2),
        (x1 + nx * end_width / 2, y1 + ny * end_width / 2),
        (x1 - nx * end_width / 2, y1 - ny * end_width / 2),
        (x0 - nx * start_width / 2, y0 - ny * start_width / 2),
    ]
    grown = []
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    for x, y in polygon:
        grown.append((x + (x - cx) * (start_width / 60), y + (y - cy) * (start_width / 60)))
    draw.polygon(grown, fill=OUTLINE)
    draw.polygon(polygon, fill=fill)
    for point, radius in ((start, start_width / 2), (end, end_width / 2)):
        draw.ellipse([point[0] - radius - LINE, point[1] - radius - LINE, point[0] + radius + LINE, point[1] + radius + LINE], fill=OUTLINE)
        draw.ellipse([point[0] - radius, point[1] - radius, point[0] + radius, point[1] + radius], fill=fill)
    if shade:
        draw.polygon([(x0 - nx * start_width * 0.18, y0 - ny * start_width * 0.18), (x1 - nx * end_width * 0.18, y1 - ny * end_width * 0.18), (x1 - nx * end_width * 0.48, y1 - ny * end_width * 0.48), (x0 - nx * start_width * 0.48, y0 - ny * start_width * 0.48)], fill=shade)


def sleeve(draw, shoulder, elbow, cuff_point):
    tapered(draw, shoulder, elbow, 52, 40, SLEEVE, shade=SLEEVE_SHADE)
    draw.ellipse([shoulder[0] - 26, shoulder[1] - 26, shoulder[0] + 26, shoulder[1] + 26], fill=OUTLINE)
    draw.ellipse([shoulder[0] - 20, shoulder[1] - 20, shoulder[0] + 20, shoulder[1] + 20], fill=SLEEVE)
    # Rolled cuff, as on Max's existing sleeves.
    dx, dy = cuff_point[0] - elbow[0], cuff_point[1] - elbow[1]
    length = max(1e-6, (dx * dx + dy * dy) ** 0.5)
    nx, ny = -dy / length, dx / length
    half = 22
    band = [
        (elbow[0] + nx * half, elbow[1] + ny * half),
        (cuff_point[0] + nx * half, cuff_point[1] + ny * half),
        (cuff_point[0] - nx * half, cuff_point[1] - ny * half),
        (elbow[0] - nx * half, elbow[1] - ny * half),
    ]
    draw.polygon(band, fill=OUTLINE)
    draw.polygon([(x + (x - elbow[0]) * 0.06, y + (y - elbow[1]) * 0.06) for x, y in band], fill=CUFF)
    draw.polygon([(elbow[0] + nx * half * 0.5, elbow[1] + ny * half * 0.5), (cuff_point[0] + nx * half * 0.5, cuff_point[1] + ny * half * 0.5), (cuff_point[0] - nx * half * 0.5, cuff_point[1] - ny * half * 0.5), (elbow[0] - nx * half * 0.5, elbow[1] - ny * half * 0.5)], fill=SLEEVE_LIGHT)


def mitten(draw, centre, size, flip=False, light=True):
    """Max's hands are rounded mittens with two finger bumps and a thumb."""
    x, y = centre
    r = size
    draw.ellipse([x - r - LINE, y - r * 0.95 - LINE, x + r + LINE, y + r * 0.95 + LINE], fill=OUTLINE)
    draw.ellipse([x - r, y - r * 0.95, x + r, y + r * 0.95], fill=SKIN)
    for offset in (-0.45, 0.1):
        cx = x + (offset if not flip else -offset) * r
        draw.ellipse([cx - r * 0.42 - LINE, y + r * 0.12 - LINE, cx + r * 0.42 + LINE, y + r * 0.92 + LINE], fill=OUTLINE)
        draw.ellipse([cx - r * 0.42, y + r * 0.12, cx + r * 0.42, y + r * 0.92], fill=SKIN)
    tx = x + (-1.05 if flip else 1.05) * r
    draw.ellipse([tx - r * 0.3 - LINE, y - r * 0.34 - LINE, tx + r * 0.3 + LINE, y + r * 0.34 + LINE], fill=OUTLINE)
    draw.ellipse([tx - r * 0.3, y - r * 0.34, tx + r * 0.3, y + r * 0.34], fill=SKIN)
    if light:
        draw.ellipse([x - r * 0.62, y - r * 0.74, x + r * 0.1, y - r * 0.16], fill=SKIN_LIGHT)


def phone(draw, centre, height, angle, lit):
    width = height * 0.54
    layer = Image.new("RGBA", (int(height * 1.7), int(height * 1.7)), (0, 0, 0, 0))
    inner = ImageDraw.Draw(layer)
    cx = cy = layer.width / 2
    half_w, half_h, radius = width / 2, height / 2, width * 0.2
    inner.rounded_rectangle([cx - half_w, cy - half_h, cx + half_w, cy + half_h], radius=radius, fill=PHONE_EDGE, outline=OUTLINE, width=LINE)
    inner.rounded_rectangle([cx - half_w + 7, cy - half_h + 7, cx + half_w - 7, cy + half_h - 7], radius=radius * 0.8, fill=PHONE_BODY)
    inner.rounded_rectangle([cx - half_w + 13, cy - half_h + 18, cx + half_w - 13, cy + half_h - 30], radius=7, fill=SCREEN_LIT if lit else SCREEN)
    if lit:
        inner.rounded_rectangle([cx - half_w + 22, cy - half_h + 32, cx + half_w - 40, cy - half_h + 44], radius=5, fill=(255, 255, 255))
        inner.rounded_rectangle([cx - half_w + 22, cy - half_h + 52, cx - 2, cy - half_h + 64], radius=5, fill=(255, 255, 255))
    inner.ellipse([cx - 8, cy + half_h - 26, cx + 8, cy + half_h - 10], fill=(232, 238, 252))
    rotated = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
    draw._image.alpha_composite(rotated, (int(centre[0] - rotated.width / 2), int(centre[1] - rotated.height / 2)))


def pointing_finger(draw, start, tip):
    dx, dy = tip[0] - start[0], tip[1] - start[1]
    length = max(1e-6, (dx * dx + dy * dy) ** 0.5)
    nx, ny = -dy / length, dx / length
    half = 13
    polygon = [
        (start[0] + nx * half, start[1] + ny * half),
        (tip[0] + nx * half * 0.82, tip[1] + ny * half * 0.82),
        (tip[0] - nx * half * 0.82, tip[1] - ny * half * 0.82),
        (start[0] - nx * half, start[1] - ny * half),
    ]
    draw.polygon([(x + (x - start[0]) * 0.18, y + (y - start[1]) * 0.18) for x, y in polygon], fill=OUTLINE)
    draw.polygon(polygon, fill=SKIN)
    draw.ellipse([tip[0] - half * 0.82 - LINE, tip[1] - half * 0.82 - LINE, tip[0] + half * 0.82 + LINE, tip[1] + half * 0.82 + LINE], fill=OUTLINE)
    draw.ellipse([tip[0] - half * 0.82, tip[1] - half * 0.82, tip[0] + half * 0.82, tip[1] + half * 0.82], fill=SKIN)


# The phone sits in front of the chest so the tapping arm can actually reach it.
PHONE = (252.0, 474.0)
PHONE_H = 126.0
PHONE_TILT = 7.0
LEFT_SHOULDER = (300.0, 424.0)
LEFT_ELBOW = (296.0, 470.0)
LEFT_CUFF = (272.0, 486.0)
RIGHT_SHOULDER = (132.0, 424.0)
RIGHT_ELBOW = (150.0, 486.0)
RIGHT_CUFF = (188.0, 500.0)


def holding_arm(draw, lit):
    sleeve(draw, LEFT_SHOULDER, LEFT_ELBOW, LEFT_CUFF)
    tapered(draw, LEFT_CUFF, (PHONE[0] - 22, PHONE[1] + 16), 34, 28, SKIN, shade=SKIN_SHADE)
    phone(draw, PHONE, PHONE_H, PHONE_TILT, lit=lit)
    # The holding hand is drawn last so it sits in front of the device.
    mitten(draw, (PHONE[0] - 34, PHONE[1] + 8), 24, flip=False)


def tapping_arm(draw, lit, touch):
    sleeve(draw, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_CUFF)
    tapered(draw, RIGHT_CUFF, (PHONE[0] + 30, PHONE[1] + 12), 34, 26, SKIN, shade=SKIN_SHADE)
    mitten(draw, (PHONE[0] + 40, PHONE[1] + 10), 22, flip=True)
    pointing_finger(draw, (PHONE[0] + 26, PHONE[1] + 12), (PHONE[0] + (2 if touch else -8), PHONE[1] - (4 if touch else -2)))


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    frame = Image.open(ART / "max-0.png").convert("RGBA")
    body = np.array(Image.open(MASKS / "max-0-body.png").convert("L")) > 32
    hoodie = np.array(Image.open(MASKS / "max-0-hoodie.png").convert("L")) > 32
    left_hand, right_hand = hands_of(components(body))
    if not left_hand or not right_hand:
        raise SystemExit("Could not locate both hands in the idle frame.")

    hold = frame.copy()
    draw = ImageDraw.Draw(hold)
    clear(draw, left_hand["pixels"])
    clear_sleeves(draw, hoodie, left=True)
    holding_arm(draw, lit=False)
    hold.save(OUT / "max-phone-hold.png")

    for name, touch in (("max-phone-raise.png", False), ("max-phone-touch.png", True)):
        pose = frame.copy()
        draw = ImageDraw.Draw(pose)
        clear(draw, right_hand["pixels"])
        clear_sleeves(draw, hoodie, left=False)
        holding_arm(draw, lit=touch)
        tapping_arm(draw, lit=touch, touch=touch)
        pose.save(OUT / name)

    print("wrote", *(str(p.relative_to(ROOT)) for p in sorted(OUT.glob("*.png"))), sep="\n  ")


if __name__ == "__main__":
    build()
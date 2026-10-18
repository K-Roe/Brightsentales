"""Bake the approved Max into a reusable cut-out rig.

Every part is taken from Karl's approved idle frame `public/art/max-0.png`; that file is
never modified. Output goes to `public/art/rig/max/` together with a `rig.json` that the
browser reads.

How the parts are cut:
  * head and hands come from the recolour body mask's connected components, which are exact
    and disjoint (measured: head 39,573px; hands 2,144px / 2,074px). This is component
    labelling, not the failed mask-row approach.
  * sleeves, shoulder caps and the torso are cut with explicitly authored anatomical polygons
    below, chosen by eye against a coordinate grid. Mask rows break around the star, cuffs and
    highlights, so they are used only as a guide, never as the cut itself.

Run with:  py -3.12 scripts/build_max_rig.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "art" / "max-0.png"
MASKS = ROOT / "public" / "recolour-masks" / "male" / "max-0-body.png"
OUT = ROOT / "public" / "art" / "rig" / "max"

# --- Authored cut paths, in source-frame pixels -------------------------------------
# Character's right arm is on the viewer's left (x < 217); character's left is viewer's right.

RIGHT_SLEEVE = [
    (150, 374), (120, 378), (101, 396), (89, 428), (82, 466), (81, 500),
    (86, 524), (92, 540), (96, 556), (116, 562), (131, 552), (134, 528),
    (133, 486), (136, 444), (142, 406),
]

LEFT_SLEEVE = [
    (322, 358), (334, 394), (344, 438), (352, 476), (356, 508), (350, 534),
    (338, 552), (318, 556), (304, 546), (300, 520), (300, 480), (300, 440),
    (301, 404), (310, 374),
]

RIGHT_SHOULDER_CAP = [(150, 374), (120, 378), (104, 388), (100, 404), (110, 416), (134, 418), (148, 404)]
LEFT_SHOULDER_CAP = [(310, 360), (322, 358), (334, 372), (338, 392), (330, 404), (308, 400), (300, 378)]

PIVOTS = {"arm-left": (300, 410), "arm-right": (150, 410), "head": (218, 382)}
HAND_PIVOTS = {"hand-left": (333, 522), "hand-right": (98, 521)}


def coverage(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("L"), dtype=np.uint8) > 32


def components(mask: np.ndarray, min_size: int):
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
                found.append({"pixels": pixels, "bbox": (min(xs), min(ys), max(xs), max(ys))})
    return found


def polygon_mask(size, polygon, grow: int = 0) -> np.ndarray:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    if grow:
        cx = sum(p[0] for p in polygon) / len(polygon)
        cy = sum(p[1] for p in polygon) / len(polygon)
        polygon = [(x + (x - cx) * grow / 60, y + (y - cy) * grow / 60) for x, y in polygon]
    draw.polygon(polygon, fill=255)
    return np.array(mask) > 0


def save_part(source: np.ndarray, region: np.ndarray, name: str) -> dict:
    piece = np.zeros_like(source)
    piece[region] = source[region]
    image = Image.fromarray(piece, "RGBA")
    image.save(OUT / f"{name}.png")
    ys, xs = np.nonzero(region)
    return {"file": f"{name}.png", "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())], "pixels": int(region.sum())}


def torso_fill(source: np.ndarray, footprint: np.ndarray, name: str) -> dict:
    """Complete the hidden shoulder/armpit/hoodie area the arm used to cover.

    The fill occupies only pixels that were the arm's own pixels, i.e. areas that become
    empty once the arm is cut away. At rest the arm covers it exactly, so the approved frame
    is still reconstructed pixel for pixel; when the arm lifts, his side is there instead of
    a hole.

    Colour comes from the torso itself at the same height, so the hoodie, its hem and the
    shorts continue seamlessly across the new pixels. The body's outer contour is drawn in
    the same dark outline, inside the fill, so nothing is added beyond the existing
    silhouette.
    """
    alpha = source[:, :, 3] > 8
    region = footprint & alpha
    if not region.any():
        raise SystemExit(f"Torso fill for {name} would be empty.")

    height, width = region.shape
    # Outer contour: fill pixels touching transparent background just outside the body.
    grown_background = np.array(
        Image.fromarray(((~alpha) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
    ) > 127
    edge = region & grown_background

    fill = np.zeros_like(source)
    for y in range(height):
        row = region[y]
        if not row.any():
            continue
        sample = None
        for x in range(200, width):
            if alpha[y, x]:
                sample = source[y, x]
                break
        if sample is None:
            sample = source[y, 200]
        fill[y, row] = sample
    fill[edge] = (43, 29, 77, 255)

    Image.fromarray(fill, "RGBA").save(OUT / f"{name}.png")
    ys, xs = np.nonzero(region)
    return {"file": f"{name}.png", "pixels": int(region.sum()),
            "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    source = np.array(Image.open(SOURCE).convert("RGBA"))
    size = (source.shape[1], source.shape[0])
    body = coverage(MASKS)

    parts = components(body, 1500)
    head = max(parts, key=lambda p: (p["bbox"][3] - p["bbox"][1]))
    hands = sorted((p for p in parts if p["bbox"][1] > 440), key=lambda p: p["bbox"][0])
    hand_right, hand_left = hands[0], hands[-1]

    right_sleeve = polygon_mask(size, RIGHT_SLEEVE)
    left_sleeve = polygon_mask(size, LEFT_SLEEVE)
    right_cap = polygon_mask(size, RIGHT_SHOULDER_CAP)
    left_cap = polygon_mask(size, LEFT_SHOULDER_CAP)

    hand_right_mask = np.zeros(body.shape, dtype=bool)
    for y, x in hand_right["pixels"]:
        hand_right_mask[y, x] = True
    hand_left_mask = np.zeros(body.shape, dtype=bool)
    for y, x in hand_left["pixels"]:
        hand_left_mask[y, x] = True
    head_mask = np.zeros(body.shape, dtype=bool)
    for y, x in head["pixels"]:
        head_mask[y, x] = True

    # Hair travels with the head so a tilt keeps the silhouette intact.
    hair = np.array(Image.open(ROOT / "public" / "recolour-masks" / "male" / "max-0-hair.png").convert("L")) > 32
    head_mask = head_mask | hair

    arms = right_sleeve | hand_right_mask | left_sleeve | hand_left_mask
    caps = right_cap | left_cap

    # The fill completes exactly the arm's own footprint, so the torso part must keep those
    # pixels out of the arms but inside the torso.
    registry = {}
    registry["torso"] = save_part(source, ~(arms | head_mask | caps), "torso")
    registry["torso-fill"] = torso_fill(source, right_sleeve | hand_right_mask, "torso-fill-right")
    registry["torso-fill-left"] = torso_fill(source, left_sleeve | hand_left_mask, "torso-fill-left")
    registry["arm-right"] = save_part(source, right_sleeve, "sleeve-right")
    registry["arm-left"] = save_part(source, left_sleeve, "sleeve-left")
    registry["hand-right"] = save_part(source, hand_right_mask, "hand-right")
    registry["hand-left"] = save_part(source, hand_left_mask, "hand-left")
    registry["shoulder-right"] = save_part(source, right_cap, "shoulder-right")
    registry["shoulder-left"] = save_part(source, left_cap, "shoulder-left")
    registry["head"] = save_part(source, head_mask, "head")

    rig = {
        "version": 1,
        "character": "max",
        "source": "/art/max-0.png",
        "width": size[0],
        "height": size[1],
        "pivots": {
            "arm-right": {"x": PIVOTS["arm-right"][0], "y": PIVOTS["arm-right"][1]},
            "arm-left": {"x": PIVOTS["arm-left"][0], "y": PIVOTS["arm-left"][1]},
            "hand-right": {"x": HAND_PIVOTS["hand-right"][0], "y": HAND_PIVOTS["hand-right"][1]},
            "hand-left": {"x": HAND_PIVOTS["hand-left"][0], "y": HAND_PIVOTS["hand-left"][1]},
            "head": {"x": PIVOTS["head"][0], "y": PIVOTS["head"][1]},
        },
        "parts": registry,
        "drawOrder": ["torso", "torso-fill", "torso-fill-left", "arm-right", "arm-left", "hand-right", "hand-left", "head", "shoulder-right", "shoulder-left"],
    }
    (OUT / "rig.json").write_text(json.dumps(rig, indent=2), encoding="utf-8")
    print(json.dumps({k: v["pixels"] for k, v in registry.items()}, indent=2))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
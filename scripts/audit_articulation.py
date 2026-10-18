"""Feasibility audit: can Karl's approved Max frames be cut into an articulated puppet?

Read-only analysis of the approved artwork and its recolour masks. Nothing here writes to
public/art; it only measures whether head, arms and hands can be separated cleanly, where the
pivots are, and whether a rotated arm can reach a phone held in front of the chest.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "public" / "art"
MASKS = ROOT / "public" / "recolour-masks" / "male"


def coverage(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("L"), dtype=np.uint8) > 32


def components(mask: np.ndarray, min_size: int = 200):
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
                found.append({"size": len(pixels), "bbox": (min(xs), min(ys), max(xs), max(ys)),
                              "centre": (sum(xs) / len(xs), sum(ys) / len(ys)), "pixels": pixels})
    return found


def runs_per_row(mask: np.ndarray, y: int):
    row = np.nonzero(mask[y])[0]
    if len(row) == 0:
        return []
    out, start, previous = [], row[0], row[0]
    for x in row[1:]:
        if x != previous + 1:
            out.append((start, previous))
            start = x
        previous = x
    out.append((start, previous))
    return out


def arm_is_separate(hoodie: np.ndarray, y: int, side: str) -> bool:
    """Is the sleeve its own run at this row, i.e. cuttable from the torso?"""
    runs = runs_per_row(hoodie, y)
    midline = hoodie.shape[1] // 2
    torso = next((r for r in runs if r[0] <= midline <= r[1]), None)
    if torso is None:
        return False
    others = [r for r in runs if r != torso]
    if side == "left":
        return any(r[1] < midline for r in others)
    return any(r[0] > midline for r in others)


def main() -> None:
    report: dict = {}
    for frame in ("max-0", "max-wave-1"):
        art = Image.open(ART / f"{frame}.png").convert("RGBA")
        body = coverage(MASKS / f"{frame}-body.png")
        hoodie = coverage(MASKS / f"{frame}-hoodie.png")
        hair = coverage(MASKS / f"{frame}-hair.png")
        parts = sorted(components(body), key=lambda p: -p["size"])
        entry = {
            "size": [art.width, art.height],
            "head_component": {"size": parts[0]["size"], "bbox": parts[0]["bbox"], "centre": [round(v) for v in parts[0]["centre"]]},
            "other_components": [{"size": p["size"], "bbox": p["bbox"], "centre": [round(v) for v in p["centre"]]} for p in parts[1:5]],
            "hair_bbox": None,
            "arm_separable_below_y": {},
        }
        ys, xs = np.nonzero(hair)
        entry["hair_bbox"] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
        for side in ("left", "right"):
            first = next((y for y in range(300, 560) if arm_is_separate(hoodie, y, side)), None)
            entry["arm_separable_below_y"][side] = first
        report[frame] = entry

    # Reach geometry for a cut-out arm pivoting about the shoulder.
    idle = report["max-0"]
    head_bbox = idle["head_component"]["bbox"]
    hands = [c for c in idle["other_components"] if c["bbox"][1] > 450]
    right_hand = min(hands, key=lambda c: c["bbox"][0]) if hands else None
    left_hand = max(hands, key=lambda c: c["bbox"][0]) if hands else None
    geometry = {}
    if right_hand and left_hand:
        right_shoulder = (150.0, 424.0)
        left_shoulder = (300.0, 424.0)
        phone = (215.0, 455.0)
        geometry = {
            "right_shoulder": right_shoulder,
            "left_shoulder": left_shoulder,
            "phone_in_front_of_chest": phone,
            "right_arm_length": round(math.dist(right_shoulder, right_hand["centre"]), 1),
            "left_arm_length": round(math.dist(left_shoulder, left_hand["centre"]), 1),
            "right_shoulder_to_phone": round(math.dist(right_shoulder, phone), 1),
            "left_shoulder_to_phone": round(math.dist(left_shoulder, phone), 1),
        }
        geometry["right_can_reach_phone"] = geometry["right_shoulder_to_phone"] <= geometry["right_arm_length"]
        geometry["left_can_reach_phone"] = geometry["left_shoulder_to_phone"] <= geometry["left_arm_length"]
    report["geometry"] = geometry
    report["head_pivot_candidate"] = {"x": head_bbox[0] // 2 + head_bbox[2] // 2, "y": head_bbox[3]}

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
"""AUDIT PROBE - its output is deliberately kept as FAILED evidence, not as artwork.

Karl asked whether the approved Max can be articulated by cutting his own pixels. The
measurements in scripts/audit_articulation.py answer that (parts are separable; both arms
reach a chest-held phone by rotation). This probe tested the obvious *implementation* -
splitting the hoodie mask into row runs to find the sleeve - and it FAILED: it over-erased
the chest, left the hands behind and produced floating fragments, because mask runs are not
anatomy. See proofs/max-phone-v1-3/FEASIBILITY.md, finding 3.

Conclusion: a production cut must use explicitly authored cut paths, not automatic mask
run-splitting. Nothing here is wired into the app and public/art is untouched.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "public" / "art"
MASKS = ROOT / "public" / "recolour-masks" / "male"
OUT = ROOT / "proofs" / "max-phone-v1-3"

CUT_Y = 395          # below this row the sleeve is its own run, so it can be cut cleanly
RIGHT_PIVOT = (150.0, 412.0)
LEFT_PIVOT = (300.0, 412.0)


def coverage(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("L"), dtype=np.uint8) > 32


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


def sleeve_mask(hoodie: np.ndarray, side: str) -> np.ndarray:
    """Sleeve pixels only: rows at or below the cut, and the run that is not the torso."""
    height, width = hoodie.shape
    midline = width // 2
    mask = np.zeros_like(hoodie)
    for y in range(CUT_Y, height):
        runs = runs_per_row(hoodie, y)
        torso = next((r for r in runs if r[0] <= midline <= r[1]), None)
        for x0, x1 in runs:
            if torso is not None and (x0, x1) == torso:
                continue
            if side == "left" and x0 >= midline:
                continue
            if side == "right" and x1 <= midline:
                continue
            mask[y, x0:x1 + 1] = True
    return mask


def hand_mask(body: np.ndarray, side: str) -> np.ndarray:
    """The hand is a small skin component below the torso; pick the one on this side."""
    height, width = body.shape
    labels = np.zeros((height, width), dtype=np.int32)
    stack, found, current = [], [], 0
    for y in range(440, height):
        for x in range(width):
            if not body[y, x] or labels[y, x]:
                continue
            current += 1
            stack.append((y, x))
            labels[y, x] = current
            pixels = []
            while stack:
                cy, cx = stack.pop()
                pixels.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < height and 0 <= nx < width and body[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = current
                        stack.append((ny, nx))
            if len(pixels) > 1500:
                xs = [p[1] for p in pixels]
                found.append((side == "left" and min(xs) > width // 2) or (side == "right" and max(xs) < width // 2))
                if found[-1]:
                    for py, px in pixels:
                        labels[py, px] = -1
    return labels == -1


def cut_arm(source: np.ndarray, sleeve: np.ndarray, hand: np.ndarray):
    region = sleeve | hand
    piece = np.zeros_like(source)
    piece[region] = source[region]
    base = source.copy()
    base[region] = 0
    return Image.fromarray(base, "RGBA"), Image.fromarray(piece, "RGBA")


def rotate_about(image: Image.Image, pivot, angle_degrees: float) -> Image.Image:
    return image.rotate(angle_degrees, resample=Image.BICUBIC, center=pivot, expand=False)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    source = np.array(Image.open(ART / "max-0.png").convert("RGBA"))
    body = coverage(MASKS / "max-0-body.png")
    hoodie = coverage(MASKS / "max-0-hoodie.png")

    base, right_piece = cut_arm(source, sleeve_mask(hoodie, "right"), hand_mask(body, "right"))
    base, left_piece = cut_arm(np.array(base), sleeve_mask(hoodie, "left"), hand_mask(body, "left"))

    canvas = base.copy()
    # Holding arm swings inward; tapping arm reaches across to the device.
    right_rotated = rotate_about(right_piece, RIGHT_PIVOT, 152)
    left_rotated = rotate_about(left_piece, LEFT_PIVOT, -46)

    phone = Image.open(ART / "phone-placeholder.png").convert("RGBA") if (ART / "phone-placeholder.png").exists() else None
    stage = canvas.copy()
    stage.alpha_composite(phone if phone else Image.new("RGBA", (1, 1)), (0, 0)) if phone else None
    stage.alpha_composite(left_rotated)
    stage.alpha_composite(right_rotated)
    stage.save(OUT / "feasibility-probe-arms-rotated.png")

    # Also save the raw cut pieces so the cut quality can be judged directly.
    right_piece.save(OUT / "feasibility-piece-right-arm.png")
    left_piece.save(OUT / "feasibility-piece-left-arm.png")
    base.save(OUT / "feasibility-base-without-arms.png")
    print("wrote probe images to", OUT)


if __name__ == "__main__":
    main()
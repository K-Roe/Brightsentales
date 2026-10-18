"""Preview the baked rig: reconstruct the rest pose and render a few posed variants.

The acceptance test for the cut paths is simple and strict: with every pose angle at zero,
the rig must reconstruct `max-0.png` pixel for pixel. If it does not, a cut path is wrong.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RIG = ROOT / "public" / "art" / "rig" / "max"
SOURCE = ROOT / "public" / "art" / "max-0.png"
OUT = ROOT / "proofs" / "max-phone-v1-3"


def load():
    rig = json.loads((RIG / "rig.json").read_text(encoding="utf-8"))
    parts = {name: Image.open(RIG / info["file"]).convert("RGBA") for name, info in rig["parts"].items()}
    return rig, parts


def rotated(part: Image.Image, pivot, degrees: float) -> Image.Image:
    """Rotate about a pivot. Positive degrees turn the limb clockwise on screen."""
    if abs(degrees) < 0.001:
        return part
    return part.rotate(-degrees, resample=Image.BICUBIC, center=pivot, expand=False)


def point_on(centre, pivot, degrees: float):
    """Where a point at rest ends up after the same rotation the limb gets."""
    dx, dy = centre[0] - pivot[0], centre[1] - pivot[1]
    radians = math.radians(degrees)
    cos, sin = math.cos(radians), math.sin(radians)
    return (pivot[0] + dx * cos - dy * sin, pivot[1] + dx * sin + dy * cos)


def angle_to(pivot, target, current) -> float:
    """Degrees to rotate a limb from its rest direction so its tip reaches `target`."""
    def bearing(point):
        return math.degrees(math.atan2(point[1] - pivot[1], point[0] - pivot[0]))
    return bearing(target) - bearing(current)


def compose(rig, parts, pose: dict, arms_in_front: bool = False) -> Image.Image:
    canvas = Image.new("RGBA", (rig["width"], rig["height"]), (0, 0, 0, 0))
    pivots = rig["pivots"]
    angles = {name: pose.get(name, 0.0) for name in ("arm-right", "arm-left", "hand-right", "hand-left", "head")}

    def limb(name):
        """Sleeve + hand for one side, sharing the arm's pivot and angle."""
        side = "right" if name.endswith("right") else "left"
        pivot = (pivots[f"arm-{side}"]["x"], pivots[f"arm-{side}"]["y"])
        piece = Image.new("RGBA", (rig["width"], rig["height"]), (0, 0, 0, 0))
        piece.alpha_composite(rotated(parts[f"arm-{side}"], pivot, angles[f"arm-{side}"]))
        piece.alpha_composite(rotated(parts[name], pivot, angles[f"arm-{side}"] + angles[name]))
        return piece

    behind = [limb("arm-right"), limb("arm-left")]
    in_front = [limb("hand-right"), limb("hand-left")]
    if arms_in_front:
        behind, in_front = in_front, behind

    for piece in behind:
        canvas.alpha_composite(piece)
    canvas.alpha_composite(parts["torso"])
    for name in ("shoulder-right", "shoulder-left"):
        arm = name.replace("shoulder", "arm")
        pivot = (pivots[arm]["x"], pivots[arm]["y"])
        canvas.alpha_composite(rotated(parts[name], pivot, angles[arm]))
    for piece in in_front:
        canvas.alpha_composite(piece)
    head_pivot = (pivots["head"]["x"], pivots["head"]["y"])
    canvas.alpha_composite(rotated(parts["head"], head_pivot, angles["head"]))
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rig, parts = load()
    original = Image.open(SOURCE).convert("RGBA")

    rest = compose(rig, parts, {})
    rest.save(OUT / "rig-rest-pose.png")

    # Strict check: does the rest pose rebuild the approved frame exactly?
    import numpy as np
    a = np.array(rest).astype(int)
    b = np.array(original).astype(int)
    differing = np.abs(a - b).sum(axis=2) > 0
    total = differing.size
    print(f"rest pose vs original: {differing.sum()} differing subpixels ({100.0 * differing.sum() / total:.4f}%)")
    ys, xs = np.nonzero(differing)
    if len(xs):
        print("difference bbox:", (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
        Image.fromarray((differing * 255).astype(np.uint8)).save(OUT / "rig-rest-diff.png")

    # Pose angles are solved from the geometry rather than guessed: each arm is rotated so
    # its hand lands on the same device position in front of the chest.
    pivots = rig["pivots"]
    right_pivot = (pivots["arm-right"]["x"], pivots["arm-right"]["y"])
    left_pivot = (pivots["arm-left"]["x"], pivots["arm-left"]["y"])
    right_rest = (pivots["hand-right"]["x"], pivots["hand-right"]["y"])
    left_rest = (pivots["hand-left"]["x"], pivots["hand-left"]["y"])
    device = (238.0, 452.0)
    hold_left = angle_to(left_pivot, (device[0] - 16, device[1] + 14), left_rest)
    tap_right = angle_to(right_pivot, (device[0] - 18, device[1] + 10), right_rest)
    print(f"solved angles: hold arm-left {hold_left:.1f} deg, tap arm-right {tap_right:.1f} deg")
    for label, rest in (("holding hand", left_rest), ("tapping hand", right_rest)):
        pass
    print("  holding hand ends at", [round(v, 1) for v in point_on(left_rest, left_pivot, hold_left)])
    print("  tapping hand ends at", [round(v, 1) for v in point_on(right_rest, right_pivot, tap_right)])

    poses = {
        "hold": {"arm-left": hold_left, "head": 3.0},
        "tap-raise": {"arm-left": hold_left, "arm-right": tap_right * 0.82, "head": 4.0},
        "tap-touch": {"arm-left": hold_left, "arm-right": tap_right, "head": 5.0},
        "wave": {"arm-right": tap_right * 0.6},
    }
    sheet = Image.new("RGBA", (434 * (len(poses) + 1), 724), (245, 245, 250, 255))
    sheet.alpha_composite(original, (0, 0))
    index = 1
    for name, pose in poses.items():
        image = compose(rig, parts, pose, arms_in_front=True)
        image.save(OUT / f"rig-pose-{name}.png")
        sheet.alpha_composite(image, (434 * index, 0))
        index += 1
    sheet.convert("RGB").save(OUT / "rig-poses-sheet.png")

    behind = Image.new("RGBA", (434 * 3, 724), (245, 245, 250, 255))
    behind.alpha_composite(original, (0, 0))
    behind.alpha_composite(compose(rig, parts, poses["tap-touch"], arms_in_front=False), (434, 0))
    behind.alpha_composite(compose(rig, parts, poses["hold"], arms_in_front=False), (868, 0))
    behind.convert("RGB").save(OUT / "rig-arms-behind-torso.png")
    print("wrote preview images to", OUT)


if __name__ == "__main__":
    main()
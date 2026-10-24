"""Read-only pixel audit of Max's existing cut-outs; never changes source art."""
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "public" / "art"
RIG = ART / "rig" / "max"
SOURCE = Image.open(ART / "max-0.png").convert("RGBA")
parts = {path.stem: Image.open(path).convert("RGBA") for path in RIG.glob("*.png")}


def compare(label: str, image: Image.Image) -> None:
    a = np.asarray(SOURCE).astype(np.int16)
    b = np.asarray(image).astype(np.int16)
    delta = np.abs(a - b)
    changed = np.any(delta > 2, axis=2)
    visible = np.asarray(SOURCE.getchannel("A")) > 0
    print(f"{label}: differing_pixels={int(changed.sum())}, differing_visible={int((changed & visible).sum())}, max_channel_delta={int(delta.max())}")


def compose(order: list[str], subtract_hands: bool) -> Image.Image:
    layers = dict(parts)
    if subtract_hands:
        for side in ("left", "right"):
            arm = np.array(layers[f"sleeve-{side}"]).astype(np.float64)
            hand_alpha = np.asarray(layers[f"hand-{side}"])[:, :, 3].astype(np.float64) / 255
            arm[:, :, 3] *= 1 - hand_alpha
            layers[f"sleeve-{side}"] = Image.fromarray(np.uint8(np.rint(arm)), "RGBA")
    result = Image.new("RGBA", SOURCE.size)
    for name in order:
        result = Image.alpha_composite(result, layers[name])
    return result


def prepared_arm(side: str) -> Image.Image:
    arm = np.array(parts[f"sleeve-{side}"]).astype(np.float64)
    hand_alpha = np.asarray(parts[f"hand-{side}"])[:, :, 3].astype(np.float64) / 255
    arm[:, :, 3] *= 1 - hand_alpha
    return Image.fromarray(np.uint8(np.rint(arm)), "RGBA")


def render_pose(right: int = 0, left: int = 0, right_hand: int = 0, left_hand: int = 0) -> Image.Image:
    result = parts["torso"].copy()
    for side, angle, hand_angle, shoulder, wrist in [
        ("right", right, right_hand, (150, 410), (98, 521)),
        ("left", left, left_hand, (300, 410), (333, 522)),
    ]:
        arm = prepared_arm(side).rotate(-angle, Image.Resampling.BICUBIC, center=shoulder)
        hand = parts[f"hand-{side}"].rotate(-hand_angle, Image.Resampling.BICUBIC, center=wrist).rotate(-angle, Image.Resampling.BICUBIC, center=shoulder)
        result = Image.alpha_composite(result, arm)
        result = Image.alpha_composite(result, hand)
    result = Image.alpha_composite(result, parts["head"])
    for side in ("right", "left"):
        result = Image.alpha_composite(result, parts[f"shoulder-{side}"])
    return result


def save_diagnostics() -> None:
    output = Path(__file__).resolve().parent / "diagnostics"
    output.mkdir(exist_ok=True)
    poses = {
        "neutral-layered": (0, 0, 0, 0),
        "right-arm-30": (30, 0, 0, 0),
        "right-arm-raised": (60, 0, 0, 0),
        "left-arm-30": (0, -30, 0, 0),
        "left-arm-raised": (0, -60, 0, 0),
        "both-arms-30": (30, -30, 0, 0),
        "both-arms-raised": (60, -60, 0, 0),
        "both-arms-inward": (-30, 30, 0, 0),
    }
    for name, angles in poses.items():
        render_pose(*angles).save(output / f"{name}.png")
    SOURCE.save(output / "approved-original.png")
    current = ["torso", "sleeve-right", "hand-right", "sleeve-left", "hand-left", "shoulder-right", "shoulder-left"]
    compose(current, True).save(output / "failed-editor-neutral.png")
    comparison = Image.new("RGBA", (868, 762), (232, 231, 239, 255))
    comparison.alpha_composite(SOURCE, (0, 38))
    comparison.alpha_composite(render_pose(), (434, 38))
    draw = ImageDraw.Draw(comparison)
    draw.text((10, 10), "Approved original", fill=(20, 20, 30))
    draw.text((444, 10), "Existing layered rig - neutral", fill=(20, 20, 30))
    comparison.convert("RGB").save(output / "neutral-comparison.png")
    compare("layered_neutral_diagnostic", render_pose())


if __name__ == "__main__":
    print("source", SOURCE.size, SOURCE.mode, SOURCE.getchannel("A").getbbox())
    for name, part in sorted(parts.items()):
        rgba = np.asarray(part)
        original = np.asarray(SOURCE)
        active = rgba[:, :, 3] > 0
        print(name, part.size, part.getchannel("A").getbbox(), "nonzero", int(active.sum()), "rgba_unlike_source", int((np.any(rgba != original, axis=2) & active).sum()))
    current = ["torso", "sleeve-right", "hand-right", "sleeve-left", "hand-left", "shoulder-right", "shoulder-left"]
    intended = ["torso", "sleeve-right", "sleeve-left", "hand-right", "hand-left", "head", "shoulder-right", "shoulder-left"]
    compare("current_renderer_neutral", compose(current, True))
    compare("intended_rig_draw_order", compose(intended, False))
    compare("intended_with_hand_subtraction", compose(intended, True))
    if "--write-diagnostics" in sys.argv:
        save_diagnostics()

"""Offline, deterministic palette proof over the approved Max raster frames.

Hairline anchors are authored once per source pose. They are colour masks, not
replacement art: no source silhouette, pose, alpha, or animation code is edited.
"""

from __future__ import annotations

import argparse
import colorsys
import hashlib
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
ART = ROOT / "public" / "art"
NAMES = ["max-0.png", "max-side-0.png"] + [f"max-side-v3-{i}.png" for i in range(1, 5)] + [f"max-wave-{i}.png" for i in range(1, 4)]

# Landmark points follow the painted hair/forehead edge at native resolution.
# A smooth curve through them gives the precise raster mask for each pose.
FRONT = [(98, 159), (130, 149), (160, 140), (187, 137), (210, 144), (233, 160), (258, 186), (272, 165), (284, 149), (302, 138), (325, 148), (349, 172), (369, 185)]
WAVE = [(153, 159), (183, 149), (212, 140), (239, 137), (261, 144), (284, 160), (306, 186), (320, 165), (332, 149), (350, 138), (373, 148), (399, 172), (419, 185)]
SIDE = [(90, 200), (120, 194), (145, 182), (162, 165), (187, 153), (220, 146), (250, 144), (282, 146), (307, 153), (330, 169), (342, 179), (354, 164), (380, 174), (404, 190)]
SIDE_REAR_TUFT = [(96, 176), (111, 180), (137, 191), (148, 205), (137, 215), (114, 218), (97, 209), (89, 194)]


def shifted(points: list[tuple[int, int]], dx: int, dy: int = 0) -> list[tuple[int, int]]:
    return [(x + dx, y + dy) for x, y in points]


HAIRLINES = {
    "max-0.png": FRONT,
    "max-side-0.png": shifted(SIDE, -5, 3),
    "max-side-v3-1.png": SIDE,
    "max-side-v3-2.png": shifted(SIDE, 45),
    "max-side-v3-3.png": shifted(SIDE, 45),
    "max-side-v3-4.png": shifted(SIDE, 60),
    "max-wave-1.png": WAVE,
    "max-wave-2.png": WAVE,
    "max-wave-3.png": WAVE,
}
REAR_TUFTS = {
    "max-side-0.png": shifted(SIDE_REAR_TUFT, -5, 3),
    "max-side-v3-1.png": SIDE_REAR_TUFT,
    "max-side-v3-2.png": shifted(SIDE_REAR_TUFT, 45),
    "max-side-v3-3.png": shifted(SIDE_REAR_TUFT, 45),
    "max-side-v3-4.png": shifted(SIDE_REAR_TUFT, 60),
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rgb(hex_value: str) -> tuple[int, int, int]:
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", hex_value):
        raise ValueError(f"Expected #RRGGBB colour, received {hex_value!r}")
    return tuple(int(hex_value[i:i + 2], 16) for i in (1, 3, 5))


def validate_specs(data: list[dict]) -> list[dict]:
    if not isinstance(data, list) or not data:
        raise ValueError("Palette file must contain a nonempty list")
    ids: set[str] = set()
    for spec in data:
        if set(spec) != {"id", "name", "body", "hair", "hoodie"}:
            raise ValueError("Each palette requires id, name, body, hair, hoodie")
        if not isinstance(spec["id"], str) or not re.fullmatch(r"[a-z][a-z0-9-]*", spec["id"]):
            raise ValueError("Palette id must be lowercase ASCII")
        if spec["id"] in ids:
            raise ValueError("Duplicate palette id")
        ids.add(spec["id"])
        for key in ("body", "hair", "hoodie"):
            rgb(spec[key])
    return data


def catmull_y(points: list[tuple[int, int]], x: float) -> float:
    if x <= points[0][0]:
        return points[0][1]
    if x >= points[-1][0]:
        return points[-1][1]
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        if x1 <= x <= x2:
            y0 = points[max(0, i - 1)][1]
            y3 = points[min(len(points) - 1, i + 2)][1]
            t = (x - x1) / (x2 - x1)
            return 0.5 * ((2 * y1) + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t * t + (-y0 + 3 * y1 - 3 * y2 + y3) * t * t * t)
    raise AssertionError("Unreachable hairline interpolation")


def hair_guide(name: str, size: tuple[int, int]) -> Image.Image:
    factor = 4
    line = HAIRLINES[name]
    high = Image.new("L", (size[0] * factor, size[1] * factor), 0)
    low_edge = [(x, 0) for x in (line[0][0] * factor, line[-1][0] * factor)]
    low_edge += [(x, round(catmull_y(line, x / factor) * factor)) for x in range(line[-1][0] * factor, line[0][0] * factor - 1, -1)]
    ImageDraw.Draw(high).polygon(low_edge, fill=255)
    if name in REAR_TUFTS:
        ImageDraw.Draw(high).polygon([(x * factor, y * factor) for x, y in REAR_TUFTS[name]], fill=255)
    return high.resize(size, Image.Resampling.LANCZOS)


def source_mappings(source: Image.Image, name: str) -> dict[str, Image.Image]:
    guide = hair_guide(name, source.size)
    hair = Image.new("L", source.size)
    body = Image.new("L", source.size)
    hoodie = Image.new("L", source.size)
    pixels = source.load()
    gp = guide.load()
    hp, bp, cp = hair.load(), body.load(), hoodie.load()
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # Broad enough to include cyan hair highlights; dark line art is
            # deliberately excluded by value. Masks are saved and reused.
            # Blue brows and nose sit just beyond this hue band and must keep
            # their approved paint; widening it produces speckled features.
            is_teal = 0.39 <= h <= 0.54 and s >= 0.22 and v >= 0.27
            is_hoodie = 0.68 <= h <= 0.85 and s >= 0.27 and v >= 0.25
            if is_teal:
                hp[x, y] = round(a * gp[x, y] / 255)
                bp[x, y] = round(a * (255 - gp[x, y]) / 255)
            elif is_hoodie:
                cp[x, y] = a
    return {"hair": hair, "body": body, "hoodie": hoodie}


def target_hsv(spec: dict) -> dict[str, tuple[float, float, float]]:
    return {key: colorsys.rgb_to_hsv(*(v / 255 for v in rgb(spec[key]))) for key in ("body", "hair", "hoodie")}


SOURCE_BASE = {"body": (0.47, 0.68, 0.85), "hair": (0.49, 0.95, 0.73), "hoodie": (0.72, 0.65, 0.80)}


def transform(source: Image.Image, masks: dict[str, Image.Image], spec: dict) -> Image.Image:
    result = source.copy()
    src, dst = source.load(), result.load()
    mp = {key: mask.load() for key, mask in masks.items()}
    colours = target_hsv(spec)
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = src[x, y]
            if a == 0:
                continue
            red_sum, green_sum, blue_sum = 0.0, 0.0, 0.0
            total_weight = 0.0
            for key in ("hair", "body", "hoodie"):
                weight = mp[key][x, y] / a
                if weight == 0:
                    continue
                _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                th, ts, tv = colours[key]
                _, bs, bv = SOURCE_BASE[key]
                new_s = max(0, min(1, s * ts / bs))
                new_v = max(0, min(1, v * tv / bv))
                rr, gg, bb = colorsys.hsv_to_rgb(th, new_s, new_v)
                red_sum += rr * 255 * weight
                green_sum += gg * 255 * weight
                blue_sum += bb * 255 * weight
                total_weight += weight
            if total_weight:
                remain = max(0.0, 1.0 - total_weight)
                dst[x, y] = (round(r * remain + red_sum), round(g * remain + green_sum), round(b * remain + blue_sum), a)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--specs", type=Path, default=HERE / "palettes.json")
    parser.add_argument("--output", type=Path, default=HERE / "v2")
    args = parser.parse_args()
    specs = validate_specs(json.loads(args.specs.read_text(encoding="utf-8")))
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = []
    for name in NAMES:
        src_path = ART / name
        source = Image.open(src_path).convert("RGBA")
        masks = source_mappings(source, name)
        for key, mask in masks.items():
            target = args.output / "masks" / f"{name.removesuffix('.png')}-{key}.png"
            target.parent.mkdir(parents=True, exist_ok=True)
            mask.save(target)
        for spec in specs:
            output = args.output / spec["id"] / name
            output.parent.mkdir(parents=True, exist_ok=True)
            result = transform(source, masks, spec)
            result.save(output)
            manifest.append({"name": name, "palette": spec["id"], "source_sha256": sha(src_path), "output_sha256": sha(output), "dimensions": source.size, "alpha_identical": source.getchannel("A").tobytes() == result.getchannel("A").tobytes()})
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    make_sheets(args.output, specs)


def font(size: int) -> ImageFont.ImageFont:
    path = Path("C:/Windows/Fonts/arial.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def scaled(im: Image.Image, height: int) -> Image.Image:
    return im.resize((round(im.width * height / im.height), height), Image.Resampling.LANCZOS)


def composite(sheet: Image.Image, sprite: Image.Image, center_x: int, y: int, height: int, width: int | None = None) -> None:
    sprite = sprite.resize((width, height), Image.Resampling.LANCZOS) if width else scaled(sprite, height)
    sheet.paste(sprite, (center_x - sprite.width // 2, y), sprite)


def make_sheets(out: Path, specs: list[dict]) -> None:
    title, label = font(28), font(18)
    # The existing canvas draws all approved sprites at 355 logical pixels.
    standing = Image.new("RGB", (1320, 465), "#f6f4fa")
    d = ImageDraw.Draw(standing)
    d.text((28, 17), "Standing comparison - actual 355 px canvas scale", font=title, fill="#262042")
    for i, (name, path) in enumerate([("Max", ART / NAMES[0])] + [(s["name"], out / s["id"] / NAMES[0]) for s in specs]):
        x = 165 + i * 330
        composite(standing, Image.open(path).convert("RGBA"), x, 62, 355, 213)
        d.text((x - 45, 424), name, font=label, fill="#262042")
    standing.save(out / "standing-stage-scale.png")

    native = Image.new("RGB", (2180, 805), "#f6f4fa")
    nd = ImageDraw.Draw(native)
    nd.text((28, 14), "Standing comparison - full 724 px source-frame scale", font=title, fill="#262042")
    for i, (name, path) in enumerate([("Max", ART / NAMES[0])] + [(s["name"], out / s["id"] / NAMES[0]) for s in specs]):
        x = 275 + i * 540
        composite(native, Image.open(path).convert("RGBA"), x, 50, 724)
        nd.text((x - 40, 778), name, font=label, fill="#262042")
    native.save(out / "standing-native-scale.png")

    for sheet_name, frames in (("walking", NAMES[2:6]), ("waving", NAMES[6:9])):
        cell_width, row_height = 310, 420
        width = cell_width * len(frames)
        sheet = Image.new("RGB", (width, 65 + row_height * 3), "#f6f4fa")
        d = ImageDraw.Draw(sheet)
        d.text((24, 16), f"{sheet_name.title()} - all frames at actual 355 px canvas scale", font=title, fill="#262042")
        for row, spec in enumerate(specs):
            y = 65 + row * row_height
            d.text((22, y), spec["name"], font=label, fill="#262042")
            for col, name in enumerate(frames):
                im = Image.open(out / spec["id"] / name).convert("RGBA")
                composite(sheet, im, col * cell_width + cell_width // 2, y + 25, 355, 239 if sheet_name == "walking" else 245)
                d.text((col * cell_width + 100, y + 384), name.removeprefix("max-").removesuffix(".png"), font=label, fill="#51476b")
        sheet.save(out / f"{sheet_name}-contact.png")

    # Crop the most difficult painted hair/forehead boundary, at 3x.
    close = Image.new("RGB", (1500, 620), "#f6f4fa")
    d = ImageDraw.Draw(close)
    d.text((24, 16), "Hairline detail - original and all three palettes at 3x", font=title, fill="#262042")
    for row, source_name in enumerate((NAMES[0], NAMES[2])):
        box = (112, 115, 362, 215) if row == 0 else (113, 113, 363, 213)
        d.text((24, 60 + row * 277), "Front" if row == 0 else "Walk 1", font=label, fill="#262042")
        for col, path in enumerate([ART / source_name] + [out / s["id"] / source_name for s in specs]):
            crop = Image.open(path).convert("RGBA").crop(box)
            crop = crop.resize((350, 140), Image.Resampling.NEAREST)
            close.paste(crop, (24 + col * 368, 91 + row * 277), crop)
            d.text((24 + col * 368, 237 + row * 277), "Max" if col == 0 else specs[col - 1]["name"], font=label, fill="#262042")
    close.save(out / "hairline-closeups.png")

    before_after = Image.new("RGB", (1480, 655), "#f6f4fa")
    ba = ImageDraw.Draw(before_after)
    ba.text((24, 16), "Hairline correction - previous proof / V2", font=title, fill="#262042")
    for row, source_name in enumerate((NAMES[0], NAMES[2], NAMES[7])):
        crop_box = (106, 112, 386, 210) if row != 2 else (152, 108, 432, 206)
        previous = HERE / source_name.replace("max", "recoloured-max", 1)
        current = out / "oliver" / source_name
        ba.text((24, 65 + row * 195), ("Idle", "Walk 1", "Wave 2")[row], font=label, fill="#262042")
        for col, path in enumerate((previous, current)):
            crop = Image.open(path).convert("RGBA").crop(crop_box).resize((560, 196), Image.Resampling.NEAREST)
            before_after.paste(crop, (170 + col * 650, 58 + row * 195), crop)
    ba.text((170, 45), "Previous", font=label, fill="#51476b")
    ba.text((820, 45), "V2", font=label, fill="#51476b")
    before_after.save(out / "hairline-before-after.png")


if __name__ == "__main__":
    main()

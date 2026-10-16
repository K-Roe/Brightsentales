"""Offline palette proof over Maxine's nine approved raster animation frames."""

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
NAMES = ["maxine-0.png", "maxine-side-0.png"] + [f"maxine-side-v3-{i}.png" for i in range(1, 5)] + [f"maxine-wave-{i}.png" for i in range(1, 4)]

# Hand windows are pose-specific and only disambiguate pink skin from pink
# cuffs, star, skirt trim and trainers. HSV selection determines actual pixels.
HAND_WINDOWS = {
    "maxine-0.png": [(48, 465, 132, 546), (292, 465, 370, 542)],
    "maxine-side-0.png": [(195, 470, 279, 553), (350, 490, 408, 547)],
    "maxine-side-v3-1.png": [(118, 423, 205, 520), (390, 400, 493, 490)],
    "maxine-side-v3-2.png": [(139, 430, 231, 530), (395, 415, 488, 515)],
    "maxine-side-v3-3.png": [(102, 435, 207, 530), (392, 390, 500, 505)],
    "maxine-side-v3-4.png": [(110, 435, 220, 530), (396, 390, 515, 510)],
    "maxine-wave-1.png": [(30, 340, 139, 460), (344, 480, 435, 565)],
    "maxine-wave-2.png": [(28, 220, 153, 375), (340, 483, 439, 570)],
    "maxine-wave-3.png": [(34, 235, 153, 385), (340, 483, 435, 570)],
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_hex(value: str) -> tuple[int, int, int]:
    if not isinstance(value, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        raise ValueError(f"Invalid colour: {value!r}; expected #RRGGBB")
    return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))


def validate(specs: list[dict]) -> list[dict]:
    if not isinstance(specs, list) or not specs:
        raise ValueError("Expected nonempty palette list")
    ids = set()
    for spec in specs:
        if set(spec) != {"id", "name", "body", "hair", "clothing"}:
            raise ValueError("Expected id, name, body, hair and clothing")
        if not isinstance(spec["id"], str) or not re.fullmatch(r"[a-z][a-z0-9-]*", spec["id"]):
            raise ValueError("Invalid palette id")
        if spec["id"] in ids:
            raise ValueError("Duplicate palette id")
        ids.add(spec["id"])
        for field in ("body", "hair", "clothing"):
            parse_hex(spec[field])
    return specs


def is_side(name: str) -> bool:
    return "side" in name


def is_wave(name: str) -> bool:
    return "wave" in name


def side_shift(name: str) -> int:
    return {"maxine-side-0.png": 0, "maxine-side-v3-1.png": 0,
            "maxine-side-v3-2.png": 18, "maxine-side-v3-3.png": 18,
            "maxine-side-v3-4.png": 38}.get(name, 0)


def side_hair_edge(y: int, name: str) -> float:
    # Face-to-ponytail boundary follows the approved side view. It only guides
    # purple hair selection; pink fringe uses its own saturation/position rule.
    anchors = [(145, 370), (190, 335), (230, 300), (280, 278), (340, 225), (410, 185)]
    if y <= anchors[0][0]:
        return anchors[0][1] + side_shift(name)
    for (y1, x1), (y2, x2) in zip(anchors, anchors[1:]):
        if y <= y2:
            return x1 + (x2 - x1) * (y - y1) / (y2 - y1) + side_shift(name)
    return anchors[-1][1] + side_shift(name)


def in_window(x: int, y: int, windows: list[tuple[int, int, int, int]]) -> bool:
    return any(left <= x <= right and top <= y <= bottom for left, top, right, bottom in windows)


def hair_location(name: str, x: int, y: int, magenta: bool) -> bool:
    if is_side(name):
        edge = side_hair_edge(y, name)
        if magenta:
            return y < 270 or (y < 425 and x < edge)
        return y < 375 or (y < 435 and x < edge)
    shift = 24 if is_wave(name) else 0
    if magenta:
        return y < 275 or (y < 435 and (x < 140 + shift or x > 310 + shift))
    return y < 375 or (y < 435 and (x < 140 + shift or x > 295 + shift))


def protected_face_detail(name: str, x: int, y: int) -> bool:
    def ellipse(cx: int, cy: int, rx: int, ry: int) -> bool:
        return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

    if is_side(name):
        shift = side_shift(name)
        brow = ellipse(353 + shift, 211, 31, 13)
        eye = ellipse(371 + shift, 273, 49, 55)
    else:
        shift = 24 if is_wave(name) else 0
        brow = ellipse(152 + shift, 252, 31, 12) or ellipse(263 + shift, 252, 34, 12)
        eye = ellipse(153 + shift, 309, 52, 48) or ellipse(266 + shift, 309, 54, 48)
    return brow or eye


def protected_nose(name: str, x: int, y: int) -> bool:
    if is_side(name):
        shift = side_shift(name)
        return 397 + shift <= x <= 441 + shift and 275 <= y <= 311
    shift = 24 if is_wave(name) else 0
    return 189 + shift <= x <= 227 + shift and 324 <= y <= 350


def inside_ear(name: str, x: int, y: int) -> bool:
    if is_side(name):
        shift = side_shift(name)
        return ((x - (257 + shift)) / 45) ** 2 + ((y - 310) / 35) ** 2 <= 1
    shift = 24 if is_wave(name) else 0
    return (((x - (82 + shift)) / 31) ** 2 + ((y - 336) / 49) ** 2 <= 1 or
            ((x - (353 + shift)) / 32) ** 2 + ((y - 338) / 49) ** 2 <= 1)


def inside_side_star(name: str, x: int, y: int) -> bool:
    return is_side(name) and 420 <= y <= 490 and 295 + side_shift(name) <= x <= 390 + side_shift(name)


def body_location(name: str, x: int, y: int) -> bool:
    if is_side(name):
        shift = side_shift(name)
        face = 185 <= y <= 390 and 205 + shift <= x <= 450 + shift
        neck = 350 <= y <= 435 and 275 + shift <= x <= 390 + shift
    else:
        shift = 24 if is_wave(name) else 0
        face = 205 <= y <= 407 and 55 + shift <= x <= 375 + shift
        neck = 375 <= y <= 435 and 175 + shift <= x <= 270 + shift
    return face or neck or in_window(x, y, HAND_WINDOWS[name])


def masks_for(source: Image.Image, name: str) -> dict[str, Image.Image]:
    masks = {key: Image.new("L", source.size) for key in ("hair", "body", "clothing")}
    pixels = source.load()
    channels = {key: value.load() for key, value in masks.items()}
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            purple_hair = 0.67 <= h <= 0.875 and s >= 0.24 and v >= 0.32
            pink_hair = ((0.865 < h <= 0.934 and s >= 0.34) or
                         (0.934 < h <= 0.938 and s >= 0.56)) and v >= 0.38
            skin = 0.932 <= h <= 0.977 and 0.17 <= s <= 0.82 and v >= 0.52
            cream = 0.035 <= h <= 0.155 and 0.055 <= s <= 0.31 and v >= 0.63
            if purple_hair and hair_location(name, x, y, False) and not protected_face_detail(name, x, y):
                channels["hair"][x, y] = a
            elif pink_hair and hair_location(name, x, y, True) and not inside_ear(name, x, y):
                channels["hair"][x, y] = a
            elif skin and body_location(name, x, y) and not inside_side_star(name, x, y) and not (protected_nose(name, x, y) and s > 0.50):
                channels["body"][x, y] = a
            elif cream and 338 <= y <= 536:
                channels["clothing"][x, y] = a
    return masks


def palette_hsv(spec: dict) -> dict[str, tuple[float, float, float]]:
    return {key: colorsys.rgb_to_hsv(*(v / 255 for v in parse_hex(spec[key]))) for key in ("hair", "body", "clothing")}


BASE = {"hair": (0.78, 0.67, 0.78), "body": (0.95, 0.43, 0.98), "clothing": (0.08, 0.15, 0.98)}


def colourise(source: Image.Image, masks: dict[str, Image.Image], spec: dict) -> Image.Image:
    output = source.copy()
    src, dst = source.load(), output.load()
    mask_pixels = {key: value.load() for key, value in masks.items()}
    desired = palette_hsv(spec)
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = src[x, y]
            if a == 0:
                continue
            for key in ("hair", "body", "clothing"):
                amount = mask_pixels[key][x, y] / a
                if not amount:
                    continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                th, ts, tv = desired[key]
                bh, bs, bv = BASE[key]
                if key == "hair":
                    deviation = (h - bh + 0.5) % 1 - 0.5
                    th = (th + min(0.026, max(-0.035, deviation * 0.4))) % 1
                ns = min(1.0, s * ts / bs)
                nv = min(1.0, v * tv / bv)
                nr, ng, nb = colorsys.hsv_to_rgb(th, ns, nv)
                dst[x, y] = (round(r * (1 - amount) + nr * 255 * amount),
                             round(g * (1 - amount) + ng * 255 * amount),
                             round(b * (1 - amount) + nb * 255 * amount), a)
                break
    return output


def font(size: int) -> ImageFont.ImageFont:
    path = Path("C:/Windows/Fonts/arial.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def paste_sprite(sheet: Image.Image, sprite: Image.Image, cx: int, y: int, width: int, height: int) -> None:
    sprite = sprite.resize((width, height), Image.Resampling.LANCZOS)
    sheet.paste(sprite, (cx - width // 2, y), sprite)


def sheets(out: Path, specs: list[dict]) -> None:
    title, label = font(27), font(18)
    comparisons = [("Maxine", ART / NAMES[0])] + [(s["name"], out / s["id"] / NAMES[0]) for s in specs]
    for filename, width, height, canvas_height in (("standing-stage-scale.png", 213, 355, 465),
                                                    ("standing-native-scale.png", 434, 724, 815)):
        cell = 330 if height == 355 else 520
        sheet = Image.new("RGB", (cell * 4, canvas_height), "#f7f3f8")
        d = ImageDraw.Draw(sheet)
        d.text((25, 16), "Maxine and female Brightlings - " + ("actual 355 px editor scale" if height == 355 else "full 724 px source scale"), font=title, fill="#302145")
        for i, (name, path) in enumerate(comparisons):
            x = cell * i + cell // 2
            paste_sprite(sheet, Image.open(path).convert("RGBA"), x, 58, width, height)
            d.text((x - 38, 58 + height + 9), name, font=label, fill="#302145")
        sheet.save(out / filename)

    for action, frames, draw_width in (("walking", NAMES[2:6], 239), ("waving", NAMES[6:9], 245)):
        cell_width, row_height = 310, 420
        sheet = Image.new("RGB", (cell_width * len(frames), 65 + row_height * 3), "#f7f3f8")
        d = ImageDraw.Draw(sheet)
        d.text((24, 16), action.title() + " - approved frames at actual 355 px editor scale", font=title, fill="#302145")
        for row, spec in enumerate(specs):
            y = 65 + row * row_height
            d.text((20, y), spec["name"], font=label, fill="#302145")
            for col, name in enumerate(frames):
                paste_sprite(sheet, Image.open(out / spec["id"] / name).convert("RGBA"), col * cell_width + 155, y + 23, draw_width, 355)
                d.text((col * cell_width + 100, y + 383), name.removeprefix("maxine-").removesuffix(".png"), font=label, fill="#574465")
        sheet.save(out / f"{action}-contact.png")

    # Original plus three results, cropped without smoothing to expose seams.
    details = [
        ("Front hair / face", NAMES[0], (105, 155, 365, 290)),
        ("Side hair / face", NAMES[2], (180, 118, 440, 310)),
        ("Front hoodie / hand", NAMES[0], (55, 390, 365, 550)),
        ("Wave sleeve / hand", NAMES[7], (30, 242, 290, 430)),
    ]
    close = Image.new("RGB", (1680, 1040), "#f7f3f8")
    d = ImageDraw.Draw(close)
    d.text((24, 14), "Boundary close-ups - original and all palettes (nearest-neighbour enlargement)", font=title, fill="#302145")
    for row, (caption, name, box) in enumerate(details):
        top = 64 + row * 242
        d.text((22, top), caption, font=label, fill="#302145")
        for col, path in enumerate([ART / name] + [out / s["id"] / name for s in specs]):
            im = Image.open(path).convert("RGBA").crop(box).resize((390, 195), Image.Resampling.NEAREST)
            close.paste(im, (22 + col * 410, top + 24), im)
            d.text((24 + col * 410, top + 222), "Maxine" if col == 0 else specs[col - 1]["name"], font=label, fill="#574465")
    close.save(out / "boundary-closeups.png")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--palettes", type=Path, default=HERE / "palettes.json")
    parser.add_argument("--output", type=Path, default=HERE / "v1")
    args = parser.parse_args()
    specs = validate(json.loads(args.palettes.read_text(encoding="utf-8")))
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = []
    for name in NAMES:
        src_path = ART / name
        source = Image.open(src_path).convert("RGBA")
        masks = masks_for(source, name)
        for region, mask in masks.items():
            target = args.output / "masks" / f"{name.removesuffix('.png')}-{region}.png"
            target.parent.mkdir(parents=True, exist_ok=True)
            mask.save(target)
        for spec in specs:
            result = colourise(source, masks, spec)
            target = args.output / spec["id"] / name
            target.parent.mkdir(parents=True, exist_ok=True)
            result.save(target)
            manifest.append({"frame": name, "palette": spec["id"], "source_sha256": digest(src_path),
                             "output_sha256": digest(target), "size": source.size,
                             "alpha_identical": source.getchannel("A").tobytes() == result.getchannel("A").tobytes()})
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    sheets(args.output, specs)


if __name__ == "__main__":
    main()

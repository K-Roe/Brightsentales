"""Offline colour-mask proof using the approved Max PNGs. Does not touch app assets."""

from __future__ import annotations

import colorsys
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "public" / "art"
OUT = Path(__file__).resolve().parent
FRAMES = [
    "max-0.png",
    "max-side-0.png",
    *(f"max-side-v3-{i}.png" for i in range(1, 5)),
    *(f"max-wave-{i}.png" for i in range(1, 4)),
]

# One spatial guide per approved pose. These do not describe new drawing or
# geometry: they only distinguish teal hair from adjacent teal skin.
HAIR_POLYGONS = {
    "max-0.png": [(96, 155), (109, 118), (163, 67), (211, 35), (288, 39), (356, 92), (361, 153), (321, 137), (283, 136), (263, 181), (228, 155), (179, 143), (124, 151)],
    "max-side-0.png": [(94, 172), (98, 133), (150, 90), (191, 40), (320, 21), (379, 86), (383, 164), (323, 151), (282, 148), (236, 152), (186, 162), (147, 178)],
    "max-side-v3-1.png": [(93, 173), (111, 115), (171, 75), (204, 31), (328, 17), (390, 76), (397, 164), (339, 151), (294, 144), (252, 148), (206, 153), (152, 175)],
    "max-side-v3-2.png": [(143, 173), (152, 114), (213, 67), (253, 26), (374, 17), (435, 76), (442, 164), (391, 151), (340, 144), (298, 148), (256, 153), (200, 175)],
    "max-side-v3-3.png": [(143, 173), (152, 114), (213, 67), (253, 26), (374, 17), (435, 76), (442, 164), (391, 151), (340, 144), (298, 148), (256, 153), (200, 175)],
    "max-side-v3-4.png": [(158, 173), (168, 113), (227, 67), (268, 26), (389, 17), (450, 76), (457, 164), (406, 151), (355, 144), (313, 148), (271, 153), (215, 175)],
    "max-wave-1.png": [(154, 156), (165, 114), (220, 68), (261, 35), (337, 37), (407, 87), (410, 151), (373, 135), (331, 136), (304, 180), (266, 155), (215, 143), (180, 151)],
    "max-wave-2.png": [(154, 156), (165, 114), (220, 68), (261, 35), (337, 37), (407, 87), (410, 151), (373, 135), (331, 136), (304, 180), (266, 155), (215, 143), (180, 151)],
    "max-wave-3.png": [(154, 156), (165, 114), (220, 68), (261, 35), (337, 37), (407, 87), (410, 151), (373, 135), (331, 136), (304, 180), (266, 155), (215, 143), (180, 151)],
}
HAIR_TOP_SPANS = {
    "max-0.png": (95, 365),
    "max-side-0.png": (92, 390),
    "max-side-v3-1.png": (90, 400),
    "max-side-v3-2.png": (140, 445),
    "max-side-v3-3.png": (140, 445),
    "max-side-v3-4.png": (155, 460),
    "max-wave-1.png": (150, 414),
    "max-wave-2.png": (150, 414),
    "max-wave-3.png": (150, 414),
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def recolour(source: Image.Image, name: str) -> tuple[Image.Image, Image.Image]:
    original = source.convert("RGBA")
    result = original.copy()
    guide = Image.new("L", original.size, 0)
    guide_draw = ImageDraw.Draw(guide)
    guide_draw.polygon(HAIR_POLYGONS[name], fill=255)
    left, right = HAIR_TOP_SPANS[name]
    guide_draw.rectangle((left, 0, right, 128), fill=255)
    diagnostic = Image.new("RGBA", original.size, (0, 0, 0, 0))
    src = original.load()
    dst = result.load()
    g = guide.load()
    dbg = diagnostic.load()

    for y in range(original.height):
        for x in range(original.width):
            r, green, b, a = src[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, green / 255, b / 255)
            kind = None
            if 0.43 <= h <= 0.54 and s >= 0.28 and v >= 0.24:
                if g[x, y] and s >= 0.45:
                    # Hair has a slightly different original teal palette.
                    h, s = 0.77, min(0.77, s * 0.78)
                    kind = (168, 71, 215, 210)
                else:
                    h, s = 0.425, min(0.72, s)
                    kind = (73, 211, 139, 210)
            elif 0.68 <= h <= 0.85 and s >= 0.29 and v >= 0.24:
                h, s = 0.075, min(0.86, s * 1.1)
                kind = (247, 137, 56, 210)
            if kind:
                nr, ng, nb = colorsys.hsv_to_rgb(h, s, v)
                dst[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
                dbg[x, y] = kind[:3] + (min(a, 210),)
    return result, diagnostic


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    proof: list[tuple[str, Image.Image, Image.Image]] = []
    for name in FRAMES:
        path = ART / name
        original = Image.open(path).convert("RGBA")
        changed, mask = recolour(original, name)
        output = OUT / name.replace("max", "recoloured-max", 1)
        changed.save(output)
        mask.save(OUT / name.replace("max", "mask-max", 1))
        manifest.append({
            "frame": name,
            "source_sha256": digest(path),
            "output_sha256": digest(output),
            "size": original.size,
            "alpha_identical": original.getchannel("A").tobytes() == changed.getchannel("A").tobytes(),
        })
        proof.append((name, original, changed))

    # Every pair uses the same 724 px source height and a shared display scale.
    scale = 0.46
    cell_w, cell_h = 260, 375
    sheet = Image.new("RGB", (cell_w * 6 + 72, cell_h * 3 + 115), "#f6f4fa")
    draw = ImageDraw.Draw(sheet)
    font_path = Path("C:/Windows/Fonts/arial.ttf")
    title_font = ImageFont.truetype(str(font_path), 27) if font_path.exists() else ImageFont.load_default()
    label_font = ImageFont.truetype(str(font_path), 17) if font_path.exists() else ImageFont.load_default()
    draw.text((34, 18), "Max colour customisation - original and recoloured", font=title_font, fill="#282047")
    draw.text((34, 58), "Each pair shows the same approved pose at the same scale. Eyes, star, shoes and original alpha remain unchanged.", font=label_font, fill="#51476b")
    for index, (name, original, changed) in enumerate(proof):
        row, column = divmod(index, 3)
        y = 98 + row * cell_h
        for side, im in enumerate((original, changed)):
            small = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
            x = 34 + (column * 2 + side) * cell_w
            sheet.paste(small, (x + (cell_w - small.width) // 2, y), small)
            pose = name.removeprefix("max-").removesuffix(".png").replace("side-v3-", "walk ").replace("wave-", "wave ")
            draw.text((x + 12, y + 341), ("Max" if side == 0 else "Recolour") + " - " + pose, font=label_font, fill="#34225b")
    sheet.save(OUT / "max-recolour-comparison.png")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

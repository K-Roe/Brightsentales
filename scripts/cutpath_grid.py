"""Authoring aid: render an approved frame with a coordinate grid so cut paths can be
placed by eye. Writes only to proofs/; it never modifies approved artwork."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "public" / "art"
OUT = ROOT / "proofs" / "max-phone-v1-3"


def main() -> None:
    name = sys.argv[1] if len(sys.argv) > 1 else "max-0"
    x0, y0, x1, y1 = (int(v) for v in sys.argv[2:6]) if len(sys.argv) > 5 else (60, 330, 390, 620)
    zoom = int(sys.argv[6]) if len(sys.argv) > 6 else 3
    OUT.mkdir(parents=True, exist_ok=True)

    source = Image.open(ART / f"{name}.png").convert("RGBA")
    crop = source.crop((x0, y0, x1, y1))
    width, height = (x1 - x0) * zoom, (y1 - y0) * zoom
    canvas = Image.new("RGBA", (width, height), (250, 250, 252, 255))
    canvas.alpha_composite(crop.resize((width, height), Image.NEAREST))
    draw = ImageDraw.Draw(canvas)
    for x in range(x0 - x0 % 10, x1 + 1, 10):
        px = (x - x0) * zoom
        major = x % 50 == 0
        draw.line([(px, 0), (px, height)], fill=(255, 0, 0, 120 if major else 55), width=1)
        if major:
            draw.text((px + 2, 2), str(x), fill=(200, 0, 0, 255))
    for y in range(y0 - y0 % 10, y1 + 1, 10):
        py = (y - y0) * zoom
        major = y % 50 == 0
        draw.line([(0, py), (width, py)], fill=(0, 0, 255, 120 if major else 55), width=1)
        if major:
            draw.text((2, py + 2), str(y), fill=(0, 0, 200, 255))
    out = OUT / f"grid-{name}-{x0}-{y0}.png"
    canvas.convert("RGB").save(out)
    print(out)


if __name__ == "__main__":
    main()
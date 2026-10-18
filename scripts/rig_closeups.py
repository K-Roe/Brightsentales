"""Close-up evidence for Karl's review gate: shoulders, hands and the hoodie star.

Renders the rest pose and the best available posed frame side by side, cropped to the three
areas called out in the acceptance gate.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "proofs" / "max-phone-v1-3"

REGIONS = {
    "shoulders": (95, 350, 300, 440),
    "hands": (150, 430, 320, 580),
    "star": (150, 400, 290, 520),
}


def main() -> None:
    rest = Image.open(OUT / "rig-rest-pose.png").convert("RGB")
    posed = Image.open(OUT / "rig-pose-tap-touch.png").convert("RGB")
    original = Image.open(ROOT / "public" / "art" / "max-0.png").convert("RGB")

    zoom = 3
    for name, box in REGIONS.items():
        width, height = (box[2] - box[0]) * zoom, (box[3] - box[1]) * zoom
        sheet = Image.new("RGB", (width * 3, height), (250, 250, 252))
        for index, source in enumerate((original, rest, posed)):
            sheet.paste(source.crop(box).resize((width, height), Image.NEAREST), (index * width, 0))
        sheet.save(OUT / f"closeup-{name}.png")
        print("wrote", OUT / f"closeup-{name}.png")


if __name__ == "__main__":
    main()
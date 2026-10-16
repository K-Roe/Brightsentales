"""Normalize V3 full-body walk poses and make an equal-scale review sheet.

Only side-view walk frames 1-4 are written. The existing side idle, front idle,
living room, and scene data are never touched.
"""

from pathlib import Path
from statistics import median

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art"
CONFIG = {
    "max": ([539, 1045, 1619], 680, 699),
    "maxine": ([488, 1029, 1613], 673, 706),
}
FRAME_SIZE = (560, 724)
LABELS = ("1 · Right contact", "2 · Passing", "3 · Left contact", "4 · Passing")


for name, (dividers, target_height, foot_line) in CONFIG.items():
    source = Image.open(ART / f"{name}-side-v3-sheet.png").convert("RGBA")
    edges = [0, *dividers, source.width]
    pieces = []
    for left, right in zip(edges, edges[1:]):
        cell = source.crop((left, 0, right, source.height))
        bounds = cell.getchannel("A").getbbox()
        if bounds is None:
            raise ValueError(f"Missing {name} artwork in {left}:{right}")
        pieces.append(cell.crop(bounds))
    scale = target_height / median(piece.height for piece in pieces)
    for index, piece in enumerate(pieces, 1):
        size = (round(piece.width * scale), round(piece.height * scale))
        if size[0] > FRAME_SIZE[0] or size[1] > FRAME_SIZE[1]:
            raise ValueError(f"{name} frame {index} exceeds the common canvas")
        resized = piece.resize(size, Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", FRAME_SIZE)
        frame.alpha_composite(resized, ((FRAME_SIZE[0] - size[0]) // 2, foot_line - size[1]))
        frame.save(ART / f"{name}-side-v3-{index}.png")


sheet = Image.new("RGB", (4 * 560 + 5 * 18, 2 * 810 + 3 * 18), "#f3f4fa")
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 22)
except OSError:
    font = ImageFont.load_default()

for row, name in enumerate(CONFIG):
    for col, label in enumerate(LABELS):
        x = 18 + col * 578
        y = 18 + row * 828
        draw.rounded_rectangle((x, y, x + 559, y + 809), radius=18, fill="#ffffff")
        draw.text((x + 24, y + 16), f"{name.title()} · {label}", font=font, fill="#282755")
        frame = Image.open(ART / f"{name}-side-v3-{col + 1}.png").convert("RGBA")
        sheet.paste(frame, (x, y + 54), frame)
        draw.line((x + 24, y + 54 + CONFIG[name][2], x + 536, y + 54 + CONFIG[name][2]), fill="#beb7d9", width=2)

sheet.save(ROOT / "milestone1-walking-v3-contact.png")

"""Align the three full-body wave poses with the approved front idle sprites.

Authoring-only script: the browser loads the resulting PNGs directly.
"""

from pathlib import Path
from statistics import median

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art"
CONFIG = {
    "max": ([800, 1320], 680, 699),
    "maxine": ([750, 1350], 673, 706),
}
FRAME_SIZE = (500, 724)
LABELS = ("Original idle", "Arm rising", "Open-hand wave", "Hand turns inward")


for name, (dividers, target_height, foot_line) in CONFIG.items():
    source = Image.open(ART / f"{name}-wave-sheet.png").convert("RGBA")
    edges = [0, *dividers, source.width]
    pieces = []
    for left, right in zip(edges, edges[1:]):
        cell = source.crop((left, 0, right, source.height))
        # Ignore near-transparent generation noise without changing visible pixels.
        bounds = cell.getchannel("A").point(lambda alpha: 255 if alpha > 8 else 0).getbbox()
        if bounds is None:
            raise ValueError(f"Missing {name} wave art in {left}:{right}")
        pieces.append(cell.crop(bounds))

    scale = target_height / median(piece.height for piece in pieces)
    for index, piece in enumerate(pieces, 1):
        size = (round(piece.width * scale), round(piece.height * scale))
        if size[0] > FRAME_SIZE[0] or size[1] > FRAME_SIZE[1]:
            raise ValueError(f"{name} wave frame {index} exceeds the shared canvas")
        resized = piece.resize(size, Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", FRAME_SIZE)
        frame.alpha_composite(resized, ((FRAME_SIZE[0] - size[0]) // 2, foot_line - size[1]))
        frame.save(ART / f"{name}-wave-{index}.png")


sheet = Image.new("RGB", (4 * 500 + 5 * 18, 2 * 810 + 3 * 18), "#f3f4fa")
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 22)
except OSError:
    font = ImageFont.load_default()

for row, name in enumerate(CONFIG):
    for col, label in enumerate(LABELS):
        x = 18 + col * 518
        y = 18 + row * 828
        draw.rounded_rectangle((x, y, x + 499, y + 809), radius=18, fill="#ffffff")
        draw.text((x + 24, y + 16), f"{name.title()} · {label}", font=font, fill="#282755")
        if col == 0:
            original = Image.open(ART / f"{name}-0.png").convert("RGBA")
            frame = Image.new("RGBA", FRAME_SIZE)
            frame.alpha_composite(original, ((FRAME_SIZE[0] - original.width) // 2, 0))
        else:
            frame = Image.open(ART / f"{name}-wave-{col}.png").convert("RGBA")
        sheet.paste(frame, (x, y + 54), frame)
        draw.line((x + 24, y + 54 + CONFIG[name][2], x + 476, y + 54 + CONFIG[name][2]), fill="#beb7d9", width=2)

sheet.save(ROOT / "milestone2-wave-contact.png")

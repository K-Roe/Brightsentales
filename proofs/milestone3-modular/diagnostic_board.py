"""Compare the approved style with failed local SDXL studies."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
cases = [
    ("Approved Max", ROOT / "public/art/max-0.png"),
    ("Text-only SDXL: different style", HERE / "generated/OliverFrontStudy_00001_.png"),
    ("Image reference 0.62: copies Max", HERE / "generated/OliverStyleStudy_00001_.png"),
    ("Image reference 0.82: loses finish", HERE / "generated/OliverStyleStudy_00002_.png"),
]
try:
    title_font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 28)
    label_font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 18)
except OSError:
    title_font = label_font = ImageFont.load_default()

board = Image.new("RGB", (4 * 360 + 5 * 18, 680), "#eef0f8")
draw = ImageDraw.Draw(board)
draw.text((22, 15), "LOCAL SDXL DIAGNOSTIC - REJECTED STUDIES, NOT OLIVER ART", font=title_font, fill="#292450")
for index, (label, path) in enumerate(cases):
    x = 18 + index * 378
    draw.rounded_rectangle((x, 68, x + 359, 660), radius=18, fill="white")
    draw.text((x + 14, 83), label, font=label_font, fill="#292450")
    source = Image.open(path).convert("RGBA")
    source.thumbnail((335, 535), Image.Resampling.LANCZOS)
    board.paste(source, (x + (360 - source.width) // 2, 119 + (535 - source.height) // 2), source)
board.save(HERE / "local-sdxl-diagnostic.png")

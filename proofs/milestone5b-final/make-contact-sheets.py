"""Review sheets only; source sprites are read without modification."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "public" / "art"
OUT = Path(__file__).resolve().parent
FONT = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 22)
TITLE = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 28)
GROUPS = (
    ("Max / Original Hoodie", "max", ""),
    ("Max / T-Shirt & Trousers", "max", "max-tshirt"),
    ("Maxine / Original Hoodie & Skirt", "maxine", ""),
    ("Maxine / T-Shirt & Leggings", "maxine", "maxine-tshirt"),
)
POSES = (
    ("Front idle", "{base}-0.png"),
    ("Side idle", "{base}-side-0.png"),
    *((f"Walk {i}", "{base}-side-v3-" + str(i) + ".png") for i in range(1, 5)),
    *((f"Wave {i}", "{base}-wave-" + str(i) + ".png") for i in range(1, 4)),
)


def sheet(poses, filename, scale):
    cell_w, cell_h = int(560 * scale) + 34, int(724 * scale) + 55
    canvas = Image.new("RGB", (cell_w * 4 + 24, cell_h * len(poses) + 96), "#f4f0fb")
    draw = ImageDraw.Draw(canvas)
    draw.text((24, 16), "Approved Brightling outfits - same source poses and timing", font=TITLE, fill="#241851")
    for col, (label, base, folder) in enumerate(GROUPS):
        short_label = ("Max / Original", "Max / T-Shirt", "Maxine / Original", "Maxine / T-Shirt")[col]
        draw.text((24 + col * cell_w, 58), label if len(poses) == 1 else short_label, font=FONT, fill="#442879")
        for row, (pose_label, pattern) in enumerate(poses):
            source = ART / folder / pattern.format(base=base)
            with Image.open(source) as opened:
                sprite = opened.convert("RGBA")
            sprite.thumbnail((int(560 * scale), int(724 * scale)), Image.Resampling.LANCZOS)
            x = 24 + col * cell_w + (cell_w - sprite.width) // 2
            y = 96 + row * cell_h
            panel = Image.new("RGBA", sprite.size, "#ffffff")
            panel.alpha_composite(sprite)
            canvas.paste(panel.convert("RGB"), (x, y))
            draw.text((24 + col * cell_w, y + int(724 * scale) + 5), pose_label, font=FONT, fill="#241851")
    canvas.save(OUT / filename)


sheet(POSES[:1], "completed-outfits-idle.png", 0.55)
sheet(POSES, "completed-outfits-nine-poses.png", 0.34)

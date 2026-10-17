"""Create review media for the experimental pixel-protected outfit frames."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
ORDER = ("0", "side-0", "side-v3-1", "side-v3-2", "side-v3-3", "side-v3-4", "wave-1", "wave-2", "wave-3")
FONT_FILE = Path("C:/Windows/Fonts/segoeui.ttf")


def font(size):
    return ImageFont.truetype(FONT_FILE, size) if FONT_FILE.exists() else ImageFont.load_default()


originals = {name: Image.open(REPO / "public" / "art" / f"max-{name}.png").convert("RGBA") for name in ORDER}
edits = {name: Image.open(ROOT / "frames" / f"max-{name}.png").convert("RGBA") for name in ORDER}


def fit(image, width, height):
    image = image.copy()
    image.thumbnail((width - 24, height - 24), Image.Resampling.LANCZOS)
    panel = Image.new("RGBA", (width, height), "#f5f2fa")
    panel.alpha_composite(image, ((width - image.width) // 2, height - image.height - 12))
    return panel.convert("RGB")


sheet = Image.new("RGB", (1080, 2700), "white")
draw = ImageDraw.Draw(sheet)
draw.text((25, 22), "MAX OUTFIT: ORIGINAL / MASKED EXPERIMENT", font=font(27), fill="#283658")
draw.text((25, 59), "Same canvas and display scale. Visible defects remain; not production-ready.", font=font(17), fill="#6a5270")
for row, name in enumerate(ORDER):
    y = 101 + row * 287
    draw.text((25, y), name, font=font(19), fill="#423065")
    sheet.paste(fit(originals[name], 500, 260), (25, y + 27))
    sheet.paste(fit(edits[name], 500, 260), (555, y + 27))
sheet.save(ROOT / "all-nine-contact-sheet.png")


def stage(canvas, sprite, x, baseline, width):
    sprite = sprite.resize((width, 355), Image.Resampling.LANCZOS)
    canvas.alpha_composite(sprite, (x - width // 2, baseline - 355))


def backdrop(title, size):
    image = Image.new("RGBA", size, "#f7f4fc")
    draw = ImageDraw.Draw(image)
    draw.text((20, 12), title, font=font(18), fill="#463470")
    return image


walk = []
durations = []
for index in range(16):
    if index == 0:
        name, x, duration = "0", 160, 320
    elif index == 1:
        name, x, duration = "side-0", 160, 110
    elif index <= 13:
        step = index - 2
        name, x, duration = f"side-v3-{step % 4 + 1}", 160 + step * 29, 123
    elif index == 14:
        name, x, duration = "side-0", 160 + 12 * 29, 110
    else:
        name, x, duration = "0", 160 + 12 * 29, 750
    canvas = backdrop("Approved above / masked experiment below", (820, 815))
    width = 213 if name in ("0", "side-0") else 239
    stage(canvas, originals[name], x, 390, width)
    stage(canvas, edits[name], x, 780, width)
    walk.append(canvas.convert("RGB"))
    durations.append(duration)
walk[0].save(ROOT / "walking-preview.gif", save_all=True, append_images=walk[1:], duration=durations, loop=0, optimize=False)

wave = []
for state in (0, 1, 2, 3, 2, 3, 2, 1, 0):
    name = "0" if state == 0 else f"wave-{state}"
    width = 213 if state == 0 else 245
    canvas = backdrop("Approved left / masked experiment right", (760, 450))
    stage(canvas, originals[name], 210, 405, width)
    stage(canvas, edits[name], 550, 405, width)
    wave.append(canvas.convert("RGB"))
wave[0].save(ROOT / "waving-preview.gif", save_all=True, append_images=wave[1:], duration=[180] * 9, loop=0, optimize=False)

details = (
    ("side-0", "shoulder", (150, 345, 360, 540)),
    ("side-v3-2", "elbow and waist", (170, 370, 450, 570)),
    ("side-v3-4", "knee and ankle", (185, 465, 420, 690)),
    ("wave-2", "raised arm", (58, 315, 235, 470)),
)
close = Image.new("RGB", (1100, 1570), "white")
draw = ImageDraw.Draw(close)
draw.text((25, 20), "SEAM INSPECTION: ORIGINAL / MASKED EXPERIMENT", font=font(24), fill="#283658")
for row, (name, label, bounds) in enumerate(details):
    y = 65 + row * 370
    draw.text((25, y), f"{name}: {label}", font=font(19), fill="#423065")
    for column, sprite in enumerate((originals[name], edits[name])):
        crop = sprite.crop(bounds)
        factor = min(500 / crop.width, 325 / crop.height)
        crop = crop.resize((round(crop.width * factor), round(crop.height * factor)), Image.Resampling.LANCZOS)
        tile = Image.new("RGBA", (510, 325), "#f5f2fa")
        tile.alpha_composite(crop, ((510 - crop.width) // 2, (325 - crop.height) // 2))
        close.paste(tile.convert("RGB"), (25 + column * 540, y + 30))
close.save(ROOT / "seam-closeups.png")

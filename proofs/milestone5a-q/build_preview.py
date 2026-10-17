"""Prepare disposable, exact-canvas review frames and previews from outfit candidates.

The creative clothing edits are the PNGs in candidates/. This script only
registers each complete pose to its approved canvas and presents comparisons.
It does not modify production artwork or application code.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
SOURCES = REPO / "public" / "art"
PROOFS = ROOT / "candidates"
FRAMES = ROOT / "frames"
FRAMES.mkdir(parents=True, exist_ok=True)
ORDER = [
    ("0", "front-idle"),
    ("side-0", "side-idle"),
    ("side-v3-1", "walk-contact"),
    ("side-v3-2", "walk-passing-1"),
    ("side-v3-3", "walk-contact-2"),
    ("side-v3-4", "walk-passing-2"),
    ("wave-1", "wave-1"),
    ("wave-2", "wave"),
    ("wave-3", "wave-3"),
]
FONT_PATH = Path("C:/Windows/Fonts/segoeui.ttf")
BOLD_PATH = Path("C:/Windows/Fonts/segoeuib.ttf")


def font(size, bold=False):
    path = BOLD_PATH if bold else FONT_PATH
    return ImageFont.truetype(path, size) if path.exists() else ImageFont.load_default()


def fit_frame(original: Image.Image, candidate: Image.Image) -> Image.Image:
    target = original.getchannel("A").getbbox()
    source = candidate.getchannel("A").getbbox()
    if not target or not source:
        raise ValueError("A source or candidate has no visible pixels")
    figure = candidate.crop(source)
    factor = (target[3] - target[1]) / figure.height
    resized = figure.resize((round(figure.width * factor), target[3] - target[1]), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", original.size, (0, 0, 0, 0))
    x = round((target[0] + target[2] - resized.width) / 2)
    y = target[3] - resized.height
    out.alpha_composite(resized, (x, y))
    return out


def panel(image: Image.Image, width=490, height=260):
    image = image.copy()
    image.thumbnail((width - 20, height - 20), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (width, height), "#f4f6fb")
    out.alpha_composite(image, ((width - image.width) // 2, height - image.height - 10))
    return out.convert("RGB")


originals = {}
edits = {}
for suffix, candidate_name in ORDER:
    original = Image.open(SOURCES / f"max-{suffix}.png").convert("RGBA")
    candidate = Image.open(PROOFS / f"{candidate_name}-candidate.png").convert("RGBA")
    fitted = fit_frame(original, candidate)
    fitted.save(FRAMES / f"max-{suffix}.png")
    originals[suffix] = original
    edits[suffix] = fitted

sheet = Image.new("RGB", (1060, 2630), "#ffffff")
draw = ImageDraw.Draw(sheet)
draw.text((24, 20), "MAX OUTFIT — ALL NINE RUNTIME FRAMES", font=font(26, True), fill="#24385f")
draw.text((24, 57), "Left: approved original   Right: normalized candidate — still not production-ready", font=font(17), fill="#665d77")
for row, (suffix, _) in enumerate(ORDER):
    y = 95 + row * 280
    draw.text((25, y), suffix, font=font(19, True), fill="#44326e")
    sheet.paste(panel(originals[suffix]), (25, y + 26))
    sheet.paste(panel(edits[suffix]), (545, y + 26))
    draw.text((30, y + 260), "Approved", font=font(14), fill="#45405c")
    draw.text((550, y + 260), "Outfit candidate", font=font(14), fill="#45405c")
sheet.save(ROOT / "all-nine-contact-sheet.png")


def stage(base: Image.Image, sprite: Image.Image, x: int, baseline: int, width: int, height: int = 355):
    scaled = sprite.resize((width, height), Image.Resampling.LANCZOS)
    base.alpha_composite(scaled, (x - width // 2, baseline - height))


def backdrop(title, size):
    canvas = Image.new("RGBA", size, "#f7f4fc")
    d = ImageDraw.Draw(canvas)
    d.rectangle((0, size[1] - 58, size[0], size[1]), fill="#e4d8ed")
    d.line((20, size[1] - 57, size[0] - 20, size[1] - 57), fill="#b897ca", width=3)
    d.text((22, 15), title, font=font(19, True), fill="#463470")
    return canvas


# Match the existing 235 px/s speed and one pose per 29 px of distance.
# 29 / 235 seconds is about 123 ms. The turn lasts 110 ms.
walk_frames = []
walk_durations = []
for index in range(16):
    canvas = backdrop("Walking preview — approved above / outfit candidate below", (900, 830))
    if index == 0:
        suffix, x, duration = "0", 95, 320
    elif index == 1:
        suffix, x, duration = "side-0", 95, 110
    elif index <= 13:
        step = index - 2
        suffix = f"side-v3-{step % 4 + 1}"
        x, duration = 95 + step * 29, 123
    elif index == 14:
        suffix, x, duration = "side-0", 95 + 12 * 29, 110
    else:
        suffix, x, duration = "0", 95 + 12 * 29, 750
    stage(canvas, originals[suffix], x + 100, 390, 213 if suffix in ("0", "side-0") else 239)
    stage(canvas, edits[suffix], x + 100, 780, 213 if suffix in ("0", "side-0") else 239)
    walk_frames.append(canvas.convert("RGB"))
    walk_durations.append(duration)
walk_frames[0].save(ROOT / "walking-preview.gif", save_all=True, append_images=walk_frames[1:], duration=walk_durations, loop=0, optimize=False)

# The runtime wave sequence is [idle, 1, 2, 3, 2, 3, 2, 1, idle],
# holding each state for 180 ms.
wave_frames = []
for state in (0, 1, 2, 3, 2, 3, 2, 1, 0):
    suffix = "0" if state == 0 else f"wave-{state}"
    width = 213 if state == 0 else 245
    canvas = backdrop("Wave preview — approved left / outfit candidate right", (760, 450))
    stage(canvas, originals[suffix], 210, 405, width)
    stage(canvas, edits[suffix], 550, 405, width)
    wave_frames.append(canvas.convert("RGB"))
wave_frames[0].save(ROOT / "waving-preview.gif", save_all=True, append_images=wave_frames[1:], duration=[180] * len(wave_frames), loop=0, optimize=False)

details = [
    ("side-0", "Shoulder and sleeve", (170, 340, 360, 540)),
    ("side-v3-3", "Waist and elbows", (110, 390, 430, 590)),
    ("side-v3-4", "Knees and ankles", (120, 480, 460, 710)),
    ("wave-1", "Raised elbow", (35, 330, 290, 550)),
]
close = Image.new("RGB", (1100, 1510), "#ffffff")
d = ImageDraw.Draw(close)
d.text((24, 18), "OUTFIT SEAM CLOSE-UPS — same original pixel coordinates", font=font(24, True), fill="#24385f")
for row, (suffix, label, region) in enumerate(details):
    y = 68 + row * 360
    d.text((24, y), f"{suffix}: {label}", font=font(20, True), fill="#44326e")
    for column, image in enumerate((originals[suffix], edits[suffix])):
        crop = image.crop(region)
        factor = min(500 / crop.width, 310 / crop.height)
        crop = crop.resize((round(crop.width * factor), round(crop.height * factor)), Image.Resampling.LANCZOS)
        block = Image.new("RGBA", (510, 310), "#f4f6fb")
        block.alpha_composite(crop, ((510 - crop.width) // 2, (310 - crop.height) // 2))
        close.paste(block.convert("RGB"), (24 + column * 540, y + 33))
close.save(ROOT / "seam-closeups.png")

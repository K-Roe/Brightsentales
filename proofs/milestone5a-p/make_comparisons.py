"""Arrange existing approved and experimental PNGs for visual review only."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
PAIRS = [
    ("Front idle", REPO / "public/art/max-0.png", ROOT / "front-idle-candidate.png"),
    ("Walking contact", REPO / "public/art/max-side-v3-1.png", ROOT / "walk-contact-candidate.png"),
    ("Wave", REPO / "public/art/max-wave-2.png", ROOT / "wave-candidate.png"),
]
REGIONS = {
    "Shoulders": (0.12, 0.46, 0.88, 0.68),
    "Elbows / sleeves": (0.05, 0.57, 0.95, 0.77),
    "Waist": (0.12, 0.68, 0.88, 0.82),
    "Legs / shoes": (0.08, 0.76, 0.92, 1.00),
}
FONT_PATH = Path("C:/Windows/Fonts/segoeui.ttf")
BOLD_PATH = Path("C:/Windows/Fonts/segoeuib.ttf")


def font(size: int, bold: bool = False):
    path = BOLD_PATH if bold else FONT_PATH
    return ImageFont.truetype(path, size) if path.exists() else ImageFont.load_default()


def checker(size):
    image = Image.new("RGB", size, "#f3f6fb")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], 24):
        for x in range(0, size[0], 24):
            if (x // 24 + y // 24) % 2:
                draw.rectangle((x, y, x + 23, y + 23), fill="#e8edf5")
    return image


def silhouette(image):
    bbox = image.getchannel("A").getbbox()
    return image.crop(bbox) if bbox else image


def frame(image, size):
    image = silhouette(image)
    image.thumbnail((size[0] - 24, size[1] - 24), Image.Resampling.LANCZOS)
    background = checker(size).convert("RGBA")
    background.alpha_composite(image, ((size[0] - image.width) // 2, size[1] - image.height - 12))
    return background.convert("RGB")


sheet = Image.new("RGB", (1160, 1710), "#ffffff")
draw = ImageDraw.Draw(sheet)
draw.text((30, 24), "MILESTONE 5A-P  |  OUTFIT ARTWORK REVIEW", font=font(29, True), fill="#20355b")
draw.text((30, 66), "Experimental edits only. Compare identity, scale, pose and seams before any application use.", font=font(18), fill="#665d77")
for row, (name, original_path, candidate_path) in enumerate(PAIRS):
    y = 110 + row * 520
    draw.rounded_rectangle((20, y, 1140, y + 500), radius=18, fill="#faf8ff", outline="#e5dcf0", width=2)
    draw.text((45, y + 15), name, font=font(25, True), fill="#392c67")
    for column, (label, path) in enumerate((("Approved original", original_path), ("New outfit candidate", candidate_path))):
        x = 45 + column * 555
        sheet.paste(frame(Image.open(path).convert("RGBA"), (520, 420)), (x, y + 54))
        draw.text((x + 8, y + 469), label, font=font(18, True), fill="#46405b")
sheet.save(ROOT / "side-by-side.png")

for name, original_path, candidate_path in PAIRS:
    detail = Image.new("RGB", (1230, 1470), "#ffffff")
    d = ImageDraw.Draw(detail)
    d.text((25, 20), f"{name.upper()}  |  SEAM INSPECTION", font=font(27, True), fill="#20355b")
    d.text((25, 60), "Crops use equivalent fractions of each figure, then enlarge independently.", font=font(17), fill="#665d77")
    images = [silhouette(Image.open(path).convert("RGBA")) for path in (original_path, candidate_path)]
    for row, (region, bounds) in enumerate(REGIONS.items()):
        y = 105 + row * 340
        d.text((25, y), region, font=font(21, True), fill="#392c67")
        for column, image in enumerate(images):
            x = 25 + column * 605
            crop = image.crop(tuple(round(value * dimension) for value, dimension in zip(bounds, (image.width, image.height, image.width, image.height))))
            detail.paste(frame(crop, (580, 285)), (x, y + 35))
            d.text((x + 5, y + 322), "Approved original" if column == 0 else "New outfit candidate", font=font(16), fill="#46405b")
    detail.save(ROOT / f"{name.lower().replace(' ', '-')}-closeups.png")

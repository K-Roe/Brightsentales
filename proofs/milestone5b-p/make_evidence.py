"""Create comparison images from the original and the offline candidate."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
original = Image.open(root.parent.parent / 'public/art/maxine-0.png').convert('RGBA')
candidate = Image.open(root / 'maxine-front-tshirt-leggings-experiment.png').convert('RGBA')

sheet = Image.new('RGB', (920, 805), '#f2f4fb')
draw = ImageDraw.Draw(sheet)
draw.text((32, 22), 'APPROVED ORIGINAL', fill='#23264f')
draw.text((492, 22), 'EXPERIMENTAL OUTFIT', fill='#23264f')
for image, x in ((original, 18), (candidate, 478)):
    backdrop = Image.new('RGBA', image.size, '#eef6fb')
    backdrop.alpha_composite(image)
    sheet.paste(backdrop.convert('RGB'), (x, 55))
sheet.save(root / 'original-vs-candidate.png')

editor = Image.new('RGBA', (300, 425), '#edf2fc')
sprite = candidate.resize((213, 355), Image.Resampling.LANCZOS)
editor.alpha_composite(sprite, ((300 - 213) // 2, 18))
ImageDraw.Draw(editor).text((74, 385), 'Normal editor scale', fill='#23264f')
editor.convert('RGB').save(root / 'candidate-editor-scale.png')

crops = [
    ('Collar', (125, 380, 310, 450)),
    ('Sleeves / hands', (50, 420, 375, 545)),
    ('Waist', (115, 475, 315, 565)),
    ('Ankles', (105, 550, 325, 680)),
]
close = Image.new('RGB', (1200, 1880), '#f2f4fb')
draw = ImageDraw.Draw(close)
for row, (label, box) in enumerate(crops):
    top = row * 470
    draw.text((20, top + 8), f'{label}: original', fill='#23264f')
    draw.text((620, top + 8), f'{label}: candidate', fill='#23264f')
    for image, x in ((original, 20), (candidate, 620)):
        part = image.crop(box)
        scale = min(580 / part.width, 420 / part.height)
        part = part.resize((round(part.width * scale), round(part.height * scale)), Image.Resampling.NEAREST)
        backdrop = Image.new('RGBA', part.size, '#eef6fb')
        backdrop.alpha_composite(part)
        close.paste(backdrop.convert('RGB'), (x, top + 35))
close.save(root / 'seam-closeups.png')

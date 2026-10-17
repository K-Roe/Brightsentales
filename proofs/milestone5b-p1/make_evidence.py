from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
before = Image.open(root.parent / 'milestone5b-p/maxine-front-tshirt-leggings-experiment.png').convert('RGBA')
after = Image.open(root / 'maxine-front-tshirt-leggings-cleaned.png').convert('RGBA')

comparison = Image.new('RGB', (920, 805), '#f2f4fb')
draw = ImageDraw.Draw(comparison)
for title, sprite, x in [('5B-P candidate', before, 18), ('5B-P.1 cleanup', after, 478)]:
    draw.text((x + 12, 20), title, fill='#23264f')
    panel = Image.new('RGBA', sprite.size, '#eef6fb')
    panel.alpha_composite(sprite)
    comparison.paste(panel.convert('RGB'), (x, 55))
comparison.save(root / 'before-after-native-scale.png')

editor = Image.new('RGBA', (300, 425), '#edf2fc')
editor.alpha_composite(after.resize((213, 355), Image.Resampling.LANCZOS), (43, 18))
ImageDraw.Draw(editor).text((75, 385), 'Normal editor scale', fill='#23264f')
editor.convert('RGB').save(root / 'cleaned-editor-scale.png')

crops = [
    ('Collar and neck', (125, 380, 310, 448)),
    ('Lower hair edges', (56, 350, 405, 445)),
    ('Hands and wrists', (50, 435, 375, 545)),
    ('Leggings and ankles', (105, 545, 325, 675)),
]
sheet = Image.new('RGB', (1200, 1880), '#f2f4fb')
draw = ImageDraw.Draw(sheet)
for row, (label, box) in enumerate(crops):
    top = row * 470
    draw.text((20, top + 8), f'{label}: before', fill='#23264f')
    draw.text((620, top + 8), f'{label}: after', fill='#23264f')
    for sprite, x in [(before, 20), (after, 620)]:
        part = sprite.crop(box)
        scale = min(580 / part.width, 420 / part.height)
        part = part.resize((round(part.width * scale), round(part.height * scale)), Image.Resampling.NEAREST)
        panel = Image.new('RGBA', part.size, '#eef6fb')
        panel.alpha_composite(part)
        sheet.paste(panel.convert('RGB'), (x, top + 35))
sheet.save(root / 'seam-closeups-before-after.png')

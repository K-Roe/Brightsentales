"""Offline single-pose experiment. Never writes to production artwork."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
original = Image.open(ROOT.parent.parent / 'public/art/maxine-0.png').convert('RGBA')
draft = Image.open(ROOT / 'generated-draft-reference.png').convert('RGBA').resize(original.size, Image.Resampling.LANCZOS)
w, h = original.size

# Compress the generated clothing area vertically to put its shoe/leg boundary
# at Maxine's original shoe tops. The head is replaced with source pixels below.
warped = Image.new('RGBA', original.size)
for y in range(390, 590):
    source_y = int(390 + (y - 390) * (608 - 390) / (590 - 390))
    warped.paste(draft.crop((0, source_y, w, source_y + 1)), (0, y))

# Replace the whole flattened hoodie/skirt region, including transparent areas.
candidate = original.copy()
candidate.paste(warped.crop((0, 390, w, 590)), (0, 390))

# Use the approved source head/face and ponytail wherever it can overhang the
# new shirt. Use soft masks only at the lower edge to avoid a straight cut.
protect = Image.new('L', original.size)
draw = ImageDraw.Draw(protect)
draw.rectangle((0, 0, w, 390), fill=255)
for y in range(391, 435):
    for x in range(w):
        r, g, b, a = original.getpixel((x, y))
        hair = (x < 145 or x > 285) and b > 55 and b > g * 1.15 and r < 205 and a > 0
        face_or_neck = 150 < x < 280 and y < 410 and r > 150 and r > g * 1.45 and a > 0
        if hair or face_or_neck:
            protect.putpixel((x, y), a)

# Preserve the exact approved hands and original trainers, including outlines.
draw.ellipse((54, 491, 112, 538), fill=255)
draw.ellipse((305, 491, 362, 538), fill=255)
draw.rectangle((0, 590, w, h), fill=255)
candidate = Image.composite(original, candidate, protect)
candidate.save(ROOT / 'maxine-front-tshirt-leggings-experiment.png')
protect.save(ROOT / 'protected-source-regions.png')

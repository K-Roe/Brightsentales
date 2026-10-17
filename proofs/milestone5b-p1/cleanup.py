"""Targeted cleanup of the approved 5B-P single-pose candidate only."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
repo = root.parent.parent
before = Image.open(repo / 'proofs/milestone5b-p/maxine-front-tshirt-leggings-experiment.png').convert('RGBA')
original = Image.open(repo / 'public/art/maxine-0.png').convert('RGBA')
draft = Image.open(repo / 'proofs/milestone5b-p/generated-draft-reference.png').convert('RGBA').resize(before.size, Image.Resampling.LANCZOS)
after = before.copy()

changes = {'collar_and_lower_hair': 0, 'wrists': 0, 'ankles': 0}

def replacement(x: int, y: int) -> tuple[int, int, int, int]:
    source_y = int(390 + (y - 390) * (608 - 390) / (590 - 390))
    return draft.getpixel((x, source_y))

def original_skin_near(x: int, y: int) -> bool:
    for yy in range(max(390, y - 2), min(411, y + 3)):
        for xx in range(max(130, x - 2), min(301, x + 3)):
            r, g, b, a = original.getpixel((xx, yy))
            if a > 150 and r > 145 and r > g * 1.43 and g > 35 and b > 60:
                return True
    return False

for y in range(390, 426):
    for x in range(130, 301):
        r, g, b, a = original.getpixel((x, y))
        exact_skin = y <= 398 and a > 150 and r > 145 and r > g * 1.43 and g > 35 and b > 60
        chin_outline = y <= 398 and original_skin_near(x, y) and a > 0
        if exact_skin or chin_outline:
            pixel = original.getpixel((x, y))  # approved chin and its outline
        else:
            pixel = replacement(x, y)  # clean collar and air gap, same draft as 5B-P
        if pixel != before.getpixel((x, y)):
            after.putpixel((x, y), pixel)
            changes['collar_and_lower_hair'] += 1

# The outer tips of the lower ponytail sit clear of the new top. Restore
# their approved pixels and edge alpha directly from the original sprite.
# These narrow regions contain hair and transparent canvas, not old clothing.
for left, top, right, bottom in ((50, 370, 109, 418), (334, 370, 397, 425)):
    for y in range(top, bottom):
        for x in range(left, right):
            pixel = original.getpixel((x, y))
            if pixel != after.getpixel((x, y)):
                after.putpixel((x, y), pixel)
                changes['lower_hair'] = changes.get('lower_hair', 0) + 1

# Clear only near-transparent neutral fringe pixels around the lower hair,
# wrists and trouser hems. These are pale antialias remnants, not painted parts.
regions = {
    'lower_hair': [(50, 390, 155, 440), (275, 390, 400, 440)],
    'wrists': [(50, 470, 125, 545), (290, 470, 370, 545)],
    'ankles': [(115, 570, 205, 590), (225, 570, 315, 590)],
}
for region, boxes in regions.items():
    for left, top, right, bottom in boxes:
        for y in range(top, bottom):
            for x in range(left, right):
                r, g, b, a = after.getpixel((x, y))
                if 0 < a < 26 and r > 185 and g > 160 and b > 145:
                    after.putpixel((x, y), (0, 0, 0, 0))
                    changes[region] = changes.get(region, 0) + 1

# Keep the original hand contours and every trainer pixel. Repainting them
# would alter approved anatomy and footwear.
after.save(root / 'maxine-front-tshirt-leggings-cleaned.png')
print(changes)

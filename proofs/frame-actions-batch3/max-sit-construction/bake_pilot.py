"""Disposable deterministic Max sit construction pilot; never writes approved art.

All head, face, hair, hoodie, hands and shorts pixels come from approved max-0.png.
Only the bent leg connectors are newly drawn. Output is proof, not app artwork.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SOURCE = Image.open(ROOT / 'public/art/max-0.png').convert('RGBA')
CHAIR = Image.open(ROOT / 'proofs/frame-actions-batch3/repair-candidates/wide-chair-pilot.png').convert('RGBA')


def smooth(value):
    return value * value * (3 - 2 * value)


def frame(progress):
    if progress == 0:
        return SOURCE.copy()
    t = smooth(progress)
    drop = round(63 * t)
    image = Image.new('RGBA', SOURCE.size)
    legs = Image.new('RGBA', SOURCE.size)
    pen = ImageDraw.Draw(legs)
    for mirrored in (False, True):
        def shape(points):
            return [(434 - x if mirrored else x, y) for x, y in points]
        # Dark approved-outline colour and a leg shape that bends at the knee.
        hip = (156 - 4 * t, 553 + drop)
        knee = (147 - 23 * t, 615 + 5 * t)
        ankle = (148 - 10 * t, 638)
        outline = shape([
            (hip[0] - 24, hip[1] - 3), (hip[0] + 28, hip[1] - 3),
            (knee[0] + 28, knee[1]), (ankle[0] + 23, ankle[1]),
            (ankle[0] - 24, ankle[1]), (knee[0] - 27, knee[1]),
        ])
        inner = shape([
            (hip[0] - 20, hip[1]), (hip[0] + 24, hip[1]),
            (knee[0] + 23, knee[1]), (ankle[0] + 19, ankle[1] - 3),
            (ankle[0] - 19, ankle[1] - 3), (knee[0] - 23, knee[1]),
        ])
        pen.polygon(outline, fill=(3, 28, 60, 255))
        pen.polygon(inner, fill=(20, 203, 190, 255))
        pen.line(shape([(hip[0] - 14, hip[1] + 7), (knee[0] - 17, knee[1] - 11), (ankle[0] - 16, ankle[1] - 8)]), fill=(77, 229, 210, 220), width=5, joint='curve')
    image.alpha_composite(legs)
    # Preserve the exact shoe/toe pixels at the floor line.
    shoes = Image.new('RGBA', SOURCE.size)
    shoe_mask = Image.new('L', SOURCE.size)
    mask_pen = ImageDraw.Draw(shoe_mask)
    mask_pen.polygon([(49, 626), (125, 594), (189, 597), (207, 702), (50, 709)], fill=255)
    mask_pen.polygon([(224, 595), (298, 585), (380, 626), (388, 707), (222, 707)], fill=255)
    shoes.paste(SOURCE, (0, 0), shoe_mask)
    image.alpha_composite(shoes)
    upper = Image.new('RGBA', SOURCE.size)
    upper_mask = Image.new('L', SOURCE.size)
    mask_pen = ImageDraw.Draw(upper_mask)
    mask_pen.rectangle((0, 0, 434, 562), fill=255)
    # Include the original shorts hems while removing the straight shins.
    mask_pen.polygon([(113, 552), (310, 552), (308, 574), (260, 579), (215, 565), (174, 579), (115, 575)], fill=255)
    upper.paste(SOURCE, (0, 0), upper_mask)
    image.alpha_composite(upper, (0, drop))
    return image


OUT.mkdir(exist_ok=True)
swatches = Image.new('RGB', (5 * 320, 460), '#f7f2ff')
pen = ImageDraw.Draw(swatches)
for index, progress in enumerate((0, .2, .4, .7, 1)):
    sprite = frame(progress)
    sprite.save(OUT / f'max-sit-pilot-{index:02d}.png')
    cell = Image.new('RGBA', (320, 410), '#f7f2ff')
    chair = CHAIR.resize((220, 172), Image.Resampling.LANCZOS)
    cell.alpha_composite(chair, (50, 219))
    cell.alpha_composite(sprite.resize((213, 355), Image.Resampling.LANCZOS), (53, 31))
    swatches.paste(cell.convert('RGB'), (index * 320, 0))
    pen.text((index * 320 + 110, 423), f'{progress:.1f}', fill='#281847')
swatches.save(OUT / 'deterministic-contact.png')

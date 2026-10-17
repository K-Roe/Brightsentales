"""One-pose, original-pixel wardrobe feasibility experiment.

Only public/art/max-0.png is used as artwork input. The script edits bounded
clothing regions and never redraws or repositions the full character.
"""

from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
SOURCE = REPO / "public" / "art" / "max-0.png"
original = Image.open(SOURCE).convert("RGBA")
output = original.copy()
src = original.load()
dst = output.load()
w, h = original.size
allowed = Image.new("L", original.size)
permit = allowed.load()


def purple(r, g, b, a):
    return a > 24 and r > g * 1.2 and b > g * 1.25 and b > r * .95 and r > 55


def skin(r, g, b, a):
    return a > 24 and g > r * 1.25 and b > r * 1.18 and g > 75 and g >= b * .8


def set_pixel(x, y, value):
    if 0 <= x < w and 0 <= y < h:
        dst[x, y] = value
        permit[x, y] = 255


def shirt_colour(x, y):
    # Purple sampled from the original chest on either side of the star.
    left = src[160, min(495, max(401, y))]
    right = src[277, min(495, max(401, y))]
    fraction = min(1, max(0, (x - 160) / 117))
    return tuple(round(left[i] * (1 - fraction) + right[i] * fraction) for i in range(3)) + (255,)


# Replace the star and hoodie strings with sampled, shaded source purple.
# The colour-only seed catches yellow, white and their edge antialiasing;
# the explicit chest bounds prevent touching the eyes or trainers.
star_seed = Image.new("L", original.size)
seed = star_seed.load()
for y in range(388, 495):
    for x in range(175, 268):
        r, g, b, a = src[x, y]
        yellow = r > 125 and g > 83 and b < g * .9
        white_string = r > 125 and g > 120 and b > 115 and abs(r - g) < 45
        if a > 30 and (yellow or white_string):
            seed[x, y] = 255
star_seed = star_seed.filter(ImageFilter.MaxFilter(9))
for y in range(388, 495):
    for x in range(175, 268):
        if star_seed.getpixel((x, y)):
            set_pixel(x, y, shirt_colour(x, y))

# Cover the remaining front hoodie drawstrings and original V insert with a
# restrained round-neck T-shirt collar. Work only below the approved chin.
neck = Image.new("RGBA", original.size)
draw = ImageDraw.Draw(neck)
draw.ellipse((188, 365, 247, 403), fill=(35, 24, 77, 255))
draw.ellipse((193, 362, 242, 396), fill=(64, 200, 184, 255))
draw.ellipse((190, 370, 245, 406), fill=(92, 47, 177, 255))
for y in range(375, 405):
    for x in range(184, 251):
        if neck.getpixel((x, y))[3] and src[x, y][3] > 0:
            set_pixel(x, y, neck.getpixel((x, y)))

# Change only the lower sections of the existing long sleeves into exposed
# skin. The old silhouette and hand positions are retained, including shading
# inherited from the source sleeve. Upper sleeve edges remain original purple.
for left, right in ((75, 141), (295, 359)):
    for y in range(450, 513):
        for x in range(left, right):
            r, g, b, a = src[x, y]
            if not purple(r, g, b, a):
                continue
            # Retain the source's light/dark variation while shifting hue to
            # the same turquoise range as Max's original exposed skin.
            light = (r + g + b) / 3
            delta = max(-35, min(28, (light - 115) * .36))
            set_pixel(x, y, (round(54 + delta * .7), round(208 + delta), round(191 + delta * .8), a))

# New short-sleeve hems, deliberately drawn within the original sleeve area.
hem = Image.new("RGBA", original.size)
draw = ImageDraw.Draw(hem)
draw.line(((83, 454), (99, 460), (118, 462), (137, 456)), fill=(26, 20, 69, 255), width=4)
draw.line(((298, 456), (316, 462), (336, 460), (352, 454)), fill=(26, 20, 69, 255), width=4)
for y in range(450, 467):
    for x in list(range(76, 142)) + list(range(294, 359)):
        pixel = hem.getpixel((x, y))
        if pixel[3] and src[x, y][3] > 0:
            set_pixel(x, y, pixel)

# Extend the original dark shorts colour down each *original* leg contour.
# This preserves the exact stance and trainers rather than borrowing shifted
# legs from another generated frame.
for left, right in ((113, 207), (226, 323)):
    for y in range(548, 627):
        for x in range(left, right):
            r, g, b, a = src[x, y]
            if not skin(r, g, b, a):
                continue
            light = (r + g + b) / 3
            delta = max(-18, min(22, (light - 135) * .28))
            set_pixel(x, y, (round(44 + delta * .7), round(61 + delta), round(91 + delta * 1.1), a))

output.save(ROOT / "max-front-idle-tshirt-trousers.png")
allowed.save(ROOT / "allowed-change-mask.png")

comparison = Image.new("RGB", (960, 850), "#fbf9fd")
text = ImageDraw.Draw(comparison)
text.text((28, 20), "MAX FRONT IDLE - ONE-POSE OUTFIT TEST", fill="#28365c")
text.text((133, 55), "Approved original", fill="#46376c")
text.text((603, 55), "Experimental edit", fill="#46376c")
for x, image in ((26, original), (500, output)):
    panel = Image.new("RGBA", (434, 724), "#f3eef9")
    panel.alpha_composite(image)
    comparison.paste(panel.convert("RGB"), (x, 88))
comparison.save(ROOT / "original-vs-candidate.png")

regions = (
    ("collar and shoulders", (75, 345, 365, 475)),
    ("sleeves and hands", (50, 430, 375, 555)),
    ("waist", (105, 480, 325, 580)),
    ("trousers and ankles", (95, 535, 340, 650)),
)
close = Image.new("RGB", (1100, 1380), "white")
draw = ImageDraw.Draw(close)
draw.text((24, 18), "SEAM CLOSE-UPS - ORIGINAL / EXPERIMENT", fill="#28365c")
for index, (label, box) in enumerate(regions):
    y = 55 + index * 325
    draw.text((24, y), label, fill="#46376c")
    for column, image in enumerate((original, output)):
        crop = image.crop(box)
        scale = min(510 / crop.width, 285 / crop.height)
        crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
        panel = Image.new("RGBA", (515, 285), "#f3eef9")
        panel.alpha_composite(crop, ((515 - crop.width) // 2, (285 - crop.height) // 2))
        close.paste(panel.convert("RGB"), (24 + column * 540, y + 25))
close.save(ROOT / "seam-closeups.png")

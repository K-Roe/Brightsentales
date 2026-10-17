"""Experimental, pixel-protected edits of Max's nine approved sprites.

The 5A-Q outfit candidates supply only the T-shirt, exposed arms and trousers.
Original facial detail, hair, hands, tail and trainers are copied pixel-for-pixel.
No production assets are written.
"""

from collections import deque
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
ORIGINALS = REPO / "public" / "art"
OUTFITS = REPO / "proofs" / "milestone5a-q" / "frames"
FRAMES = ROOT / "frames"
MASKS = ROOT / "masks"
FRAMES.mkdir(parents=True, exist_ok=True)
MASKS.mkdir(parents=True, exist_ok=True)
NAMES = ("0", "side-0", "side-v3-1", "side-v3-2", "side-v3-3", "side-v3-4", "wave-1", "wave-2", "wave-3")

# Regions identify only original exposed parts. The actual protected edge is
# taken from original teal pixels and expanded to include its dark outline.
PARTS = {
    "0": ((65, 485, 145, 553), (295, 485, 370, 553)),
    "side-0": ((100, 450, 178, 545), (167, 505, 250, 571), (305, 508, 332, 557)),
    "side-v3-1": ((60, 432, 130, 530), (106, 465, 185, 543), (355, 420, 425, 495)),
    "side-v3-2": ((130, 425, 228, 532), (293, 471, 374, 546), (372, 419, 450, 497)),
    "side-v3-3": ((107, 427, 184, 520), (150, 464, 233, 543), (410, 396, 478, 476)),
    "side-v3-4": ((133, 431, 241, 535), (409, 414, 487, 496)),
    "wave-1": ((62, 313, 154, 416), (115, 460, 193, 543), (355, 463, 429, 547)),
    "wave-2": ((57, 226, 170, 344), (119, 460, 198, 543), (359, 464, 433, 547)),
    "wave-3": ((55, 235, 167, 358), (123, 461, 199, 544), (360, 463, 435, 547)),
}


def teal(pixel):
    r, g, b, a = pixel
    return a > 90 and g > 80 and b > 75 and g > r * 1.35 and b > r * 1.15 and g >= b * .82


def filled_edge(mask, size=9):
    mask = mask.filter(ImageFilter.MaxFilter(size))
    holes = ImageOps.invert(mask)
    ImageDraw.floodfill(holes, (0, 0), 0)
    return ImageChops.lighter(mask, holes)


def head_mask(original):
    w, h = original.size
    pixels = original.load()
    seen = bytearray(w * h)
    best = []
    for y in range(min(h, 390)):
        for x in range(w):
            offset = y * w + x
            if seen[offset] or not teal(pixels[x, y]):
                continue
            seen[offset] = 1
            queue = deque([(x, y)])
            component = []
            while queue:
                px, py = queue.popleft()
                component.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < w and 0 <= ny < min(h, 390):
                        neighbor = ny * w + nx
                        if not seen[neighbor] and teal(pixels[nx, ny]):
                            seen[neighbor] = 1
                            queue.append((nx, ny))
            if len(component) > len(best):
                best = component
    if len(best) < 30000:
        raise ValueError("Could not locate the original Max head")
    mask = Image.new("L", original.size)
    data = mask.load()
    for x, y in best:
        data[x, y] = 255
    return filled_edge(mask, 11)


def protected_parts(original, name):
    pixels = original.load()
    seed = Image.new("L", original.size)
    output = seed.load()
    for left, top, right, bottom in PARTS[name]:
        for y in range(top, bottom):
            for x in range(left, right):
                if teal(pixels[x, y]):
                    output[x, y] = 255
    return seed.filter(ImageFilter.MaxFilter(11))


def trainers(original):
    pixels = original.load()
    w, h = original.size
    seed = Image.new("L", original.size)
    output = seed.load()
    for y in range(535, h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            blue = a > 90 and b > 135 and b > g * 1.4 and b > r * 1.4
            white = a > 90 and r > 165 and g > 165 and b > 165
            if blue or white:
                output[x, y] = 255
    return seed.filter(ImageFilter.MaxFilter(15))


for name in NAMES:
    original = Image.open(ORIGINALS / f"max-{name}.png").convert("RGBA")
    outfit = Image.open(OUTFITS / f"max-{name}.png").convert("RGBA")
    if original.size != outfit.size:
        raise ValueError(f"Canvas mismatch for {name}")

    protected = ImageChops.lighter(head_mask(original), protected_parts(original, name))
    protected = ImageChops.lighter(protected, trainers(original))
    candidate_shoes = trainers(outfit)
    outfit = Image.composite(Image.new("RGBA", original.size), outfit, candidate_shoes)
    limit = Image.new("L", original.size)
    ImageDraw.Draw(limit).rectangle((0, 345, original.width, original.height), fill=255)
    allowed = ImageChops.subtract(limit, protected)
    result = Image.composite(outfit, original, allowed)

    allowed.save(MASKS / f"max-{name}-allowed.png")
    protected.save(MASKS / f"max-{name}-protected.png")
    result.save(FRAMES / f"max-{name}.png")

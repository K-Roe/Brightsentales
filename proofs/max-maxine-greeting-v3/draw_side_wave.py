"""Hand-draw additive profile-wave studies over copies of approved side poses.

All contours are explicit illustration strokes; no front-facing parts are pasted.
The approved source PNGs are read only. Run with local Pillow.
"""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "public/art"
OUT = Path(__file__).resolve().parent / "rejected-art-study"
OUT.mkdir(parents=True, exist_ok=True)
SCALE = 4

def xy(point):
    return tuple(round(value * SCALE) for value in point)

def line(draw, points, color, width):
    coords = [xy(p) for p in points]
    draw.line(coords, fill=color, width=round(width * SCALE), joint="curve")
    radius = width * SCALE / 2
    for x, y in (coords[0], coords[-1]):
        draw.ellipse((round(x-radius), round(y-radius), round(x+radius), round(y+radius)), fill=color)

def ellipse(draw, box, fill, outline=None, width=1):
    draw.ellipse(tuple(round(v * SCALE) for v in box), fill=fill, outline=outline, width=round(width * SCALE))

SPECS = {
    "max": {
        "sleeve": "#6532af", "sleeve_shadow": "#4e228e", "skin": "#24d0cf", "light": "#5ce6d7",
        "edge": "#121127", "shoulder": (308, 386), "elbow": (368, 391),
        "wrist": (409, 248), "palm": (429, 220), "erase": (306, 505, 341, 554),
    },
    "maxine": {
        "sleeve": "#fff3df", "sleeve_shadow": "#e7d5cf", "skin": "#f68eb1", "light": "#ffc2ce",
        "edge": "#321536", "shoulder": (348, 392), "elbow": (397, 390),
        "wrist": (450, 251), "palm": (464, 222), "erase": None,
    },
}

for name, spec in SPECS.items():
    base = Image.open(ART / f"{name}-side-0.png").convert("RGBA")
    for frame, lean in enumerate((-8, 3, 10), 1):
        candidate = base.resize((500 * SCALE, 724 * SCALE), Image.Resampling.NEAREST)
        if spec["erase"]:
            # Remove the original low forward fist; the opposite resting hand remains.
            pixels = candidate.load()
            x0, y0, x1, y1 = spec["erase"]
            for y in range(y0 * SCALE, y1 * SCALE):
                for x in range(x0 * SCALE, x1 * SCALE):
                    r, g, b, a = pixels[x, y]
                    if a and g > r * 1.28 and g > b * 1.05:
                        pixels[x, y] = (0, 0, 0, 0)
        layer = Image.new("RGBA", candidate.size)
        draw = ImageDraw.Draw(layer)
        sx, sy = spec["shoulder"]
        ex, ey = spec["elbow"]
        wx, wy = spec["wrist"]
        px, py = spec["palm"]
        px += lean
        wx += lean // 3
        edge, sleeve = spec["edge"], spec["sleeve"]
        # Raised sleeve has a continuous shoulder-to-cuff silhouette, a dark
        # underside, and the same broad outline weight as the source art.
        arm = [(sx, sy), (ex, ey), (wx, wy)]
        line(draw, arm, edge, 48)
        line(draw, arm, spec["sleeve_shadow"], 41)
        line(draw, [(sx+2, sy-4), (ex+1, ey-5), (wx-3, wy-2)], sleeve, 34)
        line(draw, [(sx+3, sy-11), (ex-6, ey-15), (wx-11, wy-11)], "#ffffff55", 5)
        line(draw, [(wx, wy), (px-5, py+15)], edge, 30)
        line(draw, [(wx, wy), (px-5, py+15)], spec["skin"], 23)
        # Illustrated open hand, palm and distinct fingers. Only the wrist
        # angle changes across the three wave frames.
        ellipse(draw, (px-22, py-1, px+18, py+42), spec["skin"], edge, 5)
        finger_bases = [px-16, px-5, px+6, px+16]
        heights = [23, 29, 27, 19]
        for finger_x, height in zip(finger_bases, heights):
            line(draw, [(finger_x, py+9), (finger_x+lean/3, py-height)], edge, 12)
            line(draw, [(finger_x, py+9), (finger_x+lean/3, py-height)], spec["skin"], 7)
        line(draw, [(px-18, py+29), (px-32, py+15)], edge, 15)
        line(draw, [(px-18, py+29), (px-32, py+15)], spec["skin"], 9)
        ellipse(draw, (px-14, py+2, px+4, py+23), spec["light"])
        candidate.alpha_composite(layer)
        candidate.resize((500, 724), Image.Resampling.LANCZOS).save(OUT / f"{name}-side-wave-{frame}.png")

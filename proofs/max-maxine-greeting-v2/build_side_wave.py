"""Make additive, local side-wave studies from approved whole-body PNG copies.

This is a fixed artwork preparation step, not a runtime rig. Source sprites are read only.
"""

from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "public" / "art"
OUTPUT = ART / "provisional-actions" / "greeting-v2"
OUTPUT.mkdir(parents=True, exist_ok=True)

SPECS = {
    "max": {
        "crop_width": 210,
        "x": 310,
        "polygons": [
            [(58, 250), (75, 232), (99, 243), (113, 231), (137, 245), (150, 275), (155, 307), (145, 329), (169, 345), (188, 368), (181, 394), (154, 414), (116, 409), (95, 380), (89, 345), (68, 321)],
            [(58, 230), (80, 219), (95, 240), (116, 221), (137, 231), (159, 263), (161, 304), (148, 325), (164, 340), (183, 367), (179, 398), (154, 415), (115, 404), (93, 375), (86, 341), (66, 316)],
            [(60, 248), (80, 234), (98, 243), (117, 235), (142, 250), (157, 284), (158, 311), (149, 332), (170, 345), (189, 370), (181, 397), (155, 418), (113, 407), (94, 378), (89, 344), (69, 321)],
        ],
    },
    "maxine": {
        "crop_width": 225,
        "x": 300,
        "polygons": [
            [(36, 280), (52, 266), (68, 279), (81, 263), (100, 273), (113, 302), (116, 322), (135, 341), (173, 368), (195, 399), (191, 433), (162, 445), (121, 421), (89, 383), (76, 345), (48, 321)],
            [(34, 243), (49, 226), (67, 232), (80, 218), (98, 227), (111, 255), (116, 303), (128, 331), (165, 356), (191, 393), (190, 425), (162, 443), (119, 417), (87, 378), (72, 336), (44, 307)],
            [(39, 255), (54, 240), (69, 249), (84, 239), (101, 251), (114, 281), (119, 316), (136, 340), (169, 363), (193, 396), (191, 429), (160, 444), (121, 418), (88, 378), (73, 341), (47, 314)],
        ],
    },
}

for character, spec in SPECS.items():
    base = Image.open(ART / f"{character}-side-0.png").convert("RGBA")
    for frame, polygon in enumerate(spec["polygons"], 1):
        wave = Image.open(ART / f"{character}-wave-{frame}.png").convert("RGBA")
        mask = Image.new("L", wave.size)
        ImageDraw.Draw(mask).polygon(polygon, fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(0.7))
        wave.putalpha(ImageChops.multiply(wave.getchannel("A"), mask))
        arm = wave.crop((0, 0, spec["crop_width"], wave.height)).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        candidate = base.copy()
        candidate.alpha_composite(arm, (spec["x"], 0))
        candidate.save(OUTPUT / f"{character}-side-wave-{frame}.png")

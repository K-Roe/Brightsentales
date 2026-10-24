"""Build Max-only experimental standing layers from approved source pixels.

No production asset is written. Hidden underpaint is deliberately limited to
areas concealed by the neutral composite and requires Karl's visual review.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/art/max-0.png"
APPROVED_SHA256 = "7d1c4a26bebdabd85b2114b8ca61df4e5f83302ab21aa8c895f5438d75a98d24"
OLD_HEAD = ROOT / "public/art/rig/max/head.png"
OUT = ROOT / "public/art/experimental/max-living-v1"
OUT.mkdir(parents=True, exist_ok=True)
source_bytes = SOURCE.read_bytes()
if hashlib.sha256(source_bytes).hexdigest() != APPROVED_SHA256:
    raise SystemExit("Approved Max source changed; experimental layers need fresh visual review.")
source = np.array(Image.open(SOURCE).convert("RGBA"))
height, width = source.shape[:2]
alpha = source[:, :, 3] > 0
y, x = np.indices((height, width))


def polygon(points):
    image = Image.new("L", (width, height))
    ImageDraw.Draw(image).polygon(points, fill=255)
    return np.asarray(image) > 0


# Existing head extraction missed eyes/mouth/hair interior. All approved pixels
# above row 350 belong to the head. Below it, its old anatomical silhouette
# reliably separates face/neck from hood and sleeves.
old_head = np.asarray(Image.open(OLD_HEAD).convert("RGBA"))[:, :, 3] > 0
head = alpha & ((y < 350) | (old_head & (y < 390)))
# Opaque overlap lets the torso move slightly while the shorts/legs stay still.
# Semi-transparent source pixels are owned by one layer to preserve neutral art.
upper = alpha & (y < 575) & ~head
lower = alpha & (y >= 562) & ~head & ((y >= 575) | (source[:, :, 3] == 255))

# The chest patch stays inside the hoodie. Arm caps and hands remain with the
# upper silhouette for V1; their own future pivots are registered in rig.json.
chest_outline = polygon([(157, 390), (180, 387), (260, 386), (291, 395),
                         (303, 425), (299, 483), (292, 510), (269, 521),
                         (169, 522), (145, 507), (138, 473), (142, 426)])
chest = upper & chest_outline
upper &= ~chest


def save_part(name, mask):
    rgba = np.zeros_like(source)
    rgba[mask] = source[mask]
    Image.fromarray(rgba, "RGBA").save(OUT / f"{name}.png")
    return int(mask.sum())


counts = {name: save_part(name, mask) for name, mask in (
    ("lower", lower), ("upper", upper), ("chest", chest), ("head", head))}

# Submerged neck bridge. Its source colour follows the approved turquoise neck.
under = Image.new("RGBA", (width, height))
draw = ImageDraw.Draw(under)
draw.polygon([(163, 350), (272, 350), (267, 389), (168, 389)], fill=(7, 105, 111, 255))
draw.polygon([(177, 354), (257, 354), (253, 388), (181, 388)], fill=(12, 160, 149, 255))

# Hidden purple hoodie body behind the translating chest, drawn only under
# existing silhouette or the tiny inner seam; no approved visible pixels change.
hoodie = Image.new("RGBA", (width, height))
hood = ImageDraw.Draw(hoodie)
hood.polygon([(126, 383), (309, 382), (322, 497), (303, 526),
              (133, 526), (115, 491)], fill=(92, 38, 170, 255))
hood.polygon([(142, 398), (294, 396), (302, 483), (288, 516),
              (149, 516), (136, 483)], fill=(105, 50, 191, 255))
under = Image.alpha_composite(under, hoodie)
# Keep every antialiased approved edge exactly intact in the neutral pose.
# Underpaint exists only where a fully opaque approved pixel hides it.
under_pixels = np.array(under)
under_pixels[source[:, :, 3] != 255] = 0
under = Image.fromarray(under_pixels, "RGBA")
under.save(OUT / "hidden-fill.png")

# Extra concealed neck surface is introduced progressively only during motion.
# It is absent from the pixel-exact neutral reconstruction.
neck_back = Image.new("RGBA", (width, height))
neck_draw = ImageDraw.Draw(neck_back)
neck_draw.polygon([(168, 348), (264, 348), (264, 381), (168, 381)], fill=(5, 67, 83, 255))
neck_draw.polygon([(178, 355), (255, 355), (255, 381), (178, 381)], fill=(10, 153, 146, 255))
neck_back.save(OUT / "neck-back.png")

neutral = Image.new("RGBA", (width, height))
for name in ("hidden-fill", "lower", "upper", "chest", "head"):
    neutral = Image.alpha_composite(neutral, Image.open(OUT / f"{name}.png").convert("RGBA"))
neutral.save(OUT / "neutral-composite.png")
orig = np.asarray(Image.open(SOURCE).convert("RGBA"))
composite = np.asarray(neutral)
different = np.any(orig != composite, axis=2)
visible_different = int((different & alpha).sum())
external_different = int((different & ~alpha).sum())
alpha_different = int(np.count_nonzero(orig[:, :, 3] != composite[:, :, 3]))
manifest = {
    "version": 1,
    "character": "max",
    "approvedSource": "/art/max-0.png",
    "approvedSha256": hashlib.sha256(source_bytes).hexdigest(),
    "size": [width, height],
    "layers": ["hidden-fill", "neck-back", "lower", "upper", "chest", "head"],
    "pivots": {"neck": [217, 380], "chest": [217, 516],
               "shoulderRight": [150, 410], "shoulderLeft": [300, 410],
               "waist": [217, 562]},
    "neutralDifferingVisiblePixels": visible_different,
    "neutralDifferingExternalPixels": external_different,
    "neutralDifferingAlphaPixels": alpha_different,
    "sourcePixelCounts": counts,
}
(OUT / "rig.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
if visible_different or alpha_different:
    raise SystemExit("Neutral composite failed to reconstruct approved Max pixels.")
print(json.dumps(manifest, indent=2))

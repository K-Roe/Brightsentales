"""Experimental static seated Max artwork. Never modifies approved sprite packs.

The approved upper body is translated intact. Only the seated pelvis, legs and
shoe perspective are newly illustrated. This script produces still review art,
not animation frames or a production renderer path.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'public/art/max-0.png'
CHAIR = ROOT / 'proofs/max-rig-v1/chair-source.png'
OUT = ROOT / 'public/art/experimental/max-seated-v2'
PROOF = ROOT / 'proofs/max-seated-v2'
W, H = 434, 724
HEAD_DROP = 40
FLOOR = 684
INK = '#082443'


def new_lower_body() -> Image.Image:
    """Register the separately illustrated seated component without distortion."""
    authored = Image.open(OUT / 'generated-lower-source-v2.png').convert('RGBA')
    # Trim generation margins. Both axes use the same scale, preserving the
    # illustrated knee, shin and sneaker proportions.
    crop = authored.crop((306, 108, 1637, 770))
    target_width = 340
    target_height = round(crop.height * target_width / crop.width)
    if target_height != 169:
        raise ValueError(f'Unexpected seated art registration: {target_height}')
    lower = Image.new('RGBA', (W, H))
    lower.alpha_composite(crop.resize((target_width, target_height), Image.Resampling.LANCZOS), (47, FLOOR - target_height))
    return lower


def approved_upper(source: Image.Image) -> tuple[Image.Image, Image.Image]:
    pixels = np.array(source)
    yy, _ = np.indices((H, W))
    # Complete approved head, hoodie and arms. Old standing shorts/shoes are
    # excluded; the lower body above supplies actual seated anatomy.
    upper_mask = (pixels[:, :, 3] > 0) & (yy <= 525)
    # The new seated shorts are continuous with the new thighs; the approved
    # standing shorts would conceal those knee bends if overlaid here.
    approved_rig = ROOT / 'public/art/rig/max'
    hand_mask = np.zeros((H, W), dtype=bool)
    for name in ('sleeve-right.png', 'sleeve-left.png', 'hand-right.png', 'hand-left.png'):
        hand_mask |= np.array(Image.open(approved_rig / name).convert('RGBA'))[:, :, 3] > 0
    hand_mask &= pixels[:, :, 3] > 0

    def translated(mask: np.ndarray) -> Image.Image:
        part = np.zeros_like(pixels)
        part[mask] = pixels[mask]
        result = Image.new('RGBA', (W, H))
        result.alpha_composite(Image.fromarray(part, 'RGBA'), (0, HEAD_DROP))
        return result

    return translated(upper_mask), translated(hand_mask)


def chair_layers(chair: Image.Image) -> tuple[Image.Image, Image.Image, Image.Image]:
    cw, ch = chair.size
    left = Image.new('L', chair.size)
    d = ImageDraw.Draw(left)
    # These boundaries follow the visible inside contour of the armrest:
    # top roll -> inner edge -> lower front panel. Mirrored for the other side.
    path = [(0, 470), (310, 468), (398, 488), (440, 547), (438, 627),
            (360, 656), (307, 716), (220, 790), (175, 945), (0, 945)]
    d.polygon(path, fill=255)
    right = Image.new('L', chair.size)
    ImageDraw.Draw(right).polygon([(cw - x, y) for x, y in path], fill=255)
    front_mask = np.maximum(np.array(left), np.array(right)) > 0

    cushion = Image.new('L', chair.size)
    ImageDraw.Draw(cushion).polygon([(447, 611), (1009, 611), (1148, 725),
                                     (1148, 872), (309, 872), (309, 725)], fill=255)
    cushion_mask = (np.array(cushion) > 0) & ~front_mask
    rgba = np.array(chair)
    opaque = rgba[:, :, 3] > 0

    def layer(mask: np.ndarray) -> Image.Image:
        part = np.zeros_like(rgba)
        part[mask & opaque] = rgba[mask & opaque]
        return Image.fromarray(part, 'RGBA')

    # Keep the complete chair as the rear underpainting. Repeated registered
    # cushion/arm pixels cover Max where needed; underpainting prevents thin
    # resampling seams where separately sized alpha masks would meet.
    return chair.copy(), layer(cushion_mask), layer(front_mask)


def stage_image(character: Image.Image, *, chair: tuple[Image.Image, Image.Image, Image.Image] | None = None,
                upper: Image.Image | None = None, hands: Image.Image | None = None) -> Image.Image:
    canvas = Image.new('RGBA', (1200, 1100), '#fff9ee')
    d = ImageDraw.Draw(canvas)
    d.rectangle((0, 934, 1200, 1100), fill='#ecd5ad')
    d.line((0, 934, 1200, 934), fill='#986b70', width=3)
    char_scale = 1.25
    char_xy = (round(600 - W * char_scale / 2), round(934 - FLOOR * char_scale))

    def place(layer: Image.Image, xy: tuple[int, int], dimensions: tuple[int, int]) -> None:
        canvas.alpha_composite(layer.resize(dimensions, Image.Resampling.LANCZOS), xy)

    chair_xy = None
    chair_size = None
    if chair:
        cw, ch = chair[0].size
        ratio = (230 * char_scale / (355 / 724)) / cw
        chair_size = (round(cw * ratio), round(ch * ratio))
        chair_xy = (round(600 - chair_size[0] / 2), round(934 - 1029 * ratio))
        place(chair[0], chair_xy, chair_size)
        place(chair[1], chair_xy, chair_size)
    place(character, char_xy, (round(W * char_scale), round(H * char_scale)))
    if chair:
        place(chair[2], chair_xy, chair_size)
        # Max's hands rest visibly in front of the armrests.
        if hands:
            place(hands, char_xy, (round(W * char_scale), round(H * char_scale)))
    return canvas.convert('RGB')


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PROOF.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert('RGBA')
    chair = Image.open(CHAIR).convert('RGBA')
    upper, hands = approved_upper(source)
    lower = new_lower_body()
    seated = Image.new('RGBA', (W, H))
    seated.alpha_composite(lower)
    seated.alpha_composite(upper)
    seated.alpha_composite(hands)
    upper.save(OUT / 'approved-upper-translated.png')
    hands.save(OUT / 'hands-foreground.png')
    lower.save(OUT / 'illustrated-seated-lower.png')
    seated.save(OUT / 'max-seated.png')
    layers = chair_layers(chair)
    for name, layer in zip(('chair-back', 'chair-cushion', 'chair-front-arms'), layers):
        layer.save(OUT / f'{name}.png')
    standing = stage_image(source)
    seated_plain = stage_image(seated)
    seated_chair = stage_image(seated, chair=layers, hands=hands)
    standing.save(PROOF / '01-approved-standing.png')
    seated_plain.save(PROOF / '02-seated-anatomy.png')
    seated_chair.save(PROOF / '03-seated-on-chair.png')
    comparison = Image.new('RGB', (1600, 1000), '#fff9ee')
    comparison.paste(standing.resize((800, 733), Image.Resampling.LANCZOS), (0, 140))
    comparison.paste(seated_chair.resize((800, 733), Image.Resampling.LANCZOS), (800, 140))
    dc = ImageDraw.Draw(comparison)
    font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 34)
    dc.text((125, 65), 'Approved standing Max', font=font, fill=INK)
    dc.text((925, 65), 'Experimental seated Max V2', font=font, fill=INK)
    comparison.save(PROOF / '04-identity-comparison.png')
    solid_rows = np.where((np.array(seated)[:, :, 3] > 128).sum(axis=1) > 10)[0]
    summary = {
        'source': str(SOURCE.relative_to(ROOT)),
        'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'chairSourceSha256': hashlib.sha256(CHAIR.read_bytes()).hexdigest(),
        'sourceModified': False,
        'canvas': [W, H],
        'upperBodyTranslation': [0, HEAD_DROP],
        'approvedUpperCopiedPixels': int((np.array(upper)[:, :, 3] > 0).sum()),
        'solidFootBaseline': FLOOR,
        'lastSolidSeatedPixelRow': int(solid_rows[-1]),
        'chairLayers': ['full source underpainting', 'registered cushion', 'traced foreground arms'],
        'staticArtworkOnly': True,
    }
    (PROOF / 'measurements.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps(summary))


if __name__ == '__main__':
    main()

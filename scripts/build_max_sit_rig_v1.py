"""Build an isolated Max sit-rig study from the approved 434x724 idle sprite.

The approved input and older rig are read only. Every output is under the
experimental asset directory, which is never referenced by production Studio.
"""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = ROOT / 'public/art/max-0.png'
OLDER = ROOT / 'public/art/rig/max'
OUT = ROOT / 'public/art/experimental/max-sit-v1'
CHAIR_PATH = ROOT / 'proofs/max-rig-v1/chair-source.png'

source = Image.open(SOURCE_PATH).convert('RGBA')
original = np.array(source)
height, width = original.shape[:2]
size = (width, height)


def old_mask(name: str) -> np.ndarray:
    return np.array(Image.open(OLDER / name).convert('RGBA'))[:, :, 3] > 0


def polygon(points: list[tuple[int, int]]) -> np.ndarray:
    mask = Image.new('L', size)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return np.array(mask) > 0


def part(name: str, coverage: np.ndarray) -> None:
    pixels = np.zeros_like(original)
    pixels[coverage] = original[coverage]
    Image.fromarray(pixels, 'RGBA').save(OUT / f'{name}.png')


def illustrated_limb(name: str, points: list[tuple[int, int]], *, garment: bool = False) -> None:
    """Fill source-hidden joint area with a compact outlined, shaded component."""
    canvas = Image.new('RGBA', size)
    draw = ImageDraw.Draw(canvas)
    dark = (4, 29, 61, 255)
    base = (39, 204, 193, 255) if not garment else (38, 57, 95, 255)
    highlight = (83, 230, 212, 210) if not garment else (65, 84, 122, 210)
    draw.polygon(points, fill=dark)
    center_x = sum(point[0] for point in points) / len(points)
    center_y = sum(point[1] for point in points) / len(points)
    inner = [(round(center_x + (x - center_x) * .84), round(center_y + (y - center_y) * .92)) for x, y in points]
    draw.polygon(inner, fill=base)
    draw.line(inner[:2], fill=highlight, width=4)
    canvas.save(OUT / f'{name}.png')


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # Mutually exclusive original-pixel partitions reconstruct the source at rest.
    candidate: dict[str, np.ndarray] = {
        'head': old_mask('head.png'),
        'hand-right': old_mask('hand-right.png'),
        'hand-left': old_mask('hand-left.png'),
    }
    sleeve_right = old_mask('sleeve-right.png')
    sleeve_left = old_mask('sleeve-left.png')
    yy = np.arange(height)[:, None]
    candidate['upper-arm-right'] = sleeve_right & (yy < 477)
    candidate['forearm-right'] = sleeve_right & (yy >= 477)
    candidate['upper-arm-left'] = sleeve_left & (yy < 474)
    candidate['forearm-left'] = sleeve_left & (yy >= 474)
    candidate['shoe-right'] = polygon([(51, 644), (69, 629), (107, 608), (129, 589), (184, 586), (201, 629), (205, 707), (51, 707)])
    candidate['shoe-left'] = polygon([(227, 587), (295, 584), (341, 609), (379, 631), (389, 710), (224, 710)])
    candidate['pelvis'] = polygon([(113, 507), (319, 507), (319, 574), (287, 584), (219, 565), (148, 584), (112, 570)])
    candidate['upper-leg-right'] = polygon([(123, 550), (206, 550), (206, 592), (119, 592)])
    candidate['upper-leg-left'] = polygon([(226, 550), (311, 550), (314, 592), (226, 592)])
    candidate['lower-leg-right'] = polygon([(115, 587), (208, 587), (208, 641), (115, 641)])
    candidate['lower-leg-left'] = polygon([(224, 586), (317, 586), (317, 641), (224, 641)])
    # Priority assigns every original RGBA pixel to exactly one component.
    priority = [
        'head', 'hand-right', 'hand-left', 'forearm-right', 'forearm-left',
        'upper-arm-right', 'upper-arm-left', 'shoe-right', 'shoe-left',
        'pelvis', 'upper-leg-right', 'upper-leg-left', 'lower-leg-right', 'lower-leg-left',
    ]
    remaining = original[:, :, 3] > 0
    assigned: dict[str, np.ndarray] = {}
    for name in priority:
        assigned[name] = candidate[name] & remaining
        remaining &= ~assigned[name]
    # The hoodie, neck, and any unclassified silhouette pixels move as a single torso.
    assigned['torso'] = remaining
    for name, coverage in assigned.items():
        part(name, coverage)

    # Joint overlap lives behind the extracted pixels. No approved pixel is repainted.
    for side, x in [('right', 164), ('left', 268)]:
        illustrated_limb(f'upper-leg-fill-{side}', [(x - 23, 550), (x + 22, 550), (x + 20, 591), (x - 21, 591)], garment=True)
        illustrated_limb(f'lower-leg-fill-{side}', [(x - 20, 585), (x + 20, 585), (x + 18, 628), (x - 18, 628)])
    for side, x in [('right', 117), ('left', 328)]:
        illustrated_limb(f'arm-fill-{side}', [(x - 19, 449), (x + 19, 449), (x + 18, 511), (x - 18, 511)], garment=True)

    # This chair is a provisional additive illustration. Separate back and front
    # images retain exact pixels from the single candidate without touching room art.
    chair = Image.open(CHAIR_PATH).convert('RGBA')
    cw, ch = chair.size
    front_mask = Image.new('L', chair.size)
    pen = ImageDraw.Draw(front_mask)
    pen.polygon([(0, 580), (90, 500), (336, 470), (423, 515), (437, 945), (0, 955)], fill=255)
    pen.polygon([(1032, 515), (1120, 470), (1370, 500), (cw, 580), (cw, 955), (1019, 945)], fill=255)
    chair_front = Image.new('RGBA', chair.size)
    chair_front.paste(chair, (0, 0), front_mask)
    chair.save(OUT / 'chair-back.png')
    chair_front.save(OUT / 'chair-front.png')

    metadata = {
        'version': 1, 'source': '/art/max-0.png', 'width': width, 'height': height,
        'parts': list(assigned),
        'newFillParts': ['upper-leg-fill-right', 'lower-leg-fill-right', 'upper-leg-fill-left', 'lower-leg-fill-left', 'arm-fill-right', 'arm-fill-left'],
        'joints': {
            'neck': [218, 382], 'pelvis': [217, 548],
            'shoulder-right': [150, 410], 'elbow-right': [112, 477], 'wrist-right': [98, 521],
            'shoulder-left': [300, 410], 'elbow-left': [334, 474], 'wrist-left': [333, 522],
            'hip-right': [164, 552], 'knee-right': [162, 590], 'ankle-right': [153, 620],
            'hip-left': [268, 552], 'knee-left': [271, 590], 'ankle-left': [281, 620],
        },
        'approvedFootLine': 699, 'seatTarget': [217, 613],
    }
    (OUT / 'rig.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    # Exact neutral reconstruction can be validated without a browser.
    reconstructed = np.zeros_like(original)
    for name, coverage in assigned.items():
        reconstructed[coverage] = original[coverage]
    visible = original[:, :, 3] > 0
    mismatch = int(np.count_nonzero(np.any(reconstructed[visible] != original[visible], axis=1)))
    print(json.dumps({'neutralVisibleMismatchedPixels': mismatch, 'parts': len(assigned), 'output': str(OUT)}))


if __name__ == '__main__':
    main()

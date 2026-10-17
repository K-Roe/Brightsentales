"""Offline assembly of pose-specific clothing drafts with approved Maxine pixels.

Generated drafts supply the new garments and exposed limbs. Original runtime
sprites supply the head, hair, hands, moving feet and shoes. This script never
writes to production artwork or the approved 5B-P.1 front idle.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
FRAMES = ROOT / 'frames'
FRAMES.mkdir(exist_ok=True)
NAMES = [
    'maxine-side-0.png',
    'maxine-side-v3-1.png', 'maxine-side-v3-2.png',
    'maxine-side-v3-3.png', 'maxine-side-v3-4.png',
    'maxine-wave-1.png', 'maxine-wave-2.png', 'maxine-wave-3.png',
]


def opaque_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = np.asarray(image.getchannel('A'))
    ys, xs = np.where(alpha > 200)
    return int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)


def align_draft(draft: Image.Image, original: Image.Image) -> Image.Image:
    dx0, dy0, dx1, dy1 = opaque_bounds(draft)
    ox0, oy0, ox1, oy1 = opaque_bounds(original)
    sx = (ox1 - ox0) / (dx1 - dx0)
    sy = (oy1 - oy0) / (dy1 - dy0)
    scaled = draft.resize((round(draft.width * sx), round(draft.height * sy)), Image.Resampling.LANCZOS)
    aligned = Image.new('RGBA', original.size)
    aligned.paste(scaled, (round(ox0 - dx0 * sx), round(oy0 - dy0 * sy)))
    return aligned


def hand_mask(original: Image.Image, name: str) -> Image.Image:
    body = Image.open(REPO / 'public/recolour-masks/female' / name.replace('.png', '-body.png')).convert('L')
    mask = Image.new('L', original.size)
    draw = ImageDraw.Draw(mask)
    if 'wave' in name:
        if name.endswith('wave-1.png'):
            draw.rectangle((20, 340, 130, 415), fill=255)
        else:
            draw.rectangle((20, 235, 145, 345), fill=255)
        draw.rectangle((330, 500, 435, 565), fill=255)
    else:
        draw.rectangle((95, 405, 245, 555), fill=255)
        draw.rectangle((380, 390, original.width, 540), fill=255)
    return Image.composite(body, Image.new('L', original.size), mask)


def shoe_mask(original: Image.Image, name: str) -> Image.Image:
    mask = Image.new('L', original.size)
    draw = ImageDraw.Draw(mask)
    if 'wave' in name:
        draw.rectangle((105, 590, 405, original.height), fill=255)
    elif name == 'maxine-side-0.png':
        draw.rectangle((190, 570, 420, original.height), fill=255)
    elif name.endswith('v3-1.png'):
        draw.rectangle((70, 535, 215, original.height), fill=255)
        draw.rectangle((300, 565, 535, original.height), fill=255)
    elif name.endswith('v3-2.png'):
        draw.rectangle((135, 540, 275, original.height), fill=255)
        draw.rectangle((240, 580, 465, original.height), fill=255)
    elif name.endswith('v3-3.png'):
        draw.rectangle((60, 555, 225, original.height), fill=255)
        draw.rectangle((300, 585, 535, original.height), fill=255)
    elif name.endswith('v3-4.png'):
        draw.rectangle((195, 580, 340, original.height), fill=255)
        draw.rectangle((260, 550, 425, 665), fill=255)
    rgb = np.asarray(original)
    red = rgb[:, :, 0].astype('int16')
    green = rgb[:, :, 1].astype('int16')
    blue = rgb[:, :, 2].astype('int16')
    coloured_shoe = ((red > 125) & (red > green * 1.25) & (red > blue * 1.05)) | ((red > 185) & (green > 125) & (blue > 100))
    shoe = (np.asarray(mask) > 0) & coloured_shoe & (rgb[:, :, 3] > 0)
    return Image.fromarray((shoe * 255).astype('uint8')).filter(ImageFilter.MaxFilter(9))


def assemble(name: str) -> None:
    original = Image.open(REPO / 'public/art' / name).convert('RGBA')
    draft = Image.open(ROOT / 'drafts' / name).convert('RGBA')
    candidate = align_draft(draft, original)
    # The original head and painted lower hair are the identity anchor. The
    # draft is used only after the neckline, then original hands/feet return.
    protect = Image.new('L', original.size)
    draw = ImageDraw.Draw(protect)
    if 'wave' in name:
        draw.rectangle((145, 0, 410, 370), fill=255)
        draw.rectangle((145, 330, 185, 370), fill=0)
    else:
        draw.rectangle((185, 0, original.width, 350), fill=255)
    hair = Image.open(REPO / 'public/recolour-masks/female' / name.replace('.png', '-hair.png')).convert('L')
    # Recolour masks intentionally include similarly purple garment outlines.
    # Keep the ponytail regions, but exclude the old sleeve/skirt edges below
    # the head where those false positives would leave a second arm outline.
    hair_pixels = np.array(hair)
    if 'wave' in name:
        hair_pixels[345:, :170] = 0
        hair_pixels[350:, 170:345] = 0
    else:
        hair_pixels[345:, 190:] = 0
    hair = Image.fromarray(hair_pixels)
    protect = Image.fromarray(np.maximum(np.asarray(protect), np.asarray(hair)).astype('uint8'))
    # Face/neck skin is in the original body mask and extends a little below
    # the rectangular head crop. Keep it without carrying the old hood along.
    body = Image.open(REPO / 'public/recolour-masks/female' / name.replace('.png', '-body.png')).convert('L')
    face_box = Image.new('L', original.size)
    ImageDraw.Draw(face_box).rectangle((105, 0, 430, 390) if 'wave' in name else (190, 0, original.width, 365), fill=255)
    face = Image.composite(body, Image.new('L', original.size), face_box)
    protect = Image.fromarray(np.maximum(np.asarray(protect), np.asarray(face)).astype('uint8'))
    protect = Image.fromarray(np.maximum(np.asarray(protect), np.asarray(hand_mask(original, name))).astype('uint8'))
    protect = Image.fromarray(np.maximum(np.asarray(protect), np.asarray(shoe_mask(original, name))).astype('uint8'))
    candidate = Image.composite(original, candidate, protect)
    candidate.save(FRAMES / name)


for name in NAMES:
    assemble(name)

approved_idle = REPO / 'proofs/milestone5b-p1/maxine-front-tshirt-leggings-cleaned.png'
(FRAMES / 'maxine-0.png').write_bytes(approved_idle.read_bytes())

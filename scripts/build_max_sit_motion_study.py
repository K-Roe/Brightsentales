"""Isolated Max sit/stand motion study. Never writes production sprite assets."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from build_max_seated_v2 import ROOT, SOURCE, CHAIR, OUT, W, H, FLOOR, approved_upper, chair_layers, new_lower_body

PROOF = ROOT / 'proofs/max-sit-motion-study'
MID_SOURCE = OUT / 'motion-halfway-source.png'


def halfway_lower() -> Image.Image:
    authored = Image.open(MID_SOURCE).convert('RGBA')
    alpha = np.asarray(authored)[:, :, 3]
    yy, xx = np.where(alpha > 96)
    if not len(xx):
        raise ValueError('Halfway artwork is empty')
    crop = authored.crop((int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1))
    width = 256
    height = round(crop.height * width / crop.width)
    lower = Image.new('RGBA', (W, H))
    lower.alpha_composite(crop.resize((width, height), Image.Resampling.LANCZOS), ((W - width) // 2, FLOOR - height))
    return lower


def shift(layer: Image.Image, delta: int) -> Image.Image:
    shifted = Image.new('RGBA', layer.size)
    shifted.alpha_composite(layer, (0, delta))
    return shifted


def make_pose(lower: Image.Image, upper: Image.Image, hands: Image.Image, drop: int) -> tuple[Image.Image, Image.Image]:
    # The accepted V2 upper pixels were already moved down forty source pixels.
    torso = shift(upper, drop - 40)
    foreground_hands = shift(hands, drop - 40)
    pose = Image.new('RGBA', (W, H))
    pose.alpha_composite(lower)
    pose.alpha_composite(torso)
    pose.alpha_composite(foreground_hands)
    return pose, foreground_hands


def stage(character: Image.Image, chair: tuple[Image.Image, Image.Image, Image.Image],
          hands: Image.Image | None = None) -> Image.Image:
    canvas = Image.new('RGBA', (1200, 1100), '#fff9ee')
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 934, 1200, 1100), fill='#ecd5ad')
    draw.line((0, 934, 1200, 934), fill='#986b70', width=3)
    scale = 1.25
    char_size = (round(W * scale), round(H * scale))
    char_xy = (round(600 - char_size[0] / 2), round(934 - FLOOR * scale))
    cw, ch = chair[0].size
    ratio = (230 * scale / (355 / 724)) / cw
    chair_size = (round(cw * ratio), round(ch * ratio))
    chair_xy = (round(600 - chair_size[0] / 2), round(934 - 1029 * ratio))

    def place(layer: Image.Image, xy: tuple[int, int], size: tuple[int, int]) -> None:
        canvas.alpha_composite(layer.resize(size, Image.Resampling.LANCZOS), xy)

    place(chair[0], chair_xy, chair_size)
    place(chair[1], chair_xy, chair_size)
    place(character, char_xy, char_size)
    place(chair[2], chair_xy, chair_size)
    if hands is not None:
        place(hands, char_xy, char_size)
    return canvas.convert('RGB')


def main() -> None:
    PROOF.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert('RGBA')
    chair = chair_layers(Image.open(CHAIR).convert('RGBA'))
    upper, hands = approved_upper(source)
    mid_lower = halfway_lower()
    seated_lower = new_lower_body()
    mid, mid_hands = make_pose(mid_lower, upper, hands, 20)
    seated, seated_hands = make_pose(seated_lower, upper, hands, 40)
    # Keep exact approved endpoints; the middle pose is a provisional artwork study.
    poses = [stage(source, chair, shift(hands, -40)), stage(mid, chair, mid_hands),
             stage(seated, chair, seated_hands)]
    for name, pose in zip(('01-standing', '02-halfway', '03-seated'), poses):
        pose.save(PROOF / f'{name}.png')
    order = [0, 0, 0, 1, 2, 2, 2, 2, 1, 0, 0, 0]
    with tempfile.TemporaryDirectory(prefix='max-sit-motion-') as directory:
        frames = Path(directory)
        for index, pose_index in enumerate(order):
            poses[pose_index].save(frames / f'frame-{index:03}.png')
        subprocess.run([
            'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-framerate', '4',
            '-i', str(frames / 'frame-%03d.png'),
            '-vf', 'minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1',
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
            str(PROOF / 'max-sit-stand-candidate.mp4'),
        ], check=True)


if __name__ == '__main__':
    main()

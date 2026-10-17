"""Create offline, equal-scale artwork comparisons and runtime-timed GIFs."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
ART = ROOT.parent.parent / 'public/art'
FRAMES = ROOT / 'frames'
NAMES = [
    'maxine-0.png', 'maxine-side-0.png',
    'maxine-side-v3-1.png', 'maxine-side-v3-2.png',
    'maxine-side-v3-3.png', 'maxine-side-v3-4.png',
    'maxine-wave-1.png', 'maxine-wave-2.png', 'maxine-wave-3.png',
]
BG = '#edf3fa'


def placed(image: Image.Image, canvas: Image.Image, box: tuple[int, int, int, int]) -> None:
    x, y, width, height = box
    canvas.paste(image, (x + (width - image.width) // 2, y + height - image.height), image)


pair = Image.new('RGB', (3750, 2385), BG)
draw = ImageDraw.Draw(pair)
outfit = Image.new('RGB', (1800, 2385), BG)
outfit_draw = ImageDraw.Draw(outfit)
for i, name in enumerate(NAMES):
    original = Image.open(ART / name).convert('RGBA')
    candidate = Image.open(FRAMES / name).convert('RGBA')
    col, row = i % 3, i // 3
    px, py = col * 1250, row * 795
    draw.text((px + 20, py + 10), f'{name}  |  original / outfit  |  {original.width} x {original.height}', fill='#203052')
    placed(original, pair, (px + 10, py + 40, 600, 724))
    placed(candidate, pair, (px + 630, py + 40, 600, 724))
    ox = col * 600
    outfit_draw.text((ox + 20, py + 10), name, fill='#203052')
    placed(candidate, outfit, (ox, py + 40, 600, 724))
pair.save(ROOT / 'original-vs-outfit-nine-frames.png')
outfit.save(ROOT / 'outfit-nine-frames.png')


def stage_frame(name: str, title: str) -> Image.Image:
    image = Image.new('RGB', (590, 415), BG)
    draw = ImageDraw.Draw(image)
    draw.text((18, 12), title, fill='#203052')
    for x, folder, label in ((15, ART, 'Approved original'), (305, FRAMES, 'Alternative outfit')):
        frame = Image.open(folder / name).convert('RGBA')
        width = 213 if name == 'maxine-0.png' or name == 'maxine-side-0.png' else 245 if 'wave' in name else 239
        frame = frame.resize((width, 355), Image.Resampling.LANCZOS)
        draw.text((x + 15, 34), label, fill='#203052')
        placed(frame, image, (x, 52, 270, 355))
    return image


walk_sequence = [
    ('maxine-0.png', 300, 'Front idle'),
    ('maxine-side-0.png', 110, 'Turn to side'),
    *[(f'maxine-side-v3-{i}.png', 123, f'Walk frame {i}') for i in (1, 2, 3, 4, 1, 2, 3, 4)],
    ('maxine-side-0.png', 110, 'Stop'),
    ('maxine-0.png', 300, 'Return to front idle'),
]
wave_sequence = [0, 1, 2, 3, 2, 3, 2, 1, 0]
wave_frames = [stage_frame('maxine-0.png' if i == 0 else f'maxine-wave-{i}.png', f'Wave sequence frame {index + 1}: pose {i}') for index, i in enumerate(wave_sequence)]
walk_frames = [stage_frame(name, label) for name, _, label in walk_sequence]
walk_frames[0].save(ROOT / 'walking-original-vs-outfit.gif', save_all=True, append_images=walk_frames[1:], duration=[ms for _, ms, _ in walk_sequence], loop=0)
wave_frames[0].save(ROOT / 'waving-original-vs-outfit.gif', save_all=True, append_images=wave_frames[1:], duration=[180] * len(wave_frames), loop=0)


closeups = [
    ('Collar / hair', 'maxine-side-0.png', (160, 305, 425, 485)),
    ('Sleeve / wrist', 'maxine-side-v3-1.png', (105, 345, 290, 535)),
    ('Raised sleeve / hand', 'maxine-wave-2.png', (20, 245, 220, 470)),
    ('Waist / knees', 'maxine-side-v3-4.png', (180, 430, 455, 620)),
    ('Ankles / trainers', 'maxine-side-v3-3.png', (45, 550, 535, 710)),
]
detail = Image.new('RGB', (1300, len(closeups) * 550), BG)
d = ImageDraw.Draw(detail)
for i, (label, name, box) in enumerate(closeups):
    top = i * 550
    d.text((20, top + 12), f'{label} — {name} — original / outfit', fill='#203052')
    for j, folder in enumerate((ART, FRAMES)):
        crop = Image.open(folder / name).convert('RGBA').crop(box)
        crop.thumbnail((620, 485))
        crop = crop.resize((crop.width * 2, crop.height * 2), Image.Resampling.NEAREST)
        crop.thumbnail((620, 485))
        detail.paste(crop, (j * 650 + 15, top + 45), crop)
detail.save(ROOT / 'seam-closeups.png')
print('Created both contact sheets, both GIFs and seam close-ups.')

"""Analyze side-view walk frames to estimate stride and contact points."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).parent.parent
art = root / 'public' / 'art'
out = root / 'proofs' / 'episode-1' / 'walk-cycle-analysis.json'

def analyze(path):
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    # Find lowest opaque pixels in left and right halves
    left_lowest = None
    right_lowest = None
    for y in range(h - 1, -1, -1):
        for x in range(w):
            if img.getpixel((x, y))[3] > 30:
                if x < w / 2:
                    if left_lowest is None or y > left_lowest[1]:
                        left_lowest = (x, y)
                else:
                    if right_lowest is None or y > right_lowest[1]:
                        right_lowest = (x, y)
    return {
        'file': path.name,
        'size': (w, h),
        'left_lowest': left_lowest,
        'right_lowest': right_lowest,
    }

results = {}
for prefix in ['max', 'maxine']:
    frames = [analyze(art / f'{prefix}-side-{i}.png') for i in range(5)]
    results[prefix] = frames
    print(f'\n{prefix}:')
    for f in frames:
        print(f"  {f['file']}: left {f['left_lowest']}, right {f['right_lowest']}")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(results, indent=2))
print(f'\nWrote {out}')

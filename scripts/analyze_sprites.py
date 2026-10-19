"""Analyze approved Brightling sprite sheets to find foot positions for grounding."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).parent.parent
art = root / 'public' / 'art'
out = root / 'proofs' / 'episode-1' / 'sprite-analysis.json'

results = {}
for prefix in ['max', 'maxine']:
    for pose in ['idle', 'side', 'wave']:
        if pose == 'idle':
            paths = [art / f'{prefix}-0.png']
        elif pose == 'side':
            paths = [art / f'{prefix}-side-{i}.png' for i in range(5)]
        else:  # wave
            paths = [art / f'{prefix}-wave-{i}.png' for i in range(1, 4)]
        frames = []
        for p in paths:
            if not p.exists():
                frames.append({'file': p.name, 'missing': True})
                continue
            img = Image.open(p).convert('RGBA')
            w, h = img.size
            # Find lowest non-transparent pixel
            lowest = None
            for y in range(h - 1, -1, -1):
                for x in range(w):
                    if img.getpixel((x, y))[3] > 10:
                        lowest = (x, y)
                        break
                if lowest:
                    break
            # Find bounding box of opaque pixels
            bbox = img.getbbox()
            frames.append({
                'file': p.name,
                'width': w,
                'height': h,
                'lowest_pixel': lowest,
                'bbox': bbox,
                'foot_x_ratio': round(lowest[0] / w, 4) if lowest else None,
                'foot_y_ratio': round(lowest[1] / h, 4) if lowest else None,
                'bbox_bottom_ratio': round(bbox[3] / h, 4) if bbox else None,
            })
        results[f'{prefix}_{pose}'] = frames

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(results, indent=2))
print(f'Wrote {out}')
for key, frames in results.items():
    print(f'\n{key}:')
    for f in frames:
        if 'missing' in f:
            print(f"  {f['file']} MISSING")
        else:
            print(f"  {f['file']}: size {f['width']}x{f['height']}, lowest {f['lowest_pixel']}, foot_y_ratio {f['foot_y_ratio']}, bbox_bottom {f['bbox_bottom_ratio']}")

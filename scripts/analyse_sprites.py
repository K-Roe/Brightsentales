"""Analyse Max's approved idle frame and its recolour masks to plan phone poses."""
import numpy as np
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "public" / "art"
MASKS = ROOT / "public" / "recolour-masks" / "male"


def rgba(path):
    return np.array(Image.open(path).convert("RGBA"), dtype=np.uint8)


def mask_coverage(path):
    """Recolour masks are greyscale coverage stored in the red channel (see maker.ts)."""
    return np.array(Image.open(path).convert("L"), dtype=np.uint8) > 32


def components(mask, min_size=200):
    """Label 4-connected components of a boolean mask."""
    from scipy import ndimage  # type: ignore
    return None


def label(mask):
    """Simple iterative flood fill labelling without scipy."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    current = 0
    stack = []
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or labels[y, x]:
                continue
            current += 1
            stack.append((y, x))
            labels[y, x] = current
            while stack:
                cy, cx = stack.pop()
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = current
                        stack.append((ny, nx))
    return labels, current


def main():
    source = rgba(ART / "max-0.png")
    body = mask_coverage(MASKS / "max-0-body.png")
    hoodie = mask_coverage(MASKS / "max-0-hoodie.png")
    hair = mask_coverage(MASKS / "max-0-hair.png")
    print("frame", source.shape, "body px", int(body.sum()), "hoodie px", int(hoodie.sum()), "hair px", int(hair.sum()))

    labels, count = label(body)
    print(f"body components: {count}")
    rows = []
    for index in range(1, count + 1):
        ys, xs = np.nonzero(labels == index)
        if len(ys) < 200:
            continue
        rows.append((len(ys), int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max()), float(xs.mean()), float(ys.mean())))
    for size, x0, x1, y0, y1, cx, cy in sorted(rows, key=lambda r: -r[0]):
        print(f"  size={size:6d} bbox=({x0},{y0})-({x1},{y1}) centre=({cx:.0f},{cy:.0f})")

    # Sample the palette from flat interior regions.
    samples = {
        "skin hand (96,517)": (96, 517),
        "skin hand (332,521)": (332, 521),
        "hoodie chest (217,470)": (217, 470),
        "hoodie sleeve left (120,470)": (120, 470),
        "outline edge (86,500)": (86, 500),
        "hair top (217,120)": (217, 120),
    }
    print("palette samples:")
    for name, (x, y) in samples.items():
        print(f"  {name}: {tuple(int(v) for v in source[y, x][:3])}")

    # Sleeve extents and the shoulder line, to anchor a re-posed arm.
    print("hoodie rows (x-extent per scanline, right half = character left):")
    for y in range(400, 560, 20):
        xs = np.nonzero(hoodie[y])[0]
        if len(xs) == 0:
            print(f"  y={y}: -")
            continue
        left = xs[xs < 217]
        right = xs[xs >= 217]
        print(f"  y={y}: total=({xs.min()},{xs.max()}) right-arm=({left.min() if len(left) else '-'}..{left.max() if len(left) else '-'}) left-arm=({right.min() if len(right) else '-'}..{right.max() if len(right) else '-'})")
    print("dominant colours:")
    flat = source[hoodie].reshape(-1, 4)
    values, counts = np.unique(flat[:, :3], axis=0, return_counts=True)
    order = np.argsort(-counts)[:8]
    for index in order:
        print(f"  hoodie {tuple(int(v) for v in values[index])} x{counts[index]}")
    values, counts = np.unique(source[body].reshape(-1, 4)[:, :3], axis=0, return_counts=True)
    order = np.argsort(-counts)[:6]
    for index in order:
        print(f"  body   {tuple(int(v) for v in values[index])} x{counts[index]}")


if __name__ == "__main__":
    main()
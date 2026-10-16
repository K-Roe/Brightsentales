"""Crop the reviewed side-view sheets into aligned, transparent game frames.

Run with Python and Pillow when the source sheets change. This is an authoring
tool; the browser only loads the resulting PNGs.
"""

from pathlib import Path
from statistics import median

from PIL import Image


ART = Path(__file__).resolve().parents[1] / "public" / "art"
SHEETS = {
    "max": ([390, 840, 1270, 1750], 680, 699),
    "maxine": ([402, 839, 1258, 1716], 673, 706),
}
FRAME_SIZE = (500, 724)


for name, (dividers, target_height, foot_line) in SHEETS.items():
    source = Image.open(ART / f"{name}-side-sheet.png").convert("RGBA")
    edges = [0, *dividers, source.width]
    pieces = []
    for left, right in zip(edges, edges[1:]):
        cell = source.crop((left, 0, right, source.height))
        bounds = cell.getchannel("A").getbbox()
        if bounds is None:
            raise ValueError(f"Missing {name} artwork in {left}:{right}")
        pieces.append(cell.crop(bounds))

    scale = target_height / median(piece.height for piece in pieces)
    for index, piece in enumerate(pieces):
        width = round(piece.width * scale)
        height = round(piece.height * scale)
        if width > FRAME_SIZE[0] or height > FRAME_SIZE[1]:
            raise ValueError(f"{name} frame {index} exceeds the common canvas")
        resized = piece.resize((width, height), Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", FRAME_SIZE)
        frame.alpha_composite(resized, ((FRAME_SIZE[0] - width) // 2, foot_line - height))
        frame.save(ART / f"{name}-side-{index}.png")

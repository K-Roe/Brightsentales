"""Build close-up review plates from decoded V2 frames and source artwork."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FONT = ImageFont.truetype("arial.ttf", 24)
SMALL = ImageFont.truetype("arial.ttf", 18)

def label(draw, x, y, value, font=FONT):
    draw.text((x, y), value, fill="#182035", font=font)

def crop(name, box):
    return Image.open(HERE / name).convert("RGB").crop(box)

stop = Image.new("RGB", (1160, 475), "#f8f8fa")
d = ImageDraw.Draw(stop)
label(d, 24, 12, "V2 exported episode: abrupt walk-to-stand boundary")
for i, (file, title) in enumerate([
    ("v2-episode-at-3.09.png", "3.09 s: final walking stride"),
    ("v2-episode-at-3.18.png", "3.18 s: standing profile"),
]):
    x = 20 + i * 575
    label(d, x, 52, title, SMALL)
    stop.paste(crop(file, (550, 425, 1100, 810)), (x, 82))
stop.save(HERE / "problem-stop-closeup.png")

wave = Image.new("RGB", (1160, 640), "#f8f8fa")
d = ImageDraw.Draw(wave)
label(d, 24, 12, "V2 exported episode: copied front-wave pieces on profile art")
for i, (file, title, box) in enumerate([
    ("v2-episode-at-4.1.png", "Max wave: hand covers eye line", (570, 445, 830, 805)),
    ("v2-frame-141-5.898.png", "Maxine wave: sleeve and palm seam", (850, 445, 1110, 805)),
]):
    x = 130 + i * 575
    label(d, x, 52, title, SMALL)
    close = crop(file, box).resize((390, 540), Image.Resampling.LANCZOS)
    wave.paste(close, (x, 80))
wave.save(HERE / "problem-wave-closeup.png")

proposal = Image.new("RGB", (1730, 900), "#f8f8fa")
d = ImageDraw.Draw(proposal)
label(d, 26, 14, "V3 correction brief - source poses and required changes")
for i, name in enumerate(("max", "maxine")):
    x = 30 + i * 570
    base = Image.open(ROOT / "public/art" / f"{name}-side-0.png").convert("RGBA")
    proposal.paste(base, (x, 70), base)
    label(d, x, 806, f"{name.title()}: keep face, outfit, proportions", SMALL)
label(d, 1160, 180, "Hand must clear eye line", SMALL)
label(d, 1160, 220, "Arm must join shoulder", SMALL)
label(d, 1160, 260, "One raised hand only", SMALL)
label(d, 1160, 300, "Illustrate whole pose", SMALL)
label(d, 1160, 340, "Same shoe pixels + floor line", SMALL)
label(d, 1160, 380, "Natural width: 245 px at 355 px height", SMALL)
label(d, 1160, 420, "Finish walking on planted contact", SMALL)
proposal.save(HERE / "proposed-correction-brief.png")
if (HERE / "foundation-preview-2.9.png").exists():
    foundation = Image.new("RGB", (1160, 475), "#f8f8fa")
    d = ImageDraw.Draw(foundation)
    label(d, 24, 12, "V3 foundation preview: proportions fixed, landing artwork still missing")
    for i, (file, title) in enumerate([
        ("foundation-preview-2.9.png", "2.9 s: eased approach, walking pose"),
        ("foundation-preview-3.0.png", "3.0 s: standing profile, pose still jumps"),
    ]):
        x = 20 + i * 575
        label(d, x, 52, title, SMALL)
        foundation.paste(crop(file, (550, 425, 1100, 810)), (x, 82))
    foundation.save(HERE / "foundation-stop-closeup.png")
print("Saved V2 close-ups and correction brief")

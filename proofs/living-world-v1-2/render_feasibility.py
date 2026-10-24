"""Offline visual diagnosis only. Never writes to approved artwork or Studio data."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).with_name("physical-life-feasibility.mp4")
W, H, FPS, SECONDS = 1920, 1080, 24, 18
original = {
    "Max": Image.open(ROOT / "public/art/max-0.png").convert("RGBA"),
    "Maxine": Image.open(ROOT / "public/art/maxine-0.png").convert("RGBA"),
}
head = Image.open(ROOT / "public/art/rig/max/head.png").convert("RGBA")
font_path = "C:/Windows/Fonts/arial.ttf"
title = ImageFont.truetype(font_path, 40)
body = ImageFont.truetype(font_path, 28)
small = ImageFont.truetype(font_path, 23)


def sprite(canvas, name, x, y, motion):
    base = original[name]
    # Use source pixels only. The existing Max cutout deliberately exposes its
    # registration defect when moved; this is a failure sample, not new art.
    composite = base.copy()
    if name == "Max" and motion:
        offset = round(6 * math.sin(motion * 2 * math.pi / 5))
        composite.alpha_composite(head, (offset, 0))
    crop = composite.crop((0, 0, base.width, 560))
    scale = 1.32 if name == "Max" else 1.27
    crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
    canvas.paste(crop, (x - crop.width // 2, y), crop)


command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-preset", "veryfast", "-movflags", "+faststart", str(OUT)]
process = subprocess.Popen(command, stdin=subprocess.PIPE)
try:
    for frame in range(FPS * SECONDS):
        t = frame / FPS
        name = "Max" if t < 9 else "Maxine"
        image = Image.new("RGB", (W, H), "#e8f2f5")
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, W, 112), fill="#123d50")
        draw.text((42, 28), "BrightTales physical-life feasibility", font=title, fill="white")
        draw.rectangle((34, 145, 943, 1010), fill="#ffffff", outline="#9ab4bf", width=3)
        draw.rectangle((977, 145, 1886, 1010), fill="#ffffff", outline="#9ab4bf", width=3)
        draw.text((70, 173), "APPROVED BASELINE", font=body, fill="#123d50")
        draw.text((1013, 173), "LAYER MOTION TRIAL", font=body, fill="#123d50")
        draw.text((70, 221), name + " - approved standing pixels", font=small, fill="#46616a")
        draw.text((1013, 221), name + " - source pixels only", font=small, fill="#46616a")
        draw.line((960, 145, 960, 1010), fill="#7c9fac", width=3)
        sprite(image, name, 488, 280, None)
        sprite(image, name, 1432, 280, t if name == "Max" else None)
        draw = ImageDraw.Draw(image)
        if name == "Max":
            note = "Head shift exposes duplicate face/hair and neck seams."
            note2 = "Chest and shoulders cannot breathe independently with this cutout."
        else:
            note = "No approved Maxine head, torso or shoulder layers exist."
            note2 = "Independent blink exists in Studio; no physical motion is attempted."
        draw.rectangle((997, 848, 1865, 969), fill="#f9e9dc")
        draw.text((1014, 865), note, font=small, fill="#743c20")
        draw.text((1014, 913), note2, font=small, fill="#743c20")
        draw.text((70, 864), "Existing blink remains in the Studio renderer.", font=small, fill="#46616a")
        draw.text((70, 912), "This diagnostic does not reproduce that renderer.", font=small, fill="#46616a")
        draw.rectangle((0, 1034, round(W * t / SECONDS), H), fill="#2e9ca8")
        process.stdin.write(image.tobytes())
finally:
    process.stdin.close()
if process.wait() != 0:
    raise RuntimeError("ffmpeg encode failed")
print(OUT)

"""Decode every V2 export frame into indexed contact sheets for diagnosis."""

import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
VIDEO = ROOT / "proofs/max-maxine-greeting-v2/greeting-episode.webm"
PROBE = subprocess.run([
    "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
    "frame=best_effort_timestamp_time", "-of", "json", str(VIDEO)
], capture_output=True, text=True, check=True)
times = [float(row["best_effort_timestamp_time"]) for row in json.loads(PROBE.stdout)["frames"]]
width, height = 1672, 941
process = subprocess.Popen([
    "ffmpeg", "-v", "error", "-i", str(VIDEO), "-map", "0:v:0", "-fps_mode", "passthrough",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"
], stdout=subprocess.PIPE)
assert process.stdout is not None
thumb_width = 320
thumb_height = round(height * thumb_width / width)
sheets = [Image.new("RGB", (thumb_width * 5, (thumb_height + 22) * 10), "white") for _ in range((len(times) + 49) // 50)]
for index, timestamp in enumerate(times):
    raw = process.stdout.read(width * height * 3)
    if len(raw) != width * height * 3:
        raise RuntimeError(f"Missing decoded frame {index}")
    frame = Image.frombytes("RGB", (width, height), raw)
    sheet = sheets[index // 50]
    x = (index % 5) * thumb_width
    y = ((index // 5) % 10) * (thumb_height + 22)
    sheet.paste(frame.resize((thumb_width, thumb_height)), (x, y + 22))
    ImageDraw.Draw(sheet).text((x + 4, y + 3), f"{index:03d}  {timestamp:.3f}s", fill="black")
    if any(abs(timestamp - t) < 0.025 for t in (0.0, 0.5, 2.85, 2.99, 3.05, 3.6, 4.1, 5.22, 5.45, 5.9, 7.07, 7.8)):
        frame.save(OUT / f"v2-frame-{index:03d}-{timestamp:.3f}.png")
process.terminate()
process.wait()
for index, sheet in enumerate(sheets):
    sheet.save(OUT / f"v2-contact-{index + 1}.jpg", quality=86)
(OUT / "v2-frame-times.json").write_text(json.dumps(times, indent=2), encoding="utf-8")
print(f"Decoded {len(times)} frames; saved {len(sheets)} contact sheets")

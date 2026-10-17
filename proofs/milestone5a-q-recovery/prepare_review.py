"""Copy and present the original 5A-Q proof without changing its artwork."""

from hashlib import sha256
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
SOURCE = REPO / "proofs" / "milestone5a-q"
ORIGINALS = REPO / "public" / "art"
ORDER = ("0", "side-0", "side-v3-1", "side-v3-2", "side-v3-3", "side-v3-4", "wave-1", "wave-2", "wave-3")
RAW = (
    "front-idle", "side-idle", "walk-contact", "walk-passing-1",
    "walk-contact-2", "walk-passing-2", "wave-1", "wave", "wave-3",
)
FONT = Path("C:/Windows/Fonts/segoeui.ttf")


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def copy_verified(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and digest(destination) != digest(source):
        raise ValueError(f"Existing review file differs from its 5A-Q source: {destination}")
    if not destination.exists():
        shutil.copy2(source, destination)
    if digest(destination) != digest(source):
        raise ValueError(f"Copy failed hash verification: {source}")
    return {"source": str(source.relative_to(REPO)).replace("\\", "/"),
            "review": str(destination.relative_to(REPO)).replace("\\", "/"),
            "sha256": digest(source)}


manifest = {"source_set": "milestone5a-q", "copied_files": [], "approved_originals": []}
for name in ORDER:
    filename = f"max-{name}.png"
    manifest["copied_files"].append(copy_verified(SOURCE / "frames" / filename, HERE / "frames" / filename))
for name in RAW:
    filename = f"{name}-candidate.png"
    manifest["copied_files"].append(copy_verified(SOURCE / "candidates" / filename, HERE / "raw-candidates" / filename))
for filename in ("walking-preview.gif", "waving-preview.gif", "REPORT.md", "all-nine-contact-sheet.png", "seam-closeups.png"):
    manifest["copied_files"].append(copy_verified(SOURCE / filename, HERE / "original-5a-q-evidence" / filename))
for name in ORDER:
    filename = f"max-{name}.png"
    path = ORIGINALS / filename
    committed = subprocess.run(["git", "show", f"HEAD:public/art/{filename}"], cwd=REPO, capture_output=True, check=True).stdout
    if sha256(path.read_bytes()).digest() != sha256(committed).digest():
        raise ValueError(f"Approved production sprite differs from Git HEAD: {path}")
    manifest["approved_originals"].append({"path": f"public/art/{filename}", "sha256": digest(path)})
(HERE / "hash-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def label_font(size):
    return ImageFont.truetype(FONT, size) if FONT.exists() else ImageFont.load_default()


def checker(size):
    background = Image.new("RGBA", size, "#f7f5fa")
    draw = ImageDraw.Draw(background)
    for y in range(0, size[1], 24):
        for x in range(0, size[0], 24):
            if (x // 24 + y // 24) % 2 == 0:
                draw.rectangle((x, y, x + 23, y + 23), fill="#eeebf2")
    return background


def tile(image, title, width=580, height=765):
    result = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(result)
    draw.text((16, 10), title, font=label_font(19), fill="#302453")
    background = checker((width - 20, 724))
    background.alpha_composite(image, ((background.width - image.width) // 2, 0))
    result.paste(background.convert("RGB"), (10, 36))
    return result


frames = {name: Image.open(HERE / "frames" / f"max-{name}.png").convert("RGBA") for name in ORDER}
originals = {name: Image.open(ORIGINALS / f"max-{name}.png").convert("RGBA") for name in ORDER}

contact = Image.new("RGB", (1740, 2295), "white")
for index, name in enumerate(ORDER):
    contact.paste(tile(frames[name], f"5A-Q  |  {name}"), ((index % 3) * 580, (index // 3) * 765))
contact.save(HERE / "nine-frames-native-scale.png")

comparison = Image.new("RGB", (1160, 6885), "white")
for index, name in enumerate(ORDER):
    comparison.paste(tile(originals[name], f"Approved Max  |  {name}"), (0, index * 765))
    comparison.paste(tile(frames[name], f"5A-Q outfit  |  {name}"), (580, index * 765))
comparison.save(HERE / "approved-vs-5a-q-native-scale.png")

# These crops are presentation-only. They use the same pixel coordinates in
# source and outfit frames and never feed back into the copied sprite assets.
regions = (
    ("0", "collar and shoulders", (110, 345, 325, 445)),
    ("0", "sleeves and hands", (48, 395, 380, 560)),
    ("0", "waist and trouser tops", (110, 465, 325, 590)),
    ("0", "ankles and trainers", (93, 560, 355, 715)),
    ("side-v3-2", "walking sleeve and waist", (160, 360, 455, 565)),
    ("side-v3-4", "walking knee and ankle", (170, 460, 435, 705)),
    ("wave-2", "raised sleeve and hand", (55, 225, 235, 460)),
)
close = Image.new("RGB", (1260, len(regions) * 380), "white")
draw = ImageDraw.Draw(close)
for index, (name, description, region) in enumerate(regions):
    top = index * 380
    draw.text((15, top + 6), f"{name}  |  {description}  |  approved / 5A-Q", font=label_font(19), fill="#302453")
    for column, image in enumerate((originals[name], frames[name])):
        crop = image.crop(region)
        scale = min(600 / crop.width, 335 / crop.height)
        crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
        background = checker((610, 335))
        background.alpha_composite(crop, ((610 - crop.width) // 2, (335 - crop.height) // 2))
        close.paste(background.convert("RGB"), (15 + column * 620, top + 35))
close.save(HERE / "seam-closeups-enlarged.png")

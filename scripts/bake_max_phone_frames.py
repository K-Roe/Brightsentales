"""Bake approved-size Max phone pose candidates from reviewed transparent drafts.

The face and hair come from the approved idle sprite on every frame. This is an
offline whole-body sprite pipeline; the application never articulates Max.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "proofs/max-phone-v1-2/generated-candidates"
OUT = ROOT / "public/art/phone"
APPROVED = Image.open(ROOT / "public/art/max-0.png").convert("RGBA")
OUT.mkdir(parents=True, exist_ok=True)

for name in ("enter", "hold", "tap-start", "tap-mid", "raise", "touch"):
    draft = Image.open(SOURCE / f"{name}.png").convert("RGBA")
    frame = draft.resize(APPROVED.size, Image.Resampling.LANCZOS)
    # All three drafts change Max's facial details. Restore the approved head
    # and neck wholesale so speech cannot appear to animate his mouth.
    frame.paste((0, 0, 0, 0), (0, 0, frame.width, 365))
    frame.alpha_composite(APPROVED.crop((0, 0, frame.width, 365)), (0, 0))
    frame.save(OUT / f"max-phone-{name}.png")
    print(OUT / f"max-phone-{name}.png")

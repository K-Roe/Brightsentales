"""Focused integrity checks for the single front-idle outfit experiment."""

import hashlib
from pathlib import Path
import subprocess
import unittest

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
SOURCE = REPO / "public" / "art" / "max-0.png"


class FrontIdleChecks(unittest.TestCase):
    def test_original_png_is_unchanged(self):
        committed = subprocess.run(
            ["git", "show", "HEAD:public/art/max-0.png"],
            cwd=REPO, capture_output=True, check=True,
        ).stdout
        self.assertEqual(hashlib.sha256(SOURCE.read_bytes()).digest(), hashlib.sha256(committed).digest())

    def test_canvas_transparency_and_unaffected_pixels(self):
        with Image.open(SOURCE) as source, Image.open(ROOT / "max-front-idle-tshirt-trousers.png") as candidate, Image.open(ROOT / "allowed-change-mask.png") as allowed:
            self.assertEqual(source.size, (434, 724))
            self.assertEqual(candidate.size, source.size)
            self.assertEqual(candidate.mode, "RGBA")
            self.assertEqual(candidate.getchannel("A").getextrema(), (0, 255))
            self.assertEqual(allowed.size, source.size)
            forbidden = ImageChops.invert(allowed)
            for old, new in zip(source.split(), candidate.split()):
                self.assertIsNone(ImageChops.multiply(ImageChops.difference(old, new), forbidden).getbbox())


if __name__ == "__main__":
    unittest.main(verbosity=2)

"""Technical checks for the experimental nine-frame masked artwork."""

from pathlib import Path
import hashlib
import subprocess
import unittest

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
ORDER = ("0", "side-0", "side-v3-1", "side-v3-2", "side-v3-3", "side-v3-4", "wave-1", "wave-2", "wave-3")


class FrameChecks(unittest.TestCase):
    def test_originals_match_head(self):
        for name in ORDER:
            with self.subTest(name=name):
                path = f"public/art/max-{name}.png"
                committed = subprocess.run(["git", "show", f"HEAD:{path}"], cwd=REPO, capture_output=True, check=True).stdout
                self.assertEqual(hashlib.sha256((REPO / path).read_bytes()).digest(), hashlib.sha256(committed).digest())

    def test_dimensions_alpha_and_unchanged_regions(self):
        for name in ORDER:
            with self.subTest(name=name):
                with Image.open(REPO / "public" / "art" / f"max-{name}.png") as original, Image.open(ROOT / "frames" / f"max-{name}.png") as result, Image.open(ROOT / "masks" / f"max-{name}-allowed.png") as allowed:
                    self.assertEqual(result.mode, "RGBA")
                    self.assertEqual(result.size, original.size)
                    self.assertEqual(allowed.size, original.size)
                    self.assertEqual(result.getchannel("A").getextrema()[0], 0)
                    self.assertEqual(result.getchannel("A").getextrema()[1], 255)
                    channels = []
                    protected = ImageChops.invert(allowed)
                    for source_channel, result_channel in zip(original.split(), result.split()):
                        channels.append(ImageChops.multiply(ImageChops.difference(source_channel, result_channel), protected))
                    self.assertFalse(any(channel.getbbox() for channel in channels))

    def test_previews_have_runtime_frame_order_lengths(self):
        for filename, count in (("walking-preview.gif", 16), ("waving-preview.gif", 9)):
            with self.subTest(filename=filename), Image.open(ROOT / filename) as preview:
                self.assertEqual(preview.n_frames, count)


if __name__ == "__main__":
    unittest.main(verbosity=2)

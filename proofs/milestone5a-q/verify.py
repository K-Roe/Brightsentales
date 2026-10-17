"""Focused integrity checks for the offline Max outfit review assets."""

from pathlib import Path
import hashlib
import subprocess
import unittest

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
NAMES = (
    "0", "side-0", "side-v3-1", "side-v3-2", "side-v3-3",
    "side-v3-4", "wave-1", "wave-2", "wave-3",
)
CANDIDATES = (
    "front-idle", "side-idle", "walk-contact", "walk-passing-1",
    "walk-contact-2", "walk-passing-2", "wave-1", "wave", "wave-3",
)


class OutfitProofTests(unittest.TestCase):
    def test_all_nine_frames_match_original_canvas_and_have_transparency(self):
        for name in NAMES:
            with self.subTest(name=name):
                with Image.open(REPO / "public" / "art" / f"max-{name}.png") as original, Image.open(ROOT / "frames" / f"max-{name}.png") as edit:
                    self.assertEqual(edit.mode, "RGBA")
                    self.assertEqual(edit.size, original.size)
                    alpha = edit.getchannel("A")
                    minimum, maximum = alpha.getextrema()
                    self.assertEqual(minimum, 0)
                    self.assertEqual(maximum, 255)
                    self.assertIsNotNone(alpha.getbbox())

    def test_candidate_sources_exist_and_have_transparency(self):
        for name in CANDIDATES:
            with self.subTest(name=name):
                with Image.open(ROOT / "candidates" / f"{name}-candidate.png") as candidate:
                    self.assertEqual(candidate.mode, "RGBA")
                    self.assertEqual(candidate.getchannel("A").getextrema()[0], 0)

    def test_approved_originals_match_git_head(self):
        for name in NAMES:
            with self.subTest(name=name):
                relative = f"public/art/max-{name}.png"
                committed = subprocess.run(
                    ["git", "show", f"HEAD:{relative}"], cwd=REPO,
                    capture_output=True, check=True,
                ).stdout
                current = (REPO / relative).read_bytes()
                self.assertEqual(hashlib.sha256(current).digest(), hashlib.sha256(committed).digest())

    def test_animation_previews_have_expected_frame_counts(self):
        for filename, count in (("walking-preview.gif", 16), ("waving-preview.gif", 9)):
            with self.subTest(filename=filename), Image.open(ROOT / filename) as preview:
                self.assertEqual(preview.n_frames, count)

    def test_no_two_walk_candidates_are_identical(self):
        names = NAMES[2:6]
        frames = [Image.open(ROOT / "frames" / f"max-{name}.png").convert("RGB") for name in names]
        try:
            for index in range(len(frames)):
                for other in range(index + 1, len(frames)):
                    with self.subTest(first=names[index], second=names[other]):
                        self.assertIsNotNone(ImageChops.difference(frames[index], frames[other]).getbbox())
        finally:
            for frame in frames:
                frame.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)

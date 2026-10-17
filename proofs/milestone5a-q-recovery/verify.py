"""Verify this review contains exact copies of the available 5A-Q files."""

from hashlib import sha256
import json
from pathlib import Path
import subprocess
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
ORDER = ("0", "side-0", "side-v3-1", "side-v3-2", "side-v3-3", "side-v3-4", "wave-1", "wave-2", "wave-3")


class RecoveryChecks(unittest.TestCase):
    def test_all_copied_files_match_5a_q_sources(self):
        manifest = json.loads((ROOT / "hash-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["source_set"], "milestone5a-q")
        self.assertEqual(len(manifest["copied_files"]), 23)
        for entry in manifest["copied_files"]:
            with self.subTest(file=entry["source"]):
                source = REPO / entry["source"]
                recovered = REPO / entry["review"]
                expected = entry["sha256"]
                self.assertEqual(sha256(source.read_bytes()).hexdigest(), expected)
                self.assertEqual(sha256(recovered.read_bytes()).hexdigest(), expected)

    def test_all_nine_recovered_frames_match_original_canvas_and_alpha(self):
        for name in ORDER:
            with self.subTest(frame=name), Image.open(REPO / "public" / "art" / f"max-{name}.png") as original, Image.open(ROOT / "frames" / f"max-{name}.png") as recovered:
                self.assertEqual(recovered.size, original.size)
                self.assertEqual(recovered.mode, "RGBA")
                self.assertEqual(recovered.getchannel("A").getextrema(), (0, 255))

    def test_original_production_sprites_match_git_head(self):
        for name in ORDER:
            path = f"public/art/max-{name}.png"
            with self.subTest(file=path):
                committed = subprocess.run(["git", "show", f"HEAD:{path}"], cwd=REPO, capture_output=True, check=True).stdout
                self.assertEqual(sha256((REPO / path).read_bytes()).digest(), sha256(committed).digest())

    def test_copied_preview_frame_count_and_timing(self):
        preview_dir = ROOT / "original-5a-q-evidence"
        for name, durations in (
            ("walking-preview.gif", [320, 110] + [120] * 12 + [110, 750]),
            ("waving-preview.gif", [180] * 9),
        ):
            with self.subTest(preview=name), Image.open(preview_dir / name) as preview:
                self.assertEqual(preview.n_frames, len(durations))
                actual = []
                for index in range(preview.n_frames):
                    preview.seek(index)
                    actual.append(preview.info["duration"])
                self.assertEqual(actual, durations)


if __name__ == "__main__":
    unittest.main(verbosity=2)

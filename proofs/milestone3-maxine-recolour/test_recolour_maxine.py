"""Focused checks for the offline Maxine palette proof."""

import json
import unittest
from pathlib import Path

from PIL import Image

import recolour_maxine as proof


class MaxineRecolourTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = Path(__file__).resolve().parent / "v1"
        cls.specs = proof.validate(json.loads((proof.HERE / "palettes.json").read_text(encoding="utf-8")))
        cls.manifest = json.loads((cls.out / "manifest.json").read_text(encoding="utf-8"))

    def test_all_nine_poses_exist_for_each_palette(self):
        self.assertEqual(len(self.manifest), 27)
        for spec in self.specs:
            self.assertEqual({p.name for p in (self.out / spec["id"]).glob("*.png")}, set(proof.NAMES))

    def test_dimensions_alpha_and_source_hashes(self):
        for record in self.manifest:
            with self.subTest(frame=record["frame"], palette=record["palette"]):
                source_path = proof.ART / record["frame"]
                source = Image.open(source_path).convert("RGBA")
                generated = Image.open(self.out / record["palette"] / record["frame"]).convert("RGBA")
                self.assertEqual(proof.digest(source_path), record["source_sha256"])
                self.assertEqual(source.size, generated.size)
                self.assertEqual(source.getchannel("A").tobytes(), generated.getchannel("A").tobytes())
                self.assertTrue(record["alpha_identical"])

    def test_saved_masks_are_reusable_and_nonoverlapping(self):
        for name in proof.NAMES:
            source = Image.open(proof.ART / name).convert("RGBA")
            masks = proof.masks_for(source, name)
            for region, mask in masks.items():
                saved = Image.open(self.out / "masks" / f"{name.removesuffix('.png')}-{region}.png").convert("L")
                self.assertEqual(mask.tobytes(), saved.tobytes())
            alpha = source.getchannel("A").tobytes()
            channels = [masks[key].tobytes() for key in ("hair", "body", "clothing")]
            self.assertTrue(all(h + b + c <= a for a, h, b, c in zip(alpha, *channels)))

    def test_identical_settings_generate_identical_artwork(self):
        for name in (proof.NAMES[0], proof.NAMES[2], proof.NAMES[7]):
            source = Image.open(proof.ART / name).convert("RGBA")
            masks = proof.masks_for(source, name)
            for spec in self.specs:
                first = proof.colourise(source, masks, spec)
                second = proof.colourise(source, masks, spec)
                saved = Image.open(self.out / spec["id"] / name).convert("RGBA")
                self.assertEqual(first.tobytes(), second.tobytes())
                self.assertEqual(first.tobytes(), saved.tobytes())

    def test_eye_brow_nose_mouth_star_shoe_and_dark_outlines_preserved(self):
        source = Image.open(proof.ART / proof.NAMES[0]).convert("RGBA")
        side_source = Image.open(proof.ART / proof.NAMES[1]).convert("RGBA")
        samples = [(150, 247), (150, 306), (204, 338), (206, 377), (204, 468), (160, 640)]
        for spec in self.specs:
            result = Image.open(self.out / spec["id"] / proof.NAMES[0]).convert("RGBA")
            side_result = Image.open(self.out / spec["id"] / proof.NAMES[1]).convert("RGBA")
            self.assertEqual(side_source.getpixel((350, 450)), side_result.getpixel((350, 450)))
            for point in samples:
                with self.subTest(palette=spec["id"], point=point):
                    self.assertEqual(source.getpixel(point), result.getpixel(point))
            original_bytes, output_bytes = source.tobytes(), result.tobytes()
            for index in range(0, len(original_bytes), 4):
                original = original_bytes[index:index + 4]
                if max(original[:3]) <= 75:
                    self.assertEqual(original, output_bytes[index:index + 4])

    def test_no_changes_outside_semantic_masks(self):
        name = proof.NAMES[0]
        source = Image.open(proof.ART / name).convert("RGBA")
        masks = proof.masks_for(source, name)
        mask_bytes = [mask.tobytes() for mask in masks.values()]
        original = source.tobytes()
        for spec in self.specs:
            generated = Image.open(self.out / spec["id"] / name).convert("RGBA").tobytes()
            for pixel, values in enumerate(zip(*mask_bytes)):
                if not any(values):
                    start = pixel * 4
                    self.assertEqual(original[start:start + 4], generated[start:start + 4])

    def test_palette_validation(self):
        with self.assertRaises(ValueError):
            proof.validate([{"id": "lily", "name": "Lily", "body": "bad", "hair": "#123456", "clothing": "#abcdef"}])
        with self.assertRaises(ValueError):
            proof.validate([self.specs[0], self.specs[0]])


if __name__ == "__main__":
    unittest.main()

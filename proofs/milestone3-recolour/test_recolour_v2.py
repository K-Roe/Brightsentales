"""Focused offline checks for reusable Max palette masks."""

import colorsys
import json
import unittest
from pathlib import Path

from PIL import Image

import recolour_v2 as proof


class RecolourV2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = Path(__file__).resolve().parent / "v2"
        cls.specs = proof.validate_specs(json.loads((proof.HERE / "palettes.json").read_text(encoding="utf-8")))

    def test_all_frames_exist_and_preserve_geometry(self):
        for name in proof.NAMES:
            source = Image.open(proof.ART / name).convert("RGBA")
            for spec in self.specs:
                with self.subTest(name=name, palette=spec["id"]):
                    result = Image.open(self.out / spec["id"] / name).convert("RGBA")
                    self.assertEqual(source.size, result.size)
                    self.assertEqual(source.getchannel("A").tobytes(), result.getchannel("A").tobytes())

    def test_original_source_hashes_match_previous_proof(self):
        baseline = json.loads((proof.HERE / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(len(baseline), len(proof.NAMES))
        for record in baseline:
            self.assertEqual(proof.sha(proof.ART / record["frame"]), record["source_sha256"])

    def test_masks_are_reusable_and_do_not_overlap(self):
        for name in proof.NAMES:
            source = Image.open(proof.ART / name).convert("RGBA")
            masks = proof.source_mappings(source, name)
            saved = {key: Image.open(self.out / "masks" / f"{name.removesuffix('.png')}-{key}.png") for key in masks}
            for key in masks:
                self.assertEqual(masks[key].tobytes(), saved[key].tobytes())
            alpha = source.getchannel("A").tobytes()
            channels = [masks[key].tobytes() for key in ("hair", "body", "hoodie")]
            self.assertTrue(all(hair + body + hoodie <= a + 1 for a, hair, body, hoodie in zip(alpha, *channels)))

    def test_same_spec_and_mask_generate_identical_bytes(self):
        source = Image.open(proof.ART / proof.NAMES[0]).convert("RGBA")
        masks = proof.source_mappings(source, proof.NAMES[0])
        for spec in self.specs:
            first = proof.transform(source, masks, spec)
            second = proof.transform(source, masks, spec)
            saved = Image.open(self.out / spec["id"] / proof.NAMES[0]).convert("RGBA")
            self.assertEqual(first.tobytes(), second.tobytes())
            self.assertEqual(first.tobytes(), saved.tobytes())

    def test_full_coverage_hair_has_target_hue(self):
        for name in (proof.NAMES[0], proof.NAMES[2], proof.NAMES[7]):
            source = Image.open(proof.ART / name).convert("RGBA")
            hair = Image.open(self.out / "masks" / f"{name.removesuffix('.png')}-hair.png").convert("L")
            alpha = source.getchannel("A")
            points = [(x, y) for y in range(source.height) for x in range(source.width)
                      if hair.getpixel((x, y)) >= 250 and alpha.getpixel((x, y)) >= 250]
            self.assertGreater(len(points), 1000)
            for spec in self.specs:
                target_hue = proof.target_hsv(spec)["hair"][0]
                result = Image.open(self.out / spec["id"] / name).convert("RGBA")
                for point in points:
                    r, g, b, _ = result.getpixel(point)
                    hue, saturation, _ = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                    if saturation >= 0.15:
                        distance = min(abs(hue - target_hue), 1 - abs(hue - target_hue))
                        self.assertLess(distance, 0.035, (spec["id"], name, point))

    def test_approved_facial_details_and_dark_outlines_stay_unchanged(self):
        source = Image.open(proof.ART / proof.NAMES[0]).convert("RGBA")
        for spec in self.specs:
            result = Image.open(self.out / spec["id"] / proof.NAMES[0]).convert("RGBA")
            for point in ((150, 183), (230, 286), (155, 264), (230, 450), (120, 640)):
                with self.subTest(palette=spec["id"], point=point):
                    # Brow, nose, iris/eye edge, star, and trainer samples.
                    self.assertEqual(source.getpixel(point), result.getpixel(point))
            original_bytes, changed_bytes = source.tobytes(), result.tobytes()
            for index in range(0, len(original_bytes), 4):
                original = original_bytes[index:index + 4]
                if max(original[:3]) <= 58:
                    self.assertEqual(original, changed_bytes[index:index + 4])

    def test_palette_validation(self):
        with self.assertRaises(ValueError):
            proof.validate_specs([{"id": "test", "name": "Test", "body": "bad", "hair": "#123456", "hoodie": "#654321"}])
        with self.assertRaises(ValueError):
            proof.validate_specs([self.specs[0], self.specs[0]])


if __name__ == "__main__":
    unittest.main()

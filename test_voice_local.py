import io
import hashlib
import math
import struct
import subprocess
import unittest
import wave

from voice_local import process_audio


def tone(seconds=4):
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"".join(struct.pack("<h", round(9000 * math.sin(2 * math.pi * 220 * n / 16000))) for n in range(16000 * seconds)))
    return output.getvalue()


def duration(data):
    decoded = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", "44100", "pipe:1"], input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    return len(decoded.stdout) / (2 * 44100)


def frequency(data):
    with wave.open(io.BytesIO(data), "rb") as wav:
        wav.setpos(int(.4 * wav.getframerate()))
        count = wav.getframerate() // 2
        samples = struct.unpack("<" + "h" * count, wav.readframes(count))
        return 2 * sum(a <= 0 < b for a, b in zip(samples, samples[1:]))


class VoiceProcessingTests(unittest.TestCase):
    def test_separate_cuts_use_original_timeline(self):
        result = process_audio(tone(), {"trimStart": 0, "trimEnd": 4, "cuts": [[.5, 1], [2, 2.5]]})
        self.assertAlmostEqual(duration(result), 3, delta=.03)

    def test_overlapping_cuts_do_not_double_remove_audio(self):
        result = process_audio(tone(), {"trimStart": 0, "trimEnd": 4, "cuts": [[.5, 1.5], [1, 2]]})
        self.assertAlmostEqual(duration(result), 2.5, delta=.06)

    def test_cut_join_crossfades_discontinuous_phases(self):
        result = process_audio(tone(2), {"trimStart": 0, "trimEnd": 2, "cuts": [[.525, 1.038]]})
        with wave.open(io.BytesIO(result), "rb") as wav:
            frames = wav.readframes(wav.getnframes())
        samples = struct.unpack("<" + "h" * (len(frames) // 2), frames)
        self.assertLess(max(abs(a - b) for a, b in zip(samples, samples[1:])), 2000)

    def test_pitch_and_speed_are_separate_and_pcm_changes(self):
        original = tone(2)
        raised = process_audio(original, {"trimStart": 0, "trimEnd": 2, "pitch": 7, "speed": 1})
        faster = process_audio(original, {"trimStart": 0, "trimEnd": 2, "pitch": 0, "speed": 1.5})
        self.assertAlmostEqual(duration(raised), 2, delta=.03)
        self.assertAlmostEqual(duration(faster), 2 / 1.5, delta=.03)
        self.assertAlmostEqual(frequency(raised), 220 * 2 ** (7 / 12), delta=12)
        self.assertAlmostEqual(frequency(faster), 220, delta=12)
        self.assertNotEqual(raised, faster)

    def test_cartoon_effect_families_produce_distinct_audio(self):
        source = tone(2)
        base = {"trimStart": 0, "trimEnd": 2}
        variants = [
            {}, {"pitch": 5, "tone": .3}, {"pitch": -4, "tone": -.25},
            {"robot": True}, {"pitch": -7, "speed": .85, "reverb": True},
            {"pitch": 8, "speed": 1.18, "tone": .45}, {"echo": True, "reverb": True},
        ]
        hashes = [hashlib.sha256(process_audio(source, {**base, **effect})).hexdigest() for effect in variants]
        self.assertEqual(len(set(hashes)), len(variants))


if __name__ == "__main__":
    unittest.main()

"""Inspect the final Studio WebM against every saved Voice Maker WAV."""
import json
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
VIDEO = ROOT / "brighttales-meet-max-and-maxine-narrated-v2.webm"
RATE = 16000


def pcm(path: Path) -> np.ndarray:
    result = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"],
        check=True, capture_output=True,
    )
    return np.frombuffer(result.stdout, dtype="<f4").astype(np.float64)


def rms(values: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(values)))) if values.size else 0.0


def db(value: float) -> float:
    return round(20 * np.log10(max(value, 1e-12)), 2)


def matching_score(episode: np.ndarray, source: np.ndarray, expected_start: float) -> tuple[float, float]:
    # Ignore the source's attack/tail and compare the middle against the
    # encoded episode around the expected global time. FFT correlation allows
    # the browser recorder's small start offset without accepting another line.
    lead = min(int(0.4 * RATE), len(source) // 8)
    tail = min(int(0.45 * RATE), len(source) // 8)
    template = source[lead:len(source) - tail]
    left = max(0, int((expected_start - 0.6) * RATE))
    right = min(len(episode), int((expected_start + len(source) / RATE + 0.6) * RATE))
    segment = episode[left:right]
    count = len(segment) - len(template) + 1
    if count <= 0:
        return 0.0, expected_start
    length = 1 << (len(segment) + len(template) - 2).bit_length()
    correlations = np.fft.irfft(np.fft.rfft(segment, length) * np.conj(np.fft.rfft(template, length)), length)[:count]
    window_energy = np.cumsum(np.r_[0.0, segment * segment])
    window_energy = window_energy[len(template):] - window_energy[:-len(template)]
    denominator = np.sqrt(np.sum(template * template) * np.maximum(window_energy, 1e-20))
    scores = correlations / denominator
    best = int(np.argmax(scores))
    return round(float(scores[best]), 4), round((left + best) / RATE - lead / RATE, 3)


timeline = json.loads((ROOT / "timeline.json").read_text(encoding="utf-8"))
manifest = json.loads((ROOT / "narration-manifest.json").read_text(encoding="utf-8"))
assets = {item["key"]: item for item in manifest["lines"]}
episode = pcm(VIDEO)
result = {
    "encoded_audio_seconds": round(len(episode) / RATE, 3),
    "overall_rms_dbfs": db(rms(episode)),
    "overall_peak_dbfs": db(float(np.max(np.abs(episode)))),
    "music": "none",
    "lines": [],
}
for scene in timeline["scenes"]:
    for narration in scene["narrations"]:
        asset = assets[narration["key"]]
        source = pcm(ROOT / asset["file"])
        start = narration["globalStart"]
        end = narration["end"]
        window = episode[max(0, int(start * RATE)):min(len(episode), int((end + 0.3) * RATE))]
        score, matched_start = matching_score(episode, source, start)
        result["lines"].append({
            "key": narration["key"], "scene": scene["name"], "script": narration["text"],
            "planned_start": round(start, 3), "planned_end": round(end, 3),
            "scene_end": scene["globalStart"] + scene["duration"],
            "source_seconds": round(len(source) / RATE, 3),
            "encoded_window_rms_dbfs": db(rms(window)),
            "match_score": score, "matched_start": matched_start,
            "start_offset_seconds": round(matched_start - start, 3),
            "end_margin_seconds": round(scene["globalStart"] + scene["duration"] - end, 3),
        })
result["all_lines_matched"] = len(result["lines"]) == 11 and all(item["match_score"] > 0.55 for item in result["lines"])
result["all_lines_inside_scenes"] = all(item["end_margin_seconds"] > 0 for item in result["lines"])
(ROOT / "audio-verification.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: value for key, value in result.items() if key != "lines"}))
print([(item["key"], item["match_score"], item["start_offset_seconds"], item["end_margin_seconds"]) for item in result["lines"]])
if not result["all_lines_matched"] or not result["all_lines_inside_scenes"]:
    raise SystemExit("Narration verification failed")

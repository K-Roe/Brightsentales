"""Inspect captured browser audio for the four disposable test tones."""
from array import array
from math import cos, pi, sqrt
from pathlib import Path
import json
import wave

path = Path(__file__).with_name("browser-audio-inspect.wav")
with wave.open(str(path), "rb") as audio:
    rate = audio.getframerate()
    samples = array("h", audio.readframes(audio.getnframes()))


def strength(seconds: float, hz: int) -> float:
    start = int(seconds * rate)
    width = int(0.3 * rate)
    points = samples[start:start + width]
    coefficient = 2 * cos(2 * pi * hz / rate)
    previous = current = 0.0
    for sample in points:
        next_value = sample + coefficient * current - previous
        previous, current = current, next_value
    return round(sqrt(max(0, previous**2 + current**2 - coefficient * previous * current)) / max(1, width), 2)


times = [0.5, 2.4, 5.1, 11.5, 14.4, 17.2, 26.0, 31.0, 34.0]
result = {str(time): {str(hz): strength(time, hz) for hz in [220, 440, 660, 880]} for time in times}
print(json.dumps(result, indent=2))

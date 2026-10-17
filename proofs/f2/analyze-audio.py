"""Measure the known self-created tones in the captured browser output."""
from array import array
from math import cos, pi, sqrt
from pathlib import Path
import json
import sys
import wave

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name("browser-audio-inspect.wav")
with wave.open(str(path), "rb") as audio:
    rate = audio.getframerate()
    samples = array("h", audio.readframes(audio.getnframes()))


def strength(seconds: float, hz: int) -> float:
    start = int(seconds * rate)
    width = int(0.25 * rate)
    points = samples[start:start + width]
    coefficient = 2 * cos(2 * pi * hz / rate)
    previous = current = 0.0
    for sample in points:
        next_value = sample + coefficient * current - previous
        previous, current = current, next_value
    return round(sqrt(max(0, previous**2 + current**2 - coefficient * previous * current)) / max(1, width), 2)


times = [float(value) for value in sys.argv[2:]] if len(sys.argv) > 2 else [0.5, 2.5, 5.0, 11.5, 14.5, 16.5, 27.5, 30.5, 34.0]
result = {str(time): {str(hz): strength(time, hz) for hz in [220, 440, 660, 880, 990]} for time in times}
print(json.dumps(result, indent=2))

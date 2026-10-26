"""Loopback-only Voice Maker service. Uses installed local models; never downloads them."""
from __future__ import annotations

import argparse
from array import array
import io
import json
import math
import os
import shutil
import subprocess
import wave
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock, Thread

ROOT = Path(__file__).resolve().parent
MODELS_ROOT = Path(os.environ.get("BRIGHTTALES_VOICE_MODELS_DIR", ROOT.parent / "BrightTales" / "assets" / "voices")).resolve()
PIPER_MODELS = MODELS_ROOT / "models"
KOKORO_MODEL = MODELS_ROOT / "kokoro" / "kokoro-v1.0.onnx"
KOKORO_VOICES = MODELS_ROOT / "kokoro" / "voices-v1.0.bin"
BRITISH_KOKORO = ("bf_alice", "bf_emma", "bf_isabella", "bf_lily", "bm_daniel", "bm_fable", "bm_george", "bm_lewis")
MAX_BODY = 28_000_000
_models: dict[str, object] = {}
_lock = Lock()
SERVICE_NAME = "BrightTalesVoiceMaker"
SERVICE_PROTOCOL = 2


def _finish_sentence(wav_bytes: bytes, tail_seconds: float = 0.25) -> bytes:
    """Leave a short natural gap after synthesis so edits and scene cuts cannot clip the last word."""
    with wave.open(io.BytesIO(wav_bytes), "rb") as source:
        channels, sample_width, rate, _, _, _ = source.getparams()
        frames = source.readframes(source.getnframes())
    output = io.BytesIO()
    with wave.open(output, "wb") as target:
        target.setnchannels(channels)
        target.setsampwidth(sample_width)
        target.setframerate(rate)
        target.writeframes(frames)
        target.writeframes(bytes(round(rate * tail_seconds) * channels * sample_width))
    return output.getvalue()


def installed_voices() -> list[dict[str, str]]:
    voices = []
    try:
        from piper import PiperVoice  # noqa: F401
        for model in sorted(PIPER_MODELS.glob("*.onnx")):
            if (PIPER_MODELS / (model.name + ".json")).is_file():
                voices.append({"id": f"piper:{model.stem}", "name": model.stem.replace("_", " ").replace("-", " "), "engine": "Piper", "language": model.stem.split("-")[0]})
    except ImportError:
        pass
    if KOKORO_MODEL.is_file() and KOKORO_VOICES.is_file():
        try:
            from kokoro_onnx import Kokoro  # noqa: F401
            for key in BRITISH_KOKORO:
                voices.append({"id": f"kokoro:{key}", "name": key[3:].title() + (" · British female" if key.startswith("bf") else " · British male"), "engine": "Kokoro", "language": "en_GB"})
        except ImportError:
            pass
    return voices


def synthesize(data: dict) -> bytes:
    text = str(data.get("text", "")).strip()
    voice_id = str(data.get("voice", ""))
    speed = float(data.get("speed", 1))
    if not text or len(text) > 500 or not math.isfinite(speed) or not .6 <= speed <= 1.8:
        raise ValueError("Enter 1–500 characters and choose a speed from 0.6 to 1.8.")
    if voice_id not in {voice["id"] for voice in installed_voices()}:
        raise ValueError("That voice model is missing or unavailable.")
    with _lock:
        if voice_id.startswith("piper:"):
            from piper import PiperVoice
            from piper.config import SynthesisConfig
            model = PIPER_MODELS / (voice_id[6:] + ".onnx")
            if voice_id not in _models:
                _models[voice_id] = PiperVoice.load(model)
            output = io.BytesIO()
            with wave.open(output, "wb") as wav:
                _models[voice_id].synthesize_wav(text, wav, SynthesisConfig(length_scale=1 / speed))
            return _finish_sentence(output.getvalue())
        from kokoro_onnx import Kokoro
        import numpy as np
        if "kokoro" not in _models:
            _models["kokoro"] = Kokoro(str(KOKORO_MODEL), str(KOKORO_VOICES))
        samples, rate = _models["kokoro"].create(text, voice_id[7:], speed=speed, lang="en-gb")
        pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
        output = io.BytesIO()
        with wave.open(output, "wb") as wav:
            wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(rate); wav.writeframes(pcm.tobytes())
        return _finish_sentence(output.getvalue())


def check_runtime() -> dict:
    """Exercise an installed model before advertising Ready to the Studio."""
    if not shutil.which("ffmpeg"):
        return {"state": "error", "detail": "FFmpeg is missing. Voice effects are unavailable."}
    voices = installed_voices()
    if not voices:
        return {"state": "error", "detail": "Required Python voice dependency or model files are missing. Check Piper/Kokoro and the local voice models."}
    candidate = next((voice for voice in voices if voice["id"] == "piper:en_GB-alan-medium"), voices[0])
    try:
        sample = synthesize({"text": "Ready.", "voice": candidate["id"], "speed": 1})
        if len(sample) < 100:
            raise ValueError("The installed voice returned empty audio.")
    except Exception as exc:
        return {"state": "error", "detail": f"Voice model could not be loaded: {exc}"[:240]}
    return {"state": "ready", "detail": "Local voice engine is ready.", "voices": len(voices)}


def _bounded(value: object, minimum: float, maximum: float, label: str) -> float:
    number = float(value)
    if not math.isfinite(number) or not minimum <= number <= maximum:
        raise ValueError(f"{label} is outside its supported range.")
    return number


def process_audio(audio: bytes, options: dict) -> bytes:
    if len(audio) > 20_000_000 or len(audio) < 32 or not shutil.which("ffmpeg"):
        raise ValueError("Audio is too large, invalid, or FFmpeg is unavailable.")
    start = _bounded(options.get("trimStart", 0), 0, 600, "Trim start")
    end = _bounded(options.get("trimEnd", 0), start + .01, 600, "Trim end")
    pitch = _bounded(options.get("pitch", 0), -12, 12, "Pitch")
    speed = _bounded(options.get("speed", 1), .5, 2, "Speed")
    volume = _bounded(options.get("volume", 1), 0, 2, "Volume")
    tone = _bounded(options.get("tone", 0), -1, 1, "Tone")
    fade_in = _bounded(options.get("fadeIn", 0), 0, 10, "Fade in")
    fade_out = _bounded(options.get("fadeOut", 0), 0, 10, "Fade out")
    noise_reduction = _bounded(options.get("noiseReduction", 0), 0, 1, "Noise reduction")
    echo = bool(options.get("echo", False)); reverb = bool(options.get("reverb", False))
    robot = bool(options.get("robot", False))
    cuts = options.get("cuts", [])
    if not isinstance(cuts, list) or len(cuts) > 20:
        raise ValueError("Too many cuts.")
    cut_ranges = []
    for cut in cuts:
        if not isinstance(cut, list) or len(cut) != 2:
            raise ValueError("A cut range is invalid.")
        a = _bounded(cut[0], 0, 600, "Cut start") - start
        b = _bounded(cut[1], 0, 600, "Cut end") - start
        if b <= a: raise ValueError("A cut range is invalid.")
        if b > 0 and a < end - start:
            cut_ranges.append((max(0, a), min(end - start, b)))
    decoded = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-i", "pipe:0", "-ar", "44100", "-ac", "1", "-f", "s16le", "pipe:1"], input=audio, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90, check=False)
    if decoded.returncode or not decoded.stdout:
        raise ValueError("Voice input could not be decoded: " + decoded.stderr.decode("utf-8", "replace")[:160])
    samples = array("h"); samples.frombytes(decoded.stdout)
    first, last = round(start * 44100), min(len(samples), round(end * 44100))
    if last - first < 441: raise ValueError("The selected voice is shorter than 0.01 seconds.")
    removed_ranges = []
    for a, b in sorted(cut_ranges):
        left, right = max(first, round((a + start) * 44100)), min(last, round((b + start) * 44100))
        if right > left:
            if removed_ranges and left <= removed_ranges[-1][1]: removed_ranges[-1] = (removed_ranges[-1][0], max(right, removed_ranges[-1][1]))
            else: removed_ranges.append((left, right))
    selected = array("h")
    cursor = first
    for left, right in [*removed_ranges, (last, last)]:
        segment = samples[cursor:left]
        if selected and segment:
            overlap = min(220, len(selected) // 4, len(segment) // 4)
            if overlap:
                for index in range(overlap):
                    weight = (index + 1) / (overlap + 1)
                    selected[-overlap + index] = round(selected[-overlap + index] * (1 - weight) + segment[index] * weight)
                segment = segment[overlap:]
        selected.extend(segment)
        cursor = right
    if len(selected) < 441: raise ValueError("The cuts leave less than 0.01 seconds of voice.")
    chain = []
    if noise_reduction > 0:
        # FFmpeg's local afftdn filter uses a dB strength; keep the user
        # control bounded and leave the source bytes untouched.
        chain.append(f"afftdn=nr={0.01 + noise_reduction * 24:.2f}:nf=-50:tn=1")
    factor = 2 ** (pitch / 12)
    chain += ["aresample=48000", f"asetrate={round(48000 * factor)}", "aresample=48000", f"atempo={1 / factor:.7f}", f"atempo={speed}"]
    if tone > .02: chain.append(f"highshelf=f=2500:g={tone * 10:.2f}")
    if tone < -.02: chain.append(f"highshelf=f=2500:g={tone * 10:.2f}")
    if robot: chain.append("tremolo=f=35:d=0.8")
    if echo: chain.append("aecho=0.8:0.45:160:0.35")
    if reverb: chain.append("aecho=0.8:0.5:45|85|130:0.35|0.22|0.12")
    if bool(options.get("normalize", False)): chain.append("dynaudnorm=f=75:g=15:p=0.7")
    chain.append(f"volume={volume}")
    if fade_in: chain.append(f"afade=t=in:st=0:d={fade_in}")
    output_duration = len(selected) / 44100 / speed
    if fade_out: chain.append(f"afade=t=out:st={max(0, output_duration - fade_out)}:d={fade_out}")
    chain.append("alimiter=limit=0.95")
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-f", "s16le", "-ar", "44100", "-ac", "1", "-i", "pipe:0", "-af", ",".join(chain), "-ar", "44100", "-ac", "1", "-f", "s16le", "pipe:1"]
    result = subprocess.run(command, input=selected.tobytes(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90, check=False)
    if result.returncode or len(result.stdout) < 100:
        raise ValueError("Voice processing failed: " + result.stderr.decode("utf-8", "replace")[:240])
    if len(result.stdout) > 20_000_000 - 44: raise ValueError("Edited voice exceeds the Audio Library size limit.")
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(44100); wav.writeframes(result.stdout)
    return output.getvalue()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "dist"), **kwargs)

    def do_GET(self):
        if self.path == "/voice-api/health":
            return self._json({"service": SERVICE_NAME, "protocol": SERVICE_PROTOCOL, **self.server.health})
        if self.path == "/voice-api/voices":
            return self._json({"voices": installed_voices(), "models_dir": str(MODELS_ROOT), "ffmpeg": bool(shutil.which("ffmpeg"))})
        if self.path.startswith("/voice-api/"):
            return self._json({"error": "Unknown voice endpoint."}, 404)
        if self.path == "/": self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        if self.path == "/voice-api/owner/shutdown":
            owner_token = getattr(self.server, "owner_token", None)
            if not owner_token or self.headers.get("X-BrightTales-Owner") != owner_token:
                return self._json({"error": "This voice service is not owned by the caller."}, 403)
            self._json({"stopping": True})
            Thread(target=self.server.shutdown, daemon=True).start()
            return
        if self.headers.get("X-BrightTales-Voice") != "1" or self.headers.get("Origin") not in (None, f"http://127.0.0.1:{self.server.server_port}", "http://127.0.0.1:5173", "http://127.0.0.1:4177"):
            return self._json({"error": "Local Voice Maker request required."}, 403)
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: return self._json({"error": "Invalid voice request length."}, 400)
        if length < 1 or length > MAX_BODY: return self._json({"error": "Voice request is too large."}, 413)
        try:
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict): raise ValueError("Voice request must be an object.")
            if self.path == "/voice-api/synthesize":
                import base64
                audio = synthesize(payload)
                return self._json({"wav": base64.b64encode(audio).decode("ascii")})
            if self.path == "/voice-api/process":
                import base64
                audio = base64.b64decode(payload["audio"], validate=True)
                result = process_audio(audio, payload["options"])
                return self._json({"wav": base64.b64encode(result).decode("ascii")})
            return self._json({"error": "Unknown voice endpoint."}, 404)
        except (ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as exc:
            return self._json({"error": str(exc)}, 400)
        except Exception:
            return self._json({"error": "Voice generation failed. Check the local model installation."}, 500)

    def _json(self, payload: dict, status: int = 200):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()
    health = check_runtime()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.health = health
    server.owner_token = os.environ.get("BRIGHTTALES_VOICE_OWNER_TOKEN")
    print(f"Voice Maker local service: http://127.0.0.1:{args.port} ({health['state']})", flush=True)
    try: server.serve_forever()
    finally: server.server_close()

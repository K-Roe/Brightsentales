import wave, json
from pathlib import Path
manifest = json.loads(Path('proofs/episode-1/v2-audio/manifest.json').read_text())
for item in manifest:
    with wave.open(item['path'], 'rb') as w:
        dur = w.getnframes() / w.getframerate()
    print(f'{item["key"]}: {dur:.2f}s')

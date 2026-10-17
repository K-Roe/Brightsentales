"""Focused integrity checks for the offline Maxine outfit proof."""
from hashlib import sha256
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
NAMES = [
    'maxine-0.png', 'maxine-side-0.png',
    'maxine-side-v3-1.png', 'maxine-side-v3-2.png',
    'maxine-side-v3-3.png', 'maxine-side-v3-4.png',
    'maxine-wave-1.png', 'maxine-wave-2.png', 'maxine-wave-3.png',
]
ORIGINAL_HASHES = [
    '0a8be579504df4534b2b074a4e147856ecb99f34246f91fbb04e15236f4da26c',
    '5984ee252577e28ff7456356b588eb14920731dfedb477cc2671f71f0fcbf8ea',
    '10e382323d8ac8b9e04ac64c4bc17260b6cff1a39665ba80216c91752e7c5029',
    'c45137c1da40be94ac290295c454e938090c2bd9e0444bfcb8d10a46669f65bd',
    'efc0784a34ebce796d8fe5a68b50b689a68ae5e5f5eb1a9d72b84174dd89e1d3',
    'af768a27b54fa820a8fd28868d1ac35ccee6e62ee71ebe1f32f43a1ec64de6c9',
    'fb126ace2588143871cf13d274eec2e4472f26539d4036ea53af43c0aee39911',
    'edda027be4b83f913f752157e8055ef3b4fb5992307db54aa6930b290167bc35',
    '489ed49d4505541c35b4ba434c3c1431c9daa69a2a65654db5a588b8f0e32558',
]
APPROVED_IDLE_HASH = '1ee42700da5f1ecda658a6d06865d317726a241bd6d29c628911d58a622158c1'

def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()

front = REPO / 'proofs/milestone5b-p1/maxine-front-tshirt-leggings-cleaned.png'
assert digest(front) == APPROVED_IDLE_HASH, 'Approved front-idle file changed'
assert digest(ROOT / 'frames/maxine-0.png') == APPROVED_IDLE_HASH, 'Front-idle candidate is not an exact copy'

for name, expected_hash in zip(NAMES, ORIGINAL_HASHES, strict=True):
    source = REPO / 'public/art' / name
    candidate = ROOT / 'frames' / name
    assert digest(source) == expected_hash, f'Approved runtime sprite changed: {name}'
    assert candidate.is_file(), f'Missing candidate: {name}'
    original_image = Image.open(source)
    candidate_image = Image.open(candidate)
    assert original_image.mode == candidate_image.mode == 'RGBA', name
    assert original_image.size == candidate_image.size, name
    assert candidate_image.getchannel('A').getextrema() == (0, 255), name
    original_opaque = np.asarray(original_image)[:, :, 3] > 128
    candidate_opaque = np.asarray(candidate_image)[:, :, 3] > 128
    assert .90 < candidate_opaque.sum() / original_opaque.sum() < 1.05, name

walk = (REPO / 'src/walking.ts').read_text(encoding='utf-8')
wave = (REPO / 'src/wave.ts').read_text(encoding='utf-8')
assert 'WALK_SPEED = 235' in walk and 'FRAME_DISTANCE = 29' in walk
assert 'WAVE_FRAME_MS = 180' in wave
assert '[0, 1, 2, 3, 2, 3, 2, 1, 0]' in wave
with Image.open(ROOT / 'walking-original-vs-outfit.gif') as animation:
    assert animation.n_frames == 12
    assert animation.info.get('loop') == 0
with Image.open(ROOT / 'waving-original-vs-outfit.gif') as animation:
    assert animation.n_frames == 9
    assert animation.info.get('loop') == 0
    assert all(animation.seek(i) is None and animation.info['duration'] == 180 for i in range(9))

assert len({digest(ROOT / 'frames' / name) for name in NAMES}) == 9
print('PASS: approved hashes, frozen idle, nine RGBA dimensions/alpha, distinct frames, mapping constants and GIF sequences.')

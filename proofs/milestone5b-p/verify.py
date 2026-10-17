from hashlib import sha256
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
source = root.parent.parent / 'public/art/maxine-0.png'
candidate = root / 'maxine-front-tshirt-leggings-experiment.png'
assert sha256(source.read_bytes()).hexdigest() == '0a8be579504df4534b2b074a4e147856ecb99f34246f91fbb04e15236f4da26c'
a = Image.open(source).convert('RGBA')
b = Image.open(candidate).convert('RGBA')
assert a.size == b.size == (434, 724)
assert a.getchannel('A').getextrema() == b.getchannel('A').getextrema() == (0, 255)
assert a.crop((0, 0, 434, 390)).tobytes() == b.crop((0, 0, 434, 390)).tobytes()
assert a.crop((0, 590, 434, 724)).tobytes() == b.crop((0, 590, 434, 724)).tobytes()
print('Source hash, dimensions, RGBA transparency, exact upper face/hair region and exact original trainers: PASS')

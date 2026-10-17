from hashlib import sha256
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
repo = root.parent.parent
source = repo / 'public/art/maxine-0.png'
before_path = root.parent / 'milestone5b-p/maxine-front-tshirt-leggings-experiment.png'
after_path = root / 'maxine-front-tshirt-leggings-cleaned.png'
assert sha256(source.read_bytes()).hexdigest() == '0a8be579504df4534b2b074a4e147856ecb99f34246f91fbb04e15236f4da26c'
assert sha256(before_path.read_bytes()).hexdigest() == 'b7d782f085b7304b2706c6647a3e68d5f6711513198633f09dbf64191b41c16b'
source_image = Image.open(source).convert('RGBA')
before = Image.open(before_path).convert('RGBA')
after = Image.open(after_path).convert('RGBA')
assert before.size == after.size == source_image.size == (434, 724)
assert before.getchannel('A').getextrema() == after.getchannel('A').getextrema() == (0, 255)
assert before.crop((0, 0, 434, 390)).tobytes() == after.crop((0, 0, 434, 390)).tobytes()
assert source_image.crop((0, 0, 434, 390)).tobytes() == after.crop((0, 0, 434, 390)).tobytes()
assert source_image.crop((0, 590, 434, 724)).tobytes() == after.crop((0, 590, 434, 724)).tobytes()

allowed = [
    (130, 390, 301, 426),
    (50, 390, 155, 440), (275, 390, 400, 440),
    (50, 470, 125, 545), (290, 470, 370, 545),
    (115, 570, 205, 590), (225, 570, 315, 590),
]
def inside(x: int, y: int) -> bool:
    return any(left <= x < right and top <= y < bottom for left, top, right, bottom in allowed)

changed = 0
for y in range(724):
    for x in range(434):
        if before.getpixel((x, y)) != after.getpixel((x, y)):
            assert inside(x, y), f'Unexpected change at {(x, y)}'
            changed += 1
assert changed > 0
print(f'PASS: source and input hashes, dimensions, transparency, face/hair, original trainers, and edit bounds ({changed} changed pixels).')

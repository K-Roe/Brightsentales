"""Generate Episode 1 V2 narration, Maxine voice and Bright Speak device audio."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from voice_local import synthesize

out_dir = Path(__file__).parent.parent / 'proofs' / 'episode-1' / 'v2-audio'
out_dir.mkdir(parents=True, exist_ok=True)

lines = [
    # Narrator (Lily, 0.90x)
    ('narrator-max-intro', 'kokoro:bf_lily', 0.9, "Hello everyone! Welcome to BrightTales! Today we're going to meet someone very special. This is Max! Max is a Brightling with a big smile and a kind heart. He notices little things, and likes to share what makes him happy. Max doesn't use spoken words. He can tell us so much with a look, a wave, and the things he chooses to show us. Let's say hello!"),
    ('narrator-maxine-intro', 'kokoro:bf_lily', 0.9, "And this is Maxine! She is Max's sister. Maxine loves playful mornings and new ideas. She likes to take her time, look around, and see what the day might bring. When Max and Maxine are together, they listen to each other and find lovely ways to play. I think Maxine is ready to visit her brother."),
    ('narrator-breakfast-a', 'kokoro:bf_lily', 0.9, "Back at Max's house, it is nearly breakfast time. Max has something he would like to tell us. He takes out his Bright Speak and chooses a picture of food. Bright Speak helps Max share what he wants and needs. Watch him tap the screen carefully."),
    ('narrator-breakfast-b', 'kokoro:bf_lily', 0.9, "There we are! Max has told us what he needs. Bright Speak helps his message come through clearly. Now he can look forward to breakfast."),
    ('narrator-stars', 'kokoro:bf_lily', 0.9, "After breakfast, Max feels proud. He has used his own way of communicating, and everyone has understood him. In Max's world, we call those happy little moments Bright Stars. A Bright Star can be for trying something new, sharing a feeling, or being kind. Max has earned a bright moment today. Shall we give him a little wave?"),
    ('narrator-garden', 'kokoro:bf_lily', 0.9, "Here comes Maxine! She has found Max in the garden. The two friends have room to explore. Maxine waves, and Max waves back. They notice the colours around them and take a little walk together. Sometimes sisters and brothers talk with words. Sometimes a smile, a gesture, or simply being side by side says enough. Max and Maxine are having a lovely time."),
    ('narrator-goodbye', 'kokoro:bf_lily', 0.9, "The day has been full of small, happy moments. Max shared what he needed. Maxine came to play. And together, they found a new story to tell. Max and Maxine have lots more adventures waiting for them. But for now, it's time to say goodbye, and goodnight. See you next time!"),
    # Maxine (Emma, 0.95x)
    ('maxine-hi', 'kokoro:bf_emma', 0.95, "Hi everyone! I'm Maxine."),
    ('maxine-fun', 'kokoro:bf_emma', 0.95, "This is fun, Max!"),
    ('maxine-goodnight', 'kokoro:bf_emma', 0.95, "Goodnight, everyone!"),
    # Bright Speak device (George, 1.0x)
    ('device-hungry', 'kokoro:bm_george', 1.0, "I'm hungry!"),
]

results = []
for key, voice, speed, text in lines:
    print(f'Generating {key}...')
    wav = synthesize({'text': text, 'voice': voice, 'speed': speed})
    path = out_dir / f'{key}.wav'
    path.write_bytes(wav)
    results.append({'key': key, 'voice': voice, 'speed': speed, 'text': text, 'path': str(path), 'bytes': len(wav)})

(out_dir / 'manifest.json').write_text(json.dumps(results, indent=2))
print(f'Generated {len(results)} audio files in {out_dir}')

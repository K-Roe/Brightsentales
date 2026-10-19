"""Build Episode 1 V2 Studio Backup v8 from the V1 backup and newly generated audio.

This script preserves all approved artwork and place data, replaces narration and
adds Maxine's voice, and re-stages every scene with more varied actions so the
characters stay alive during the story.
"""
import base64
import hashlib
import json
import wave
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).parent.parent
V1_BACKUP = ROOT / 'proofs' / 'episode-1' / 'final-production' / 'BrightTales-Episode-1-Meet-Max-studio-backup-v8.json'
AUDIO_DIR = ROOT / 'proofs' / 'episode-1' / 'v2-audio'
OUT_BACKUP = ROOT / 'proofs' / 'episode-1' / 'v2-production' / 'BrightTales-Episode-1-Meet-Max-V2-studio-backup.json'
OUT_BACKUP.parent.mkdir(parents=True, exist_ok=True)


def audio_asset(key: str, name: str, kind: str, speaker: str | None) -> dict:
    wav_path = AUDIO_DIR / f'{key}.wav'
    data = wav_path.read_bytes()
    with wave.open(str(wav_path), 'rb') as w:
        duration = w.getnframes() / w.getframerate()
    asset_id = str(uuid4())
    asset = {
        'id': asset_id,
        'name': name,
        'kind': kind,
        'mime': 'audio/wav',
        'duration': round(duration, 3),
        'size': len(data),
        'data': base64.b64encode(data).decode('ascii'),
        'sha256': hashlib.sha256(data).hexdigest(),
    }
    if speaker is not None:
        asset['speakerId'] = speaker
    return asset, asset_id


def clip(asset_id: str, start: float, trim_end: float, volume: float = 0.8, speaker: str | None = None) -> dict:
    c = {
        'id': str(uuid4()),
        'assetId': asset_id,
        'start': round(start, 3),
        'trimStart': 0,
        'trimEnd': round(trim_end, 3),
        'volume': volume,
        'fadeIn': 0,
        'fadeOut': 0,
    }
    if speaker is not None:
        c['speakerId'] = speaker
    return c


def action(character_id: str, action_type: str, start: float, duration: float, point=None) -> dict:
    a = {'id': str(uuid4()), 'characterId': character_id, 'type': action_type, 'start': round(start, 3), 'duration': round(duration, 3)}
    if point is not None:
        a['point'] = point
    return a


# Create audio assets.
audio_map = {}
for key, name, kind, speaker in [
    ('narrator-max-intro', 'Narrator — Lily — Hello everyone', 'speech', 'narrator'),
    ('narrator-maxine-intro', 'Narrator — Lily — And this is Maxine', 'speech', 'narrator'),
    ('narrator-breakfast-a', 'Narrator — Lily — Back at Max\'s house', 'speech', 'narrator'),
    ('narrator-breakfast-b', 'Narrator — Lily — There we are', 'speech', 'narrator'),
    ('narrator-stars', 'Narrator — Lily — After breakfast', 'speech', 'narrator'),
    ('narrator-garden', 'Narrator — Lily — Here comes Maxine', 'speech', 'narrator'),
    ('narrator-goodbye', 'Narrator — Lily — The day has been full', 'speech', 'narrator'),
    ('maxine-hi', 'Maxine — Hi everyone', 'speech', 'maxine'),
    ('maxine-fun', 'Maxine — This is fun Max', 'speech', 'maxine'),
    ('maxine-goodnight', 'Maxine — Goodnight everyone', 'speech', 'maxine'),
    ('device-hungry', 'Bright Speak — I\'m hungry', 'speech', None),
]:
    asset, asset_id = audio_asset(key, name, kind, speaker)
    audio_map[key] = (asset, asset_id)

music_asset = None
music_id = None
effect_asset = None
effect_id = None

backup = json.loads(V1_BACKUP.read_text(encoding='utf-8'))

# Keep any existing music/effect assets if present.
for asset in backup.get('audioAssets') or []:
    if asset['kind'] == 'music' and music_asset is None:
        music_asset = asset
        music_id = asset['id']
    if asset['kind'] == 'effect' and effect_asset is None:
        effect_asset = asset
        effect_id = asset['id']

# Build new audio asset list.
audio_assets = [a for a, _ in audio_map.values()]
if music_asset:
    audio_assets.append(music_asset)
if effect_asset:
    audio_assets.append(effect_asset)


def a(key: str) -> str:
    return audio_map[key][1]


# Scene staging with more actions and fewer dead gaps.
scenes = []

# Scene 1 — Meet Max.
scenes.append({
    'name': '1. Meet Max',
    'duration': 24,
    'placeId': 'place-c80ed77d-fb19-4714-b8de-34265e70749a',
    'characters': {'max': {'x': 836, 'y': 790}},
    'actions': [
        action('max', 'appear', 0, 0, {'x': 836, 'y': 790}),
        action('max', 'breathe', 0.5, 4),
        action('max', 'wave', 4.5, 1.62),
        action('max', 'point', 8, 1.2),
        action('max', 'wave', 14, 1.62),
        action('max', 'smile', 18, 2),
    ],
    'audio': [clip(a('narrator-max-intro'), 0.5, 20.15, 0.8, 'narrator')],
})

# Scene 2 — Meet Maxine.
scenes.append({
    'name': '2. Meet Maxine',
    'duration': 23,
    'placeId': 'place-98f791a6-1568-4aa3-86d8-3fcc2b0b78a9',
    'characters': {'maxine': {'x': 836, 'y': 790}},
    'actions': [
        action('maxine', 'appear', 0, 0, {'x': 836, 'y': 790}),
        action('maxine', 'wave', 1, 1.62),
        action('maxine', 'react', 4, 0.8),
        action('maxine', 'breathe', 7, 4),
        action('maxine', 'wave', 12, 1.62),
        action('maxine', 'smile', 16, 2),
    ],
    'audio': [
        clip(a('narrator-maxine-intro'), 0.5, 17.66, 0.8, 'narrator'),
        clip(a('maxine-hi'), 3, 2.11, 0.85, 'maxine'),
    ],
})

# Scene 3 — Breakfast Time / Bright Speak.
scenes.append({
    'name': '3. Breakfast Time',
    'duration': 32,
    'placeId': 'place-b9b39342-4a21-4e91-a70c-87eb5facfb41',
    'characters': {'max': {'x': 836, 'y': 790}},
    'actions': [
        action('max', 'appear', 0, 0, {'x': 836, 'y': 790}),
        action('max', 'wave', 1, 1.62),
        action('max', 'breathe', 4, 3),
        # Bright Speak sequence.
        action('max', 'wait', 8, 0.5),
        action('max', 'wait', 16.5, 0.5),
        action('max', 'wave', 24, 1.62),
        action('max', 'smile', 28, 2),
    ],
    'phone': [
        {'id': str(uuid4()), 'characterId': 'max', 'type': 'take-out', 'start': 8, 'duration': 0.6, 'hand': 'left'},
        {'id': str(uuid4()), 'characterId': 'max', 'type': 'hold', 'start': 8.7, 'duration': 0.8},
        {'id': str(uuid4()), 'characterId': 'max', 'type': 'tap', 'start': 9.7, 'duration': 1.2},
        {'id': str(uuid4()), 'characterId': 'max', 'type': 'communicate', 'start': 11.2, 'duration': 3, 'message': "I'm hungry!", 'symbol': 'food', 'position': 'above-right', 'clipId': str(uuid4()), 'assetId': a('device-hungry')},
        {'id': str(uuid4()), 'characterId': 'max', 'type': 'put-away', 'start': 16, 'duration': 0.6},
    ],
    'audio': [
        clip(a('narrator-breakfast-a'), 0.5, 14.24, 0.8, 'narrator'),
        clip(a('device-hungry'), 11.4, 1.38, 0.85, None),
        clip(a('narrator-breakfast-b'), 16, 8.25, 0.8, 'narrator'),
    ],
})

# Scene 4 — Bright Stars.
scenes.append({
    'name': '4. Bright Stars',
    'duration': 23,
    'placeId': 'living-room',
    'characters': {'max': {'x': 836, 'y': 790}},
    'actions': [
        action('max', 'appear', 0, 0, {'x': 836, 'y': 790}),
        action('max', 'wave', 1, 1.62),
        action('max', 'clap', 5, 1),
        action('max', 'smile', 8, 2),
        action('max', 'wave', 13, 1.62),
        action('max', 'react', 18, 0.8),
    ],
    'audio': [clip(a('narrator-stars'), 0.5, 19.04, 0.8, 'narrator')],
})

# Scene 5 — Playing Together.
scenes.append({
    'name': '5. Playing Together',
    'duration': 26,
    'placeId': 'garden',
    'characters': {'max': {'x': 600, 'y': 790}, 'maxine': {'x': 1130, 'y': 790}},
    'actions': [
        action('max', 'appear', 0, 0, {'x': 600, 'y': 790}),
        action('maxine', 'appear', 0, 0, {'x': 1130, 'y': 790}),
        action('maxine', 'walk', 1, 3, {'x': 900, 'y': 790}),
        action('maxine', 'wave', 5, 1.62),
        action('max', 'wave', 7, 1.62),
        action('max', 'walk', 10, 3, {'x': 750, 'y': 790}),
        action('maxine', 'nod', 14, 1),
        action('max', 'wave', 17, 1.62),
        action('maxine', 'wave', 19, 1.62),
        action('maxine', 'react', 22, 0.8),
    ],
    'audio': [
        clip(a('narrator-garden'), 0.5, 20.99, 0.8, 'narrator'),
        clip(a('maxine-fun'), 14.5, 1.66, 0.85, 'maxine'),
    ],
})

# Scene 6 — Goodbye for Now.
scenes.append({
    'name': '6. Goodbye for Now',
    'duration': 21,
    'placeId': 'place-6189910b-10a4-402e-a18a-baa07de18f69',
    'characters': {'max': {'x': 700, 'y': 790}, 'maxine': {'x': 970, 'y': 790}},
    'actions': [
        action('max', 'appear', 0, 0, {'x': 700, 'y': 790}),
        action('maxine', 'appear', 0, 0, {'x': 970, 'y': 790}),
        action('max', 'breathe', 1, 4),
        action('maxine', 'wave', 5, 1.62),
        action('max', 'wave', 7, 1.62),
        action('maxine', 'nod', 11, 1),
        action('max', 'wave', 14, 1.62),
        action('maxine', 'wave', 16, 1.62),
    ],
    'audio': [
        clip(a('narrator-goodbye'), 0.5, 16.48, 0.8, 'narrator'),
        clip(a('maxine-goodnight'), 13.5, 1.64, 0.85, 'maxine'),
    ],
})

# Add gentle looping music underneath each scene when a music asset exists.
if music_id:
    for scene in scenes:
        for start in [0, 13.4]:
            if start + 13.4 <= scene['duration']:
                scene.setdefault('audio', []).append(clip(music_id, start, 13.4, 0.14))

# Add sparkle effect to Bright Stars scene when effect asset exists.
if effect_id:
    scenes[3].setdefault('audio', []).append(clip(effect_id, 6, 1.2, 0.22))

# Preserve existing scene IDs and assign rebuilt data.
old_scenes = {s['name']: s for s in backup['timedScenes']['scenes']}
new_timed_scenes = []
for spec in scenes:
    old = old_scenes.get(spec['name'])
    scene_id = old['id'] if old else str(uuid4())
    new_timed_scenes.append({
        'id': scene_id,
        'name': spec['name'],
        'duration': spec['duration'],
        'placeId': spec['placeId'],
        'characters': spec['characters'],
        'actions': spec['actions'],
        'audio': spec.get('audio', []),
        'phone': spec.get('phone', []),
        'phoneIn': None,
    })

backup['timedScenes'] = {'version': 1, 'scenes': new_timed_scenes}

# Rebuild intro with new music-aware duration estimate.
old_intro = backup['intros']['intros'][0]
backup['intros'] = {'version': 1, 'intros': [{
    **old_intro,
    'duration': 10,
    'characters': {'max': {'x': 836, 'y': 790}},
    'actions': [
        action('max', 'appear', 0, 0, {'x': 836, 'y': 790}),
        action('max', 'wave', 2, 1.62),
        action('max', 'smile', 5, 2),
    ],
    'audio': ([clip(music_id, 0, 10, 0.18)] if music_id else []),
}]}

# Rebuild credits — remove provisional wording, add Maxine voice mention.
old_credits = backup['credits']['credits'][0]
backup['credits'] = {'version': 1, 'credits': [{
    **old_credits,
    'lines': [
        {'id': str(uuid4()), 'heading': 'BrightTales', 'name': 'Meet Max', 'role': 'Episode 1'},
        {'id': str(uuid4()), 'heading': 'Characters', 'name': 'Max and Maxine', 'role': 'Native2D Brightlings'},
        {'id': str(uuid4()), 'heading': 'Narration', 'name': 'Lily', 'role': 'British voice'},
        {'id': str(uuid4()), 'heading': 'Maxine', 'name': 'Emma', 'role': 'British voice'},
        {'id': str(uuid4()), 'heading': 'Made with', 'name': 'BrightTales Studio', 'role': 'BrightSenApps'},
    ],
    'audio': ([clip(music_id, 0, 12, 0.18)] if music_id else []),
}]}

# Rebuild episode references.
old_episode = backup['episodes']['episodes'][0]
backup['episodes'] = {'version': 1, 'episodes': [{
    **old_episode,
    'name': 'Meet Max — Episode 1 V2',
    'sceneIds': [s['id'] for s in new_timed_scenes],
    'audio': [],
}]}

# Replace audio assets.
backup['audioAssets'] = audio_assets
from datetime import datetime, timezone
now = datetime.now(timezone.utc)
backup['createdAt'] = now.strftime('%Y-%m-%dT%H:%M:%S.') + f'{now.microsecond // 1000:03d}Z'

OUT_BACKUP.write_text(json.dumps(backup), encoding='utf-8')
print(f'Wrote V2 backup: {OUT_BACKUP}')
print(f'Scenes: {len(new_timed_scenes)}, audio assets: {len(audio_assets)}')
for s in new_timed_scenes:
    print(f'  {s["name"]}: {s["duration"]}s, {len(s["actions"])} actions, {len(s.get("audio", []))} audio clips')

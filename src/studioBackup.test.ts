import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOURS, LIBRARY_KEY, type Brightling } from './maker';
import { DEFAULT_SCENE, STORAGE_KEY } from './scene';
import { addPlace, DEFAULT_PLACE_ORGANISATION, PLACE_FOLDERS_KEY, removePlace, setPlaceArtwork } from './placeFolders';
import { createStudioBackup, recoverStudioRestore, RESTORE_JOURNAL_KEY, restoreStudioBackup, validateStudioBackup } from './studioBackup';
import { EPISODES_KEY } from './episodes';
import { TIMED_SCENES_KEY, type TimedLibrary } from './timedScenes';
import { VOICE_SETTINGS_KEY, emptyVoiceSettings, BUILTIN_VOICE_PRESETS } from './voiceSettings';

const character: Brightling = { id: 'brightling-11111111-1111-4111-8111-111111111111', name: 'Charlie', template: 'male', ...DEFAULT_COLOURS.male };
const scene = structuredClone(DEFAULT_SCENE);
scene.characters[character.id] = { start: { x: 800, y: 780 }, destination: { x: 1000, y: 800 } };
const backup = createStudioBackup([character], scene, new Date('2026-10-16T12:00:00.000Z'));
const tinyWebp = 'data:image/webp;base64,UklGRjgAAABXRUJQVlA4ICwAAACQAQCdASoCAAIAAgA0JaACdLoAA5gA/vmTb/+QH/+QH/+QH/8gP+IXeyAwAA==';

class TestStorage {
  data = new Map<string, string>();
  failAt = 0;
  writes = 0;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (++this.writes === this.failAt) throw new Error('Storage write interrupted'); this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

describe('complete Studio Backup', () => {
  it('keeps phone interactions through a backup and restore without changing the schema', () => {
    const phoneScene: TimedLibrary = {
      version: 1,
      scenes: [{
        id: '22222222-2222-4222-8222-222222222222', name: 'Max asks for food', duration: 12, placeId: 'living-room',
        characters: { max: { x: 700, y: 790 } },
        actions: [{ id: '33333333-3333-4333-8333-333333333333', characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 700, y: 790 } }],
        phoneIn: 'right',
        phone: [
          { id: '44444444-4444-4444-8444-444444444444', characterId: 'max', type: 'take-out', start: 0.6, duration: 0.55, hand: 'right' },
          { id: '55555555-5555-4555-8555-555555555555', characterId: 'max', type: 'communicate', start: 3.4, duration: 3, message: "I'm hungry!", symbol: 'food', position: 'above-right' },
        ],
      }],
    };
    const storage = new TestStorage();
    const made = createStudioBackup([], DEFAULT_SCENE, new Date('2026-10-18T12:00:00.000Z'), DEFAULT_PLACE_ORGANISATION, phoneScene);
    const checked = validateStudioBackup(made);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.backup.version).toBe(8);
    expect(checked.backup.timedScenes?.scenes[0].phone).toHaveLength(2);
    expect(checked.backup.timedScenes?.scenes[0].phoneIn).toBe('right');
    storage.setItem(TIMED_SCENES_KEY, JSON.stringify({ version: 1, scenes: [] }));
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, checked.backup).ok).toBe(true);
    const restored = JSON.parse(storage.getItem(TIMED_SCENES_KEY)!) as TimedLibrary;
    expect(restored.scenes[0].phone?.[1]).toMatchObject({ type: 'communicate', message: "I'm hungry!", symbol: 'food' });
  });

  it('restores voice defaults and presets in Backup v8 while preserving settings for old backups', () => {
    const settings = emptyVoiceSettings();
    settings.presets.push({ id: '11111111-1111-4111-8111-111111111111', name: 'Cartoon', effect: BUILTIN_VOICE_PRESETS[1].effect });
    settings.defaults.max = { voice: 'piper:en_GB-alan-medium', presetId: settings.presets[0].id };
    const complete = createStudioBackup([], DEFAULT_SCENE, new Date('2026-10-18T12:00:00.000Z'), DEFAULT_PLACE_ORGANISATION, undefined, undefined, undefined, undefined, undefined, undefined, settings);
    expect(validateStudioBackup(complete).ok).toBe(true);
    expect(validateStudioBackup({ ...complete, voiceSettings: { ...settings, presets: [{ ...settings.presets[0], effect: { ...settings.presets[0].effect, speed: 9 } }] } }).ok).toBe(false);
    const storage = new TestStorage();
    storage.data.set(VOICE_SETTINGS_KEY, 'old settings');
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, complete).ok).toBe(true);
    expect(JSON.parse(storage.getItem(VOICE_SETTINGS_KEY)!)).toEqual(settings);
    const { voiceSettings: _voiceSettings, ...legacy } = complete;
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, legacy).ok).toBe(true);
    expect(JSON.parse(storage.getItem(VOICE_SETTINGS_KEY)!)).toEqual(settings);
  });
  it('includes audio metadata and rejects missing clip assets or malformed audio bytes', () => {
    const audioId = '33333333-3333-4333-8333-333333333333';
    const asset = { id: audioId, name: 'Bell', kind: 'effect' as const, mime: 'audio/wav', duration: 1, size: 2, data: 'AAAA', sha256: '0'.repeat(64) };
    const timed = { version: 1 as const, scenes: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Scene', duration: 10, placeId: 'living-room', characters: {}, actions: [], audio: [{ id: '44444444-4444-4444-8444-444444444444', assetId: audioId, start: 1, trimStart: 0, trimEnd: 1, volume: .5, fadeIn: 0, fadeOut: 0 }] }] };
    const withAudio = createStudioBackup([], DEFAULT_SCENE, new Date('2026-10-16T12:00:00.000Z'), DEFAULT_PLACE_ORGANISATION, timed, { version: 1, episodes: [] }, [asset]);
    expect(validateStudioBackup(withAudio).ok).toBe(true);
    expect(validateStudioBackup({ ...withAudio, audioAssets: [] }).ok).toBe(false);
    expect(validateStudioBackup({ ...withAudio, audioAssets: [{ ...asset, data: '@@@@' }] }).ok).toBe(false);
    expect(validateStudioBackup({ ...withAudio, version: 4, audioAssets: undefined }).ok).toBe(false);
  });
  it('preserves character dialogue and episode narration in a version 5 backup', () => {
    const audioId = '33333333-3333-4333-8333-333333333333';
    const line = { id: '44444444-4444-4444-8444-444444444444', assetId: audioId, start: 2, trimStart: 0, trimEnd: 2, volume: .8, fadeIn: 0, fadeOut: 0, speakerId: 'max' };
    const narrator = { ...line, id: '55555555-5555-4555-8555-555555555555', start: 8, speakerId: 'narrator' };
    const timed = { version: 1 as const, scenes: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Hello', duration: 10, placeId: 'living-room', characters: { max: { x: 600, y: 790 } }, actions: [], audio: [line] }] };
    const episodes = { version: 1 as const, episodes: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Speech', sceneIds: [timed.scenes[0].id], audio: [narrator] }] };
    const asset = { id: audioId, name: 'Recorded voice', kind: 'speech' as const, mime: 'audio/wav', duration: 2, size: 2, data: 'AQI=', sha256: 'a'.repeat(64) };
    const result = validateStudioBackup(createStudioBackup([], DEFAULT_SCENE, new Date('2026-10-17T12:00:00.000Z'), DEFAULT_PLACE_ORGANISATION, timed, episodes, [asset]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.timedScenes?.scenes[0].audio?.[0].speakerId).toBe('max');
      expect(result.backup.episodes?.episodes[0].audio?.[0].speakerId).toBe('narrator');
    }
    const tooLate = createStudioBackup([], DEFAULT_SCENE, new Date('2026-10-17T12:00:00.000Z'), DEFAULT_PLACE_ORGANISATION, timed, { ...episodes, episodes: [{ ...episodes.episodes[0], audio: [{ ...narrator, start: 9 }] }] }, [asset]);
    expect(validateStudioBackup(tooLate).ok).toBe(false);
  });
  it('opens a version 4 episode backup without audio', () => {
    const { audioAssets: _audioAssets, ...older } = backup;
    const result = validateStudioBackup({ ...older, version: 4 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.audioAssets).toBeNull();
  });
  it('restores episodes and referenced timed scenes together, with stable IDs', () => {
    const timed: TimedLibrary = { version: 1, scenes: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Hello', duration: 10, placeId: 'living-room', characters: {}, actions: [] }] };
    const episodes = { version: 1 as const, episodes: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Episode', sceneIds: [timed.scenes[0].id, timed.scenes[0].id] }] };
    const complete = createStudioBackup([character], scene, new Date('2026-10-16T12:00:00.000Z'), DEFAULT_PLACE_ORGANISATION, timed, episodes);
    const storage = new TestStorage();
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, complete).ok).toBe(true);
    expect(JSON.parse(storage.getItem(TIMED_SCENES_KEY)!)).toEqual(timed);
    expect(JSON.parse(storage.getItem(EPISODES_KEY)!)).toEqual(episodes);
    expect(validateStudioBackup({ ...complete, timedScenes: { version: 1, scenes: [] } }).ok).toBe(true); // Missing scene stays repairable by ID.
    expect(validateStudioBackup({ ...complete, episodes: { version: 1, episodes: [{ ...episodes.episodes[0], sceneIds: ['not-an-id'] }] } }).ok).toBe(false);
  });
  it('rolls back an interrupted episode restore and keeps older backups compatible', () => {
    const storage = new TestStorage();
    storage.data.set(EPISODES_KEY, 'old episodes'); storage.data.set(TIMED_SCENES_KEY, 'old timed scenes');
    storage.failAt = 6;
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, backup).ok).toBe(false);
    expect(storage.getItem(EPISODES_KEY)).toBe('old episodes');
    expect(storage.getItem(TIMED_SCENES_KEY)).toBe('old timed scenes');
    const older = { ...backup, version: 3, episodes: undefined };
    expect(validateStudioBackup(older).ok).toBe(true);
    storage.failAt = 0;
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, older as never).ok).toBe(true);
    expect(storage.getItem(EPISODES_KEY)).toBe('old episodes');
  });
  it('preserves identity, colours, scene references and positions', () => {
    expect(validateStudioBackup(JSON.parse(JSON.stringify(backup)))).toEqual({ ok: true, backup });
    const storage = new TestStorage();
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, backup).ok).toBe(true);
    expect(JSON.parse(storage.getItem(LIBRARY_KEY)!)).toEqual([character]);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(scene);
    expect(JSON.parse(storage.getItem(PLACE_FOLDERS_KEY)!)).toEqual(DEFAULT_PLACE_ORGANISATION);
    expect(storage.getItem(RESTORE_JOURNAL_KEY)).toBeNull();
  });
  it('rejects corrupt, unsupported and orphaned scene data before writing', () => {
    expect(validateStudioBackup({ ...backup, version: 99 }).ok).toBe(false);
    expect(validateStudioBackup({ ...backup, createdAt: 'yesterday' }).ok).toBe(false);
    expect(validateStudioBackup({ ...backup, characters: [{ ...character, name: 'Max' }] }).ok).toBe(false);
    expect(validateStudioBackup({ ...backup, characters: [] }).ok).toBe(false);
    expect(validateStudioBackup({ ...backup, scene: { ...scene, characters: { ...scene.characters, bad: scene.characters.max } } }).ok).toBe(false);
    expect(validateStudioBackup({ ...backup, scene: { ...scene, characters: { ...scene.characters, max: { ...scene.characters.max, start: { x: -10, y: 790 } } } } }).ok).toBe(false);
    expect(validateStudioBackup({ ...backup, places: { ...backup.places, assignments: { ...backup.places.assignments, bedroom: 'missing-folder' } } }).ok).toBe(false);
    const storage = new TestStorage();
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, { ...backup, version: 99 } as never).ok).toBe(false);
    expect(storage.data.size).toBe(0);
  });
  it('rolls back all three keys after a failed write', () => {
    for (const failAt of [1, 2, 3, 4, 5]) {
      const storage = new TestStorage();
      storage.data.set(LIBRARY_KEY, 'old library'); storage.data.set(STORAGE_KEY, 'old scene'); storage.data.set(PLACE_FOLDERS_KEY, 'old places');
      storage.failAt = failAt;
      expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, backup).ok).toBe(false);
      expect(storage.getItem(LIBRARY_KEY)).toBe('old library');
      expect(storage.getItem(STORAGE_KEY)).toBe('old scene');
      expect(storage.getItem(PLACE_FOLDERS_KEY)).toBe('old places');
      expect(recoverStudioRestore(storage, LIBRARY_KEY, STORAGE_KEY).ok).toBe(true);
    }
  });
  it('recovers an interrupted pending restore on restart', () => {
    const storage = new TestStorage();
    storage.data.set(LIBRARY_KEY, 'old library'); storage.data.set(STORAGE_KEY, 'old scene');
    storage.data.set(RESTORE_JOURNAL_KEY, JSON.stringify({ version: 1, phase: 'pending', before: { library: 'old library', scene: 'old scene' } }));
    storage.data.set(LIBRARY_KEY, JSON.stringify([character]));
    expect(recoverStudioRestore(storage, LIBRARY_KEY, STORAGE_KEY).ok).toBe(true);
    expect(storage.getItem(LIBRARY_KEY)).toBe('old library');
    expect(storage.getItem(STORAGE_KEY)).toBe('old scene');
  });
  it('recovers pending folder writes and accepts older backups without folder data', () => {
    const storage = new TestStorage();
    storage.data.set(LIBRARY_KEY, 'old library'); storage.data.set(STORAGE_KEY, 'old scene'); storage.data.set(PLACE_FOLDERS_KEY, 'old places');
    storage.data.set(RESTORE_JOURNAL_KEY, JSON.stringify({ version: 2, phase: 'pending', before: { library: 'old library', scene: 'old scene', places: 'old places' } }));
    storage.data.set(PLACE_FOLDERS_KEY, 'partial folders');
    expect(recoverStudioRestore(storage, LIBRARY_KEY, STORAGE_KEY).ok).toBe(true);
    expect(storage.getItem(PLACE_FOLDERS_KEY)).toBe('old places');
    const { places: _places, ...legacy } = backup;
    const result = validateStudioBackup({ ...legacy, version: 1 });
    expect(result.ok && result.backup.places).toEqual(DEFAULT_PLACE_ORGANISATION);
  });
  it('accepts an older Max and Maxine scene and restores a backup without a saved scene', () => {
    expect(validateStudioBackup({ ...backup, characters: [], scene: DEFAULT_SCENE }).ok).toBe(true);
    const storage = new TestStorage(); storage.data.set(STORAGE_KEY, JSON.stringify(scene));
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, { ...backup, scene: null }).ok).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('backs up custom places and deleted default places with their folder assignments', () => {
    const placeId = 'place-11111111-1111-4111-8111-111111111111';
    const places = removePlace(setPlaceArtwork(addPlace(DEFAULT_PLACE_ORGANISATION, placeId, 'Treehouse', 'park')!, placeId, tinyWebp)!, 'garden')!;
    const customBackup = createStudioBackup([character], scene, new Date('2026-10-16T12:00:00.000Z'), places);
    expect(validateStudioBackup(JSON.parse(JSON.stringify(customBackup)))).toEqual({ ok: true, backup: customBackup });
    const storage = new TestStorage();
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, customBackup).ok).toBe(true);
    expect(JSON.parse(storage.getItem(PLACE_FOLDERS_KEY)!)).toEqual(places);
  });
  it('accepts earlier version 2 backups containing folders but no custom-place fields', () => {
    const { customPlaces: _customPlaces, removedDefaultPlaceIds: _removedDefaultPlaceIds, ...olderPlaces } = DEFAULT_PLACE_ORGANISATION;
    const checked = validateStudioBackup({ ...backup, places: olderPlaces });
    expect(checked.ok && checked.backup.places).toEqual(DEFAULT_PLACE_ORGANISATION);
  });
});

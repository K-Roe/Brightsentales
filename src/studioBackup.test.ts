import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOURS, LIBRARY_KEY, type Brightling } from './maker';
import { DEFAULT_SCENE, STORAGE_KEY } from './scene';
import { addPlace, DEFAULT_PLACE_ORGANISATION, PLACE_FOLDERS_KEY, removePlace, setPlaceArtwork } from './placeFolders';
import { createStudioBackup, recoverStudioRestore, RESTORE_JOURNAL_KEY, restoreStudioBackup, validateStudioBackup } from './studioBackup';

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

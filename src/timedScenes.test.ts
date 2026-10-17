import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENE, STORAGE_KEY, WIDTH } from './scene';
import { DEFAULT_COLOURS, LIBRARY_KEY, type Brightling } from './maker';
import { createStudioBackup, restoreStudioBackup, validateStudioBackup } from './studioBackup';
import { advanceSceneTime, decodeTimedLibrary, EMPTY_TIMED_LIBRARY, pruneTimedScenes, stateAt, TIMED_SCENES_KEY, validateTimedLibrary, type TimedScene } from './timedScenes';

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const scene: TimedScene = {
  id: id(1), name: 'Hello', duration: 30, placeId: 'living-room',
  characters: { max: { x: -100, y: 780 }, maxine: { x: 900, y: 820 } },
  actions: [
    { id: id(2), characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: -100, y: 780 } },
    { id: id(3), characterId: 'max', type: 'walk', start: 0, duration: 3, point: { x: 700, y: 780 } },
    { id: id(4), characterId: 'max', type: 'wait', start: 3, duration: 5 },
    { id: id(5), characterId: 'max', type: 'wave', start: 8, duration: 2 },
    { id: id(6), characterId: 'max', type: 'walk', start: 24, duration: 6, point: { x: 1800, y: 780 } },
    { id: id(7), characterId: 'max', type: 'disappear', start: 30, duration: 0 },
    { id: id(8), characterId: 'maxine', type: 'appear', start: 1, duration: 0, point: { x: 900, y: 820 } },
    { id: id(9), characterId: 'maxine', type: 'wave', start: 2, duration: 2 },
  ],
};

describe('timed scene schedule', () => {
  it('advances by elapsed time even when a browser frame arrives late', () => {
    expect(advanceSceneTime(10, 1.4, 30)).toBe(11.4);
    expect(advanceSceneTime(29.5, 1.4, 30)).toBe(30);
    expect(advanceSceneTime(5, -1, 30)).toBe(5);
  });
  it('seeks deterministically through appear, walk, wait, wave and exit', () => {
    expect(stateAt(scene, 'max', 0).visible).toBe(true);
    expect(stateAt(scene, 'max', 0).point.x).toBe(-100);
    expect(stateAt(scene, 'max', 1.5).point.x).toBeGreaterThan(200);
    expect(stateAt(scene, 'max', 1.5).pose).toBe('side');
    expect(stateAt(scene, 'max', 3).point.x).toBe(700);
    expect(stateAt(scene, 'max', 6).point.x).toBe(700);
    expect(stateAt(scene, 'max', 8.4).pose).toBe('wave');
    expect(stateAt(scene, 'max', 10).pose).toBe('idle');
    expect(stateAt(scene, 'max', 28).point.x).toBeGreaterThan(700);
    expect(stateAt(scene, 'max', 29.5).point.x).toBeGreaterThan(WIDTH);
    expect(stateAt(scene, 'max', 30).visible).toBe(false);
    expect(stateAt(scene, 'max', 15)).toEqual(stateAt(scene, 'max', 15));
    expect(stateAt(scene, 'maxine', 0).visible).toBe(false);
    expect(stateAt(scene, 'maxine', 2.5).pose).toBe('wave');
  });
  it('handles leftward travel and overlapping separate characters, while rejecting same-character overlap', () => {
    const left = { ...scene, actions: [...scene.actions, { id: id(10), characterId: 'maxine', type: 'walk' as const, start: 5, duration: 2, point: { x: 200, y: 820 } }] };
    expect(validateTimedLibrary({ version: 1, scenes: [left] }).ok).toBe(true);
    expect(stateAt(left, 'maxine', 6).direction).toBe(-1);
    const conflict = { ...scene, actions: [...scene.actions, { id: id(11), characterId: 'max', type: 'walk' as const, start: 2, duration: 2, point: { x: 500, y: 780 } }] };
    expect(validateTimedLibrary({ version: 1, scenes: [conflict] }).ok).toBe(false);
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...scene, duration: 29 }] }).ok).toBe(false);
  });
  it('preserves scenes through save, backup and restore, while retaining older data', () => {
    const timed = { version: 1 as const, scenes: [scene] };
    expect(decodeTimedLibrary(JSON.stringify(timed))).toEqual({ ok: true, library: timed });
    expect(decodeTimedLibrary('{').ok).toBe(false);
    const backup = createStudioBackup([], DEFAULT_SCENE, new Date('2026-10-17T12:00:00.000Z'), undefined, timed);
    expect(validateStudioBackup(backup)).toEqual({ ok: true, backup });
    const data = new Map<string, string>([[STORAGE_KEY, JSON.stringify(DEFAULT_SCENE)]]);
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, backup).ok).toBe(true);
    expect(JSON.parse(data.get(TIMED_SCENES_KEY)!)).toEqual(timed);
    const older = { ...backup, version: 2 };
    expect(validateStudioBackup(older).ok).toBe(true);
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, older as never).ok).toBe(true);
    expect(JSON.parse(data.get(TIMED_SCENES_KEY)!)).toEqual(timed);
    expect(JSON.parse(data.get(STORAGE_KEY)!)).toEqual(DEFAULT_SCENE);
    expect(pruneTimedScenes(timed, []).scenes[0]).toEqual(scene);
    expect(EMPTY_TIMED_LIBRARY.scenes).toEqual([]);
  });
  it('rolls back timed scenes when a Studio restore write fails', () => {
    const timed = { version: 1 as const, scenes: [scene] };
    const backup = createStudioBackup([], DEFAULT_SCENE, new Date(), undefined, timed);
    const data = new Map<string, string>([[TIMED_SCENES_KEY, 'old timed scenes']]);
    let writes = 0;
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { if (++writes === 5) throw Error('failed'); data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, backup).ok).toBe(false);
    expect(data.get(TIMED_SCENES_KEY)).toBe('old timed scenes');
  });
  it('keeps valid custom Brightling references in backups and prunes deleted characters', () => {
    const custom: Brightling = { id: `brightling-${id(12)}`, name: 'Charlie', template: 'male', ...DEFAULT_COLOURS.male };
    const withCustom: TimedScene = { ...scene, characters: { ...scene.characters, [custom.id]: { x: 1100, y: 780 } }, actions: [...scene.actions, { id: id(13), characterId: custom.id, type: 'appear', start: 0, duration: 0, point: { x: 1100, y: 780 } }] };
    const timed = { version: 1 as const, scenes: [withCustom] };
    expect(validateTimedLibrary(timed).ok).toBe(true);
    expect(validateStudioBackup(createStudioBackup([custom], DEFAULT_SCENE, new Date(), undefined, timed)).ok).toBe(true);
    expect(validateStudioBackup(createStudioBackup([], DEFAULT_SCENE, new Date(), undefined, timed)).ok).toBe(false);
    const pruned = pruneTimedScenes(timed, []);
    expect(pruned.scenes[0].characters[custom.id]).toBeUndefined();
    expect(pruned.scenes[0].actions.some(action => action.characterId === custom.id)).toBe(false);
  });
});

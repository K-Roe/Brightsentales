import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENE, STORAGE_KEY, WIDTH } from './scene';
import { DEFAULT_COLOURS, LIBRARY_KEY, type Brightling } from './maker';
import { createStudioBackup, restoreStudioBackup, validateStudioBackup } from './studioBackup';
import { advanceSceneTime, decodeTimedLibrary, EMPTY_TIMED_LIBRARY, gentleWalkProgress, gestureFrameAt, gestureFramesForScene, objectAt, pruneTimedScenes, stateAt, TIMED_SCENES_KEY, validateTimedLibrary, type TimedScene } from './timedScenes';

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
  it('eases an opted-in walk and holds authored attention without changing legacy walks', () => {
    const performance: TimedScene = { ...scene, duration: 6, characters: { max: { x: 500, y: 790 }, maxine: { x: 1050, y: 790 } }, actions: [
      { id: id(90), characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 500, y: 790 } },
      { id: id(91), characterId: 'maxine', type: 'appear', start: 0, duration: 0, point: { x: 1050, y: 790 } },
      { id: id(92), characterId: 'max', type: 'walk', start: .5, duration: 2, point: { x: 850, y: 790 }, motion: 'gentle' },
      { id: id(93), characterId: 'maxine', type: 'look-at', target: 'max', start: .6, duration: 2.5 },
      { id: id(94), characterId: 'max', type: 'wave', start: 3, duration: 1.5 },
    ] };
    expect(validateTimedLibrary({ version: 1, scenes: [performance] }).ok).toBe(true);
    expect(gentleWalkProgress(.1, 2)).toBeLessThan(.05);
    expect(gentleWalkProgress(1, 2)).toBeCloseTo(.5125);
    expect(gentleWalkProgress(2, 2)).toBe(1);
    expect(stateAt(performance, 'max', 2.5).point.x).toBe(850);
    expect(stateAt(performance, 'max', 2.7).pose).toBe('side');
    expect(stateAt(performance, 'maxine', 1).pose).toBe('side');
    expect(stateAt(performance, 'maxine', 3.2).direction).toBe(-1);
    expect(stateAt(performance, 'max', 4.7).pose).toBe('idle');
    expect(stateAt(performance, 'max', 1.2)).toEqual(stateAt(performance, 'max', 1.2));
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...performance, actions: performance.actions.map(action => action.type === 'look-at' ? { ...action, target: 'maxine' as const } : action) }] }).ok).toBe(false);
  });
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
  it('keeps simultaneous walks on their own durations and uses a relaxed travel-matched cycle', () => {
    const simultaneous: TimedScene = { ...scene, duration: 6, characters: { max: { x: 500, y: 780 }, maxine: { x: 500, y: 780 } }, actions: [
      { id: id(120), characterId: 'max', type: 'walk', start: 0, duration: 1, point: { x: 700, y: 780 } },
      { id: id(121), characterId: 'maxine', type: 'walk', start: 0, duration: 5, point: { x: 1500, y: 780 } },
    ] };
    const max = stateAt(simultaneous, 'max', .5);
    const maxine = stateAt(simultaneous, 'maxine', .5);
    expect(max.pose).toBe('side');
    expect(maxine.pose).toBe('side');
    expect(max.point.x).toBeGreaterThan(maxine.point.x);
    expect(max.frame).not.toBe(maxine.frame);
    expect(stateAt(simultaneous, 'max', 1).pose).toBe('idle');
    expect(stateAt(simultaneous, 'max', 1).expression).toBeUndefined();
    expect(stateAt(simultaneous, 'maxine', 1).pose).toBe('side');
    expect(stateAt(simultaneous, 'maxine', 5).pose).toBe('idle');
  });
  it('sequences walk, wave, jump and excited bounce on the existing scene timeline', () => {
    const actions: TimedScene['actions'] = [
      { id: id(21), characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 500, y: 780 } },
      { id: id(22), characterId: 'max', type: 'walk', start: 0, duration: 2, point: { x: 750, y: 780 } },
      { id: id(23), characterId: 'max', type: 'wave', start: 2, duration: 2 },
      { id: id(24), characterId: 'max', type: 'jump', start: 4, duration: 1 },
      { id: id(25), characterId: 'max', type: 'excited', start: 5, duration: 1.5 },
    ];
    const sequence: TimedScene = { ...scene, characters: { max: { x: 500, y: 780 } }, actions };
    expect(validateTimedLibrary({ version: 1, scenes: [sequence] }).ok).toBe(true);
    expect(stateAt(sequence, 'max', 1).pose).toBe('side');
    expect(stateAt(sequence, 'max', 2.4).pose).toBe('wave');
    expect(stateAt(sequence, 'max', 4).expression?.offsetY ?? 0).toBe(0);
    expect(stateAt(sequence, 'max', 4.47).expression?.offsetY).toBeLessThan(-100);
    expect(stateAt(sequence, 'max', 5).expression?.offsetY ?? 0).toBeCloseTo(0);
    expect(stateAt(sequence, 'max', 5.4).expression?.anchor).toBe('foot');
    expect(stateAt(sequence, 'max', 5.375).expression?.offsetY).toBeLessThan(-30);
    expect(stateAt(sequence, 'max', 5.75).expression?.offsetY).toBeCloseTo(0);
    expect(stateAt(sequence, 'max', 6.5).expression).toBeUndefined();
    expect(stateAt(sequence, 'max', 6.5).point).toEqual({ x: 750, y: 780 });
    expect(decodeTimedLibrary(JSON.stringify({ version: 1, scenes: [sequence] })).ok).toBe(true);
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...sequence, actions: [...actions, { id: id(26), characterId: 'max', type: 'jump', start: 4.5, duration: 1 }] }] }).ok).toBe(false);
  });
  it('selects registered whole frames and keeps legacy saved gestures unchanged', () => {
    const actions: TimedScene['actions'] = [
      { id: id(40), characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 500, y: 780 } },
      { id: id(41), characterId: 'max', type: 'point', start: 0, duration: 1, artwork: 'provisional-v1' },
      { id: id(42), characterId: 'max', type: 'clap', start: 1, duration: 1, artwork: 'provisional-v1' },
      { id: id(43), characterId: 'max', type: 'nod', start: 2, duration: 1, artwork: 'provisional-v1' },
      { id: id(44), characterId: 'max', type: 'shake', start: 3, duration: 1, artwork: 'provisional-v1' },
    ];
    const demo: TimedScene = { ...scene, duration: 4, characters: { max: { x: 500, y: 780 } }, actions };
    expect(validateTimedLibrary({ version: 1, scenes: [demo] }).ok).toBe(true);
    expect(gestureFramesForScene(demo, 'max')).toEqual(['point', 'clap-open', 'clap-contact', 'nod-down', 'shake-left', 'shake-right']);
    expect(stateAt(demo, 'max', 0).gestureFrame).toBeUndefined();
    expect(stateAt(demo, 'max', 0.5).gestureFrame).toBe('point');
    expect(stateAt(demo, 'max', 1.15).gestureFrame).toBe('clap-open');
    expect(stateAt(demo, 'max', 1.25).gestureFrame).toBe('clap-contact');
    expect(stateAt(demo, 'max', 2.25).gestureFrame).toBe('nod-down');
    expect(stateAt(demo, 'max', 3.2).gestureFrame).toBe('shake-left');
    expect(stateAt(demo, 'max', 3.5).gestureFrame).toBe('shake-right');
    expect(stateAt(demo, 'max', 4).gestureFrame).toBeUndefined();
    expect(gestureFrameAt('nod', 0, 1)).toBeUndefined();
    expect(decodeTimedLibrary(JSON.stringify({ version: 1, scenes: [demo] })).ok).toBe(true);
    const legacy = { ...demo, actions: actions.map(action => ({ ...action, artwork: undefined })) };
    expect(stateAt(legacy, 'max', 0.5).gestureFrame).toBeUndefined();
    expect(stateAt(legacy, 'max', 0.5).expression?.rotate).toBeDefined();
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...demo, actions: [{ ...actions[1], characterId: 'maxine' }] }] }).ok).toBe(false);
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...demo, actions: [{ ...actions[1], artwork: 'unknown' }] }] }).ok).toBe(false);
  });
  it('holds a grounded seated pose until standing and resumes walking at the same floor point', () => {
    const seated: TimedScene = { ...scene, characters: { max: { x: 800, y: 790 } }, actions: [
      { id: id(60), characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 800, y: 790 } },
      { id: id(61), characterId: 'max', type: 'sit-down', start: 0, duration: 1.5, artwork: 'provisional-v1', seat: 'chair' },
      { id: id(62), characterId: 'max', type: 'stand-up', start: 4, duration: 1.5, artwork: 'provisional-v1', seat: 'chair' },
      { id: id(63), characterId: 'max', type: 'walk', start: 5.5, duration: 2, point: { x: 1000, y: 790 } },
    ] };
    expect(validateTimedLibrary({ version: 1, scenes: [seated] }).ok).toBe(true);
    expect(stateAt(seated, 'max', .65).gestureFrame).toBe('sit-lowering');
    expect(stateAt(seated, 'max', 2.5).gestureFrame).toBe('sit-seated');
    expect(stateAt(seated, 'max', 4.1).gestureFrame).toBe('sit-seated');
    expect(stateAt(seated, 'max', 5.5).point).toEqual({ x: 800, y: 790 });
    expect(stateAt(seated, 'max', 5.5).gestureFrame).toBeUndefined();
    expect(stateAt(seated, 'max', 7.5).point).toEqual({ x: 1000, y: 790 });
    expect(decodeTimedLibrary(JSON.stringify({ version: 1, scenes: [seated] })).ok).toBe(true);
    const withoutStand = { ...seated, actions: seated.actions.filter(action => action.type !== 'stand-up') };
    expect(validateTimedLibrary({ version: 1, scenes: [withoutStand] }).ok).toBe(false);
    const sofa = { ...seated, actions: seated.actions.map(action => action.type === 'sit-down' || action.type === 'stand-up' ? { ...action, seat: 'sofa' as const } : action) };
    expect(validateTimedLibrary({ version: 1, scenes: [sofa] })).toMatchObject({ ok: false });
  });
  it('keeps a toy on the floor, attaches it to the hand, carries it while walking, and releases it', () => {
    const ball = id(70);
    const sequence: TimedScene = { ...scene, characters: { maxine: { x: 900, y: 790 } }, objects: [{ id: ball, kind: 'toy-ball', point: { x: 828, y: 790 } }], actions: [
      { id: id(71), characterId: 'maxine', type: 'appear', start: 0, duration: 0, point: { x: 900, y: 790 } },
      { id: id(72), characterId: 'maxine', type: 'pick-up', start: 1, duration: 1.5, artwork: 'provisional-v1', objectId: ball },
      { id: id(73), characterId: 'maxine', type: 'walk', start: 2.5, duration: 3, point: { x: 1100, y: 790 } },
      { id: id(74), characterId: 'maxine', type: 'put-down', start: 6, duration: 1.5, artwork: 'provisional-v1', objectId: ball, point: { x: 1028, y: 790 } },
      { id: id(75), characterId: 'maxine', type: 'wave', start: 7.5, duration: 2 },
    ] };
    expect(validateTimedLibrary({ version: 1, scenes: [sequence] }).ok).toBe(true);
    expect(objectAt(sequence, ball, 0)?.point).toEqual({ x: 828, y: 773 });
    expect(stateAt(sequence, 'maxine', 1.6).gestureFrame).toBe('object-reach');
    expect(objectAt(sequence, ball, 2)?.phase).toBe('lift');
    expect(stateAt(sequence, 'maxine', 3).pose).toBe('side');
    expect(objectAt(sequence, ball, 4)?.heldBy).toBe('maxine');
    expect(objectAt(sequence, ball, 7)?.phase).toBe('lower');
    expect(objectAt(sequence, ball, 8)?.point).toEqual({ x: 1028, y: 773 });
    expect(objectAt(sequence, ball, 8)?.heldBy).toBeNull();
    expect(stateAt(sequence, 'maxine', 8).pose).toBe('wave');
    expect(decodeTimedLibrary(JSON.stringify({ version: 1, scenes: [sequence] })).ok).toBe(true);
    expect(validateStudioBackup(createStudioBackup([], DEFAULT_SCENE, new Date('2026-10-21T12:00:00.000Z'), undefined, { version: 1, scenes: [sequence] })).ok).toBe(true);
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...sequence, actions: sequence.actions.filter(action => action.type !== 'pick-up') }] }).ok).toBe(false);
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...sequence, objects: [{ id: ball, kind: 'toy-ball', point: { x: 500, y: 790 } }] }] }).ok).toBe(false);
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

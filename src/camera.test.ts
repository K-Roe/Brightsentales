import { describe, expect, it } from 'vitest';
import { cameraAt } from './camera';
import { validateTimedLibrary, type TimedScene } from './timedScenes';
import { HEIGHT, WIDTH } from './scene';

const scene: TimedScene = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Camera', duration: 13, placeId: 'living-room', characters: { max: { x: 400, y: 790 }, maxine: { x: 1200, y: 790 } }, actions: [
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 400, y: 790 } },
  { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', characterId: 'maxine', type: 'appear', start: 0, duration: 0, point: { x: 1200, y: 790 } },
  { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', characterId: 'max', type: 'walk', start: 0.5, duration: 2, point: { x: 650, y: 790 } },
] };
const key = (id: string, shot: 'wide' | 'medium' | 'close-up' | 'custom', focus: 'max' | 'maxine' | 'point', start: number, duration: number) => ({ id, shot, focus, start, duration, ...(focus === 'point' ? { point: { x: WIDTH / 2, y: HEIGHT / 2 } } : {}) });

describe('camera clock', () => {
  it('keeps scenes without camera data wide and validates their old format', () => {
    expect(cameraAt(scene, 8)).toEqual({ x: WIDTH / 2, y: HEIGHT / 2, zoom: 1 });
    expect(validateTimedLibrary({ version: 1, scenes: [scene] }).ok).toBe(true);
  });
  it('eases between shots and follows the existing walk clock', () => {
    const withCamera: TimedScene = { ...scene, camera: [key('11111111-1111-4111-8111-111111111111', 'medium', 'max', 3, 2), { ...key('22222222-2222-4222-8222-222222222222', 'close-up', 'maxine', 7, 2), follow: true }, key('33333333-3333-4333-8333-333333333333', 'wide', 'point', 11, 2)] };
    expect(validateTimedLibrary({ version: 1, scenes: [withCamera] }).ok).toBe(true);
    expect(cameraAt(withCamera, 3)).toEqual(cameraAt(scene, 3));
    expect(cameraAt(withCamera, 4).zoom).toBeCloseTo(1.2);
    expect(cameraAt(withCamera, 5).x).toBeCloseTo(650);
    expect(cameraAt(withCamera, 9).zoom).toBe(2.7);
    expect(cameraAt(withCamera, 13)).toEqual(cameraAt(scene, 13));
    const following: TimedScene = { ...scene, camera: [{ ...key('55555555-5555-4555-8555-555555555555', 'medium', 'max', 0, 0), follow: true }] };
    expect(cameraAt(following, 2.4).x).toBeGreaterThan(cameraAt(following, 1).x);
  });
  it('rejects overlapping and invalid camera keyframes without changing character actions', () => {
    const camera = [key('11111111-1111-4111-8111-111111111111', 'medium', 'max', 3, 2), key('22222222-2222-4222-8222-222222222222', 'wide', 'point', 4, 1)];
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...scene, camera }] }).ok).toBe(false);
    expect(scene.actions).toHaveLength(3);
    const fast = { ...scene, camera: [{ ...key('44444444-4444-4444-8444-444444444444', 'close-up', 'point', 3, .6), point: { x: WIDTH, y: HEIGHT } }] };
    expect(validateTimedLibrary({ version: 1, scenes: [fast] }).ok).toBe(false);
  });
  it('supports a custom shot zoom and any Brightling present in the scene', () => {
    const custom = { ...key('66666666-6666-4666-8666-666666666666', 'custom', 'maxine', 0, 0), zoom: 3.2 };
    const withCustom: TimedScene = { ...scene, camera: [custom] };
    expect(validateTimedLibrary({ version: 1, scenes: [withCustom] }).ok).toBe(true);
    expect(cameraAt(withCustom, 2).zoom).toBe(3.2);
    expect(cameraAt(withCustom, 2).x).toBeCloseTo(1200);
    const noZoom = { ...custom, zoom: undefined };
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...scene, camera: [noZoom] }] }).ok).toBe(false);
    const strayZoom = { ...key('77777777-7777-4777-8777-777777777777', 'medium', 'max', 0, 0), zoom: 2 };
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...scene, camera: [strayZoom] }] }).ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { blinkAt, lifeMotionAt } from './cartoonLife';
import { stateAt, validateTimedLibrary, type TimedScene } from './timedScenes';

const base: TimedScene = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Life', duration: 12, placeId: 'living-room', characters: { max: { x: 500, y: 790 } }, actions: [
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 500, y: 790 } },
  { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', characterId: 'max', type: 'walk', start: 4, duration: 2, point: { x: 790, y: 790 } },
  { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', characterId: 'max', type: 'wave', start: 8, duration: 1.7 },
] };

describe('opt-in Cartoon Life timing', () => {
  it('leaves legacy scenes and their animation states untouched', () => {
    expect(validateTimedLibrary({ version: 1, scenes: [base] }).ok).toBe(true);
    expect(lifeMotionAt(base, 'max', 2, stateAt(base, 'max', 2), false)).toBeNull();
    expect(stateAt({ ...base, life: { enabled: true } }, 'max', 4.8)).toEqual(stateAt(base, 'max', 4.8));
  });
  it('uses deterministic, small motion and rests; pauses while waving or holding Bright Speak', () => {
    const scene: TimedScene = { ...base, life: { enabled: true, ambience: true } };
    expect(validateTimedLibrary({ version: 1, scenes: [scene] }).ok).toBe(true);
    const idle = lifeMotionAt(scene, 'max', 1, stateAt(scene, 'max', 1), false)!;
    expect(idle).toEqual(lifeMotionAt(scene, 'max', 1, stateAt(scene, 'max', 1), false));
    expect(idle.scaleY).toBeGreaterThan(1);
    expect(idle.scaleY).toBeLessThan(1.01);
    expect(lifeMotionAt(scene, 'max', 3.2, stateAt(scene, 'max', 3.2), false)?.scaleY).toBe(1);
    expect(lifeMotionAt(scene, 'max', 8.4, stateAt(scene, 'max', 8.4), false)).toBeNull();
    expect(lifeMotionAt(scene, 'max', 1, stateAt(scene, 'max', 1), true)).toBeNull();
  });
  it('adds anticipation and walk motion without altering the approved action clock', () => {
    const scene: TimedScene = { ...base, life: { enabled: true } };
    const prepare = lifeMotionAt(scene, 'max', 3.9, stateAt(scene, 'max', 3.9), false)!;
    expect(prepare.scaleY).toBeLessThan(1);
    const walk = lifeMotionAt(scene, 'max', 4.7, stateAt(scene, 'max', 4.7), false)!;
    expect(walk.offsetY).toBeGreaterThanOrEqual(-2.2);
    expect(walk.offsetY).toBeLessThanOrEqual(0);
  });
  it('uses sparse, repeatable blinks with different character phases', () => {
    expect(blinkAt('max', 2.35)).toBe(true);
    expect(blinkAt('max', 2.8)).toBe(false);
    expect(blinkAt('maxine', 2.35)).toBe(false);
    expect(blinkAt('max', 8.05)).toBe(true);
  });
});

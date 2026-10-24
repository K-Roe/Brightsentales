import { describe, expect, it } from 'vitest';
import foundation from '../proofs/max-maxine-greeting-v3/foundation-scene.json';
import previous from '../proofs/max-maxine-greeting-v2/greeting-scene.json';
import { greetingV3WalkProgress, stateAt, validateTimedLibrary } from './timedScenes';

describe('Greeting V3 renderer foundation', () => {
  const checked = validateTimedLibrary(foundation);
  if (!checked.ok) throw Error(checked.error);
  const scene = checked.library.scenes[0];

  it('eases toward a grounded stop while maintaining inward orientation', () => {
    for (const id of ['max', 'maxine']) {
      const near = stateAt(scene, id, 2.65);
      const later = stateAt(scene, id, 2.82);
      const last = stateAt(scene, id, 2.98);
      const stopped = stateAt(scene, id, 3);
      expect([near, later, last, stopped].every(state => state.pose === 'side' && state.greetingV3 && state.point.y === 790)).toBe(true);
      expect([near, later, last, stopped].every(state => state.direction === (id === 'max' ? 1 : -1))).toBe(true);
      const remaining = (state: typeof near) => Math.abs(stopped.point.x - state.point.x);
      expect(remaining(last)).toBeLessThan(remaining(later));
      expect(remaining(later)).toBeLessThan(remaining(near));
      expect(remaining(last)).toBeLessThan(1);
      expect(stopped.point.x).toBe(id === 'max' ? 690 : 980);
      expect(stateAt(scene, id, 4.2).point).toEqual(stopped.point);
    }
    expect(greetingV3WalkProgress(0, 2.39)).toBe(0);
    expect(greetingV3WalkProgress(2.39, 2.39)).toBe(1);
    expect(greetingV3WalkProgress(2.39 - .01, 2.39) - greetingV3WalkProgress(2.39 - .02, 2.39))
      .toBeLessThan(greetingV3WalkProgress(1, 2.39) - greetingV3WalkProgress(.99, 2.39));
  });

  it('limits the unfinished V3 marker to walks and leaves V2 evaluation unchanged', () => {
    const invalid = structuredClone(foundation);
    invalid.scenes[0].actions[2].type = 'wave';
    expect(validateTimedLibrary(invalid).ok).toBe(false);
    const prior = validateTimedLibrary(previous);
    if (!prior.ok) throw Error(prior.error);
    const old = stateAt(prior.library.scenes[0], 'max', 2.9);
    expect(old.greetingV3).toBe(false);
    expect(old.point.x).toBeCloseTo(350 + 340 * (2.9 - .5 - .11) / (2.5 - .11));
  });
});

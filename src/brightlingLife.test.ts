import { describe, expect, it } from 'vitest';
import { blinkMoments, characterLifeAt, independentBlinkAt } from './brightlingLife';
import { stateAt, validateTimedLibrary, type TimedScene } from './timedScenes';

const scene: TimedScene = {
  id: '77777777-7777-4777-8777-777777777777', name: 'Independent life', duration: 20, placeId: 'living-room',
  characters: { max: { x: 450, y: 790 }, maxine: { x: 1100, y: 790 }, 'brightling-88888888-8888-4888-8888-888888888888': { x: 800, y: 790 } },
  actions: [
    { id: '77777777-7777-4777-8777-777777777771', characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 450, y: 790 } },
    { id: '77777777-7777-4777-8777-777777777772', characterId: 'maxine', type: 'appear', start: 0, duration: 0, point: { x: 1100, y: 790 } },
    { id: '77777777-7777-4777-8777-777777777773', characterId: 'max', type: 'walk', start: 5, duration: 3, point: { x: 720, y: 790 } },
    { id: '77777777-7777-4777-8777-777777777774', characterId: 'maxine', type: 'wave', start: 10, duration: 1.7 },
  ], life: { enabled: true, mode: 'v2' },
};

describe('independent Brightling Life controller', () => {
  it('keeps legacy and V1 scene data valid', () => {
    expect(validateTimedLibrary({ version: 1, scenes: [scene] }).ok).toBe(true);
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...scene, life: { enabled: true } }] }).ok).toBe(true);
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...scene, life: { enabled: true, mode: 'v3' } }] }).ok).toBe(false);
  });
  it('gives each character a distinct stable schedule including occasional doubles', () => {
    const max = [...blinkMoments('max', 150)];
    const maxine = [...blinkMoments('maxine', 150)];
    const future = [...blinkMoments('brightling-88888888-8888-4888-8888-888888888888', 150)];
    expect(max).not.toEqual(maxine);
    expect(maxine).not.toEqual(future);
    expect(max.some((at, index) => index && at - max[index - 1] < .4)).toBe(true);
    expect(maxine.some((at, index) => index && at - maxine[index - 1] < .4)).toBe(true);
    expect(independentBlinkAt('max', max[0] + .05)).toBe(true);
    expect([...blinkMoments('max', 20)].slice(0, max.length)).toEqual(max);
  });
  it('keeps the life channels active around approved actions and phone holding', () => {
    for (const time of [2, 5.7, 10.5, 14]) {
      const id = time === 10.5 ? 'maxine' : 'max';
      const result = characterLifeAt(scene, id, time, stateAt(scene, id, time), time === 14);
      expect(result).toEqual(characterLifeAt(scene, id, time, stateAt(scene, id, time), time === 14));
      expect(result.breathY).toBeGreaterThanOrEqual(.992);
      expect(result.breathY).toBeLessThanOrEqual(1.005);
      expect(result.lift).toBeGreaterThanOrEqual(-1.5);
      expect(result.lift).toBeLessThanOrEqual(1.5);
    }
    expect(stateAt(scene, 'max', 6.2)).toEqual(stateAt({ ...scene, life: undefined }, 'max', 6.2));
  });
});

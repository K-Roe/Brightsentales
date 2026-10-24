import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { livingWorldAt } from './livingWorld';
import { pruneTimedScenes, stateAt, validateTimedLibrary, type TimedLibrary } from './timedScenes';
import { blinkMoments, independentBlinkAt } from './brightlingLife';

const library = JSON.parse(readFileSync(new URL('../proofs/living-world-v1/demo-scenes.json', import.meta.url), 'utf8')) as TimedLibrary;
const [on, off] = library.scenes;

describe('Living World V1', () => {
  it('validates an opt-in Living Room scene and leaves existing scenes valid', () => {
    expect(validateTimedLibrary(library).ok).toBe(true);
    expect(validateTimedLibrary({ version: 1, scenes: [off] }).ok).toBe(true);
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...on, placeId: 'garden' }] }, ['living-room', 'garden']).ok).toBe(false);
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...on, livingWorld: { enabled: true, preferences: { max: { activity: 2, curiosity: .5, sociability: .5 } } } }] }).ok).toBe(false);
    const custom = 'brightling-88888888-8888-4888-8888-888888888888';
    const withPreferences = { ...on, characters: { ...on.characters, [custom]: { x: 820, y: 790 } }, livingWorld: { enabled: true as const, preferences: { [custom]: { activity: .5, curiosity: .5, sociability: .5 } } } };
    expect(validateTimedLibrary({ version: 1, scenes: [withPreferences] }).ok).toBe(true);
    expect(pruneTimedScenes({ version: 1, scenes: [withPreferences] }, []).scenes[0].livingWorld?.preferences).toEqual({});
  });
  it('is deterministic under seeking and never changes the OFF baseline', () => {
    const times = [0, 2, 4.3, 7.5, 9.99, 10, 12.5, 15, 15.5, 16.7, 20, 24, 29.9];
    const forward = times.map(time => livingWorldAt(on, 'max', time));
    expect([...times].reverse().map(time => livingWorldAt(on, 'max', time)).reverse()).toEqual(forward);
    for (const time of times) for (const id of ['max', 'maxine']) expect(livingWorldAt(off, id, time).state).toEqual(stateAt(off, id, time));
  });
  it('gives the director the exact scripted state and returns to anchors without jumps', () => {
    for (let time = 10; time < 15; time += .1) expect(livingWorldAt(on, 'max', time).state).toEqual(stateAt(on, 'max', time));
    for (let time = 15; time < 16.7; time += .1) expect(livingWorldAt(on, 'maxine', time).state).toEqual(stateAt(on, 'maxine', time));
    for (const [id, time] of [['max', 10], ['max', 15], ['maxine', 15], ['maxine', 16.7]] as const) {
      const before = livingWorldAt(on, id, time - .001).state.point;
      const at = livingWorldAt(on, id, time).state.point;
      expect(Math.hypot(before.x - at.x, before.y - at.y)).toBeLessThan(2);
    }
  });
  it('keeps independent motion within the safe floor and separated from family members', () => {
    let maxMoved = false, maxineMoved = false, maxMovedAfter = false, maxineMovedAfter = false;
    for (let step = 0; step < 300; step++) {
      const time = step / 10;
      const max = livingWorldAt(on, 'max', time).state;
      const maxine = livingWorldAt(on, 'maxine', time).state;
      for (const state of [max, maxine]) {
        expect(state.point.x).toBeGreaterThanOrEqual(310);
        expect(state.point.x).toBeLessThanOrEqual(1360);
        expect(state.point.y).toBeGreaterThanOrEqual(760);
        expect(state.point.y).toBeLessThanOrEqual(815);
      }
      expect(Math.hypot(max.point.x - maxine.point.x, max.point.y - maxine.point.y)).toBeGreaterThanOrEqual(225);
      if (time < 10 && Math.abs(max.point.x - 440) > 20) maxMoved = true;
      if (time < 10 && Math.abs(maxine.point.x - 1160) > 20) maxineMoved = true;
      if (time > 20 && Math.abs(max.point.x - 750) > 20) maxMovedAfter = true;
      if (time > 20 && Math.abs(maxine.point.x - 1160) > 20) maxineMovedAfter = true;
    }
    expect([maxineMoved, maxMovedAfter, maxineMovedAfter]).toEqual([true, true, true]);
    expect(maxMoved).toBe(false); // Max's longer quiet observation is part of his calmer preference.
    const blink = blinkMoments('max', 30).find(at => at > 10 && at < 15);
    expect(blink).toBeDefined();
    expect(independentBlinkAt('max', blink! + .05)).toBe(true);
  });
  it('keeps a directed phone hold in control and supports a custom Brightling seed', () => {
    const phoneLibrary = JSON.parse(readFileSync(new URL('../proofs/brightling-life-v2/demo-scenes.json', import.meta.url), 'utf8')) as TimedLibrary;
    const withPhone = { ...phoneLibrary.scenes[0], livingWorld: { enabled: true as const } };
    expect(validateTimedLibrary({ version: 1, scenes: [withPhone] }).ok).toBe(true);
    expect(livingWorldAt(withPhone, 'maxine', 11).state).toEqual(stateAt(withPhone, 'maxine', 11));
    const id = 'brightling-88888888-8888-4888-8888-888888888888';
    const custom = { ...on, characters: { ...on.characters, [id]: { x: 820, y: 790 } }, actions: [...on.actions, { id: 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b105', characterId: id, type: 'appear' as const, start: 0, duration: 0, point: { x: 820, y: 790 } }] };
    expect(validateTimedLibrary({ version: 1, scenes: [custom] }).ok).toBe(true);
    expect(livingWorldAt(custom, id, 7)).toEqual(livingWorldAt(custom, id, 7));
  });
});

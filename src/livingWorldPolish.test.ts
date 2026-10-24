import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { livingWorldAt } from './livingWorld';
import { stateAt, validateTimedLibrary, type TimedLibrary } from './timedScenes';

const library = JSON.parse(readFileSync(new URL('../proofs/living-world-v1-1/demo-scenes.json', import.meta.url), 'utf8')) as TimedLibrary;
const [polished, baseline] = library.scenes;
const pointGap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('Living World V1.1 polish', () => {
  it('keeps V1 valid and rejects unknown behaviour versions', () => {
    expect(validateTimedLibrary(library).ok).toBe(true);
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...polished, livingWorld: { enabled: true, mode: 'v2' } }] }).ok).toBe(false);
    expect(livingWorldAt(baseline, 'maxine', 12)).toEqual(livingWorldAt(structuredClone(baseline), 'maxine', 12));
  });
  it('is stable when seeking and gives the director exact priority', () => {
    const times = [0, 4, 8, 12, 16.999, 17, 19, 20.999, 21, 26.999, 27, 27.5, 28.699, 28.7, 35, 44.9];
    const first = times.map(time => livingWorldAt(polished, 'maxine', time));
    expect([...times].reverse().map(time => livingWorldAt(polished, 'maxine', time)).reverse()).toEqual(first);
    for (let time = 17; time < 21; time += .1) expect(livingWorldAt(polished, 'max', time).state).toEqual(stateAt(polished, 'max', time));
    for (let time = 27; time < 28.7; time += .1) expect(livingWorldAt(polished, 'maxine', time).state).toEqual(stateAt(polished, 'maxine', time));
    for (const [id, time] of [['max', 17], ['max', 21], ['maxine', 27], ['maxine', 28.7]] as const) {
      expect(pointGap(livingWorldAt(polished, id, time - .001).state.point, livingWorldAt(polished, id, time).state.point), `${id} at ${time}`).toBeLessThan(2);
    }
  });
  it('keeps the room calm and the family separated over the full episode', () => {
    const counts = { quiet: 0, active: 0, baselineActive: 0, approaches: 0 };
    for (let frame = 0; frame < 450; frame++) {
      const time = frame / 10;
      const max = livingWorldAt(polished, 'max', time);
      const maxine = livingWorldAt(polished, 'maxine', time);
      for (const item of [max, maxine]) {
        expect(item.state.point.x).toBeGreaterThanOrEqual(310);
        expect(item.state.point.x).toBeLessThanOrEqual(1360);
        if (item.autonomous && (item.activity === 'rest' || item.activity === 'observe')) counts.quiet++;
        if (['explore', 'approach', 'return'].includes(item.activity)) counts.active++;
        if (item.activity === 'approach') counts.approaches++;
      }
      for (const id of ['max', 'maxine']) if (['explore', 'approach', 'return'].includes(livingWorldAt(baseline, id, time).activity)) counts.baselineActive++;
      expect(pointGap(max.state.point, maxine.state.point)).toBeGreaterThanOrEqual(255);
    }
    expect(counts.quiet).toBeGreaterThan(600);
    expect(counts.active).toBeLessThan(counts.baselineActive);
    expect(counts.active).toBeGreaterThan(20);
    expect(counts.approaches).toBeGreaterThan(0);
  });
});

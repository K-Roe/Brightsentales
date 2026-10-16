import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { directionTo, FRAME_DISTANCE, frameForDistance } from './walking';

describe('directional walking', () => {
  it('turns toward travel and retains facing for vertical movement', () => {
    const start = { x: 600, y: 750 };
    expect(directionTo(start, { x: 900, y: 750 }, -1)).toBe(1);
    expect(directionTo(start, { x: 300, y: 750 }, 1)).toBe(-1);
    expect(directionTo(start, { x: 600, y: 800 }, -1)).toBe(-1);
  });

  it('cycles four poses according to distance travelled', () => {
    expect([0, 1, 2, 3, 4, 5].map(n => frameForDistance(n * FRAME_DISTANCE))).toEqual([1, 2, 3, 4, 1, 2]);
  });

  it('provides four distinct, equally sized V3 full-body sprites per character', () => {
    for (const character of ['max', 'maxine']) {
      const frames = [1, 2, 3, 4].map(index => readFileSync(new URL(`../public/art/${character}-side-v3-${index}.png`, import.meta.url)));
      for (const frame of frames) {
        expect(frame.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(frame.readUInt32BE(16)).toBe(560);
        expect(frame.readUInt32BE(20)).toBe(724);
      }
      expect(new Set(frames.map(frame => frame.toString('base64'))).size).toBe(4);
    }
  });
});

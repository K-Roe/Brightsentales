import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { WAVE_DURATION_MS, WAVE_FRAME_MS, WAVE_SEQUENCE, waveFrameAt } from './wave';

describe('wave animation', () => {
  it('raises the arm, waves twice and returns to exact idle', () => {
    expect(WAVE_SEQUENCE).toEqual([0, 1, 2, 3, 2, 3, 2, 1, 0]);
    expect(waveFrameAt(0)).toBe(0);
    expect(waveFrameAt(2 * WAVE_FRAME_MS)).toBe(2);
    expect(waveFrameAt(WAVE_DURATION_MS - 1)).toBe(0);
    expect(waveFrameAt(WAVE_DURATION_MS)).toBeNull();
  });

  it('provides three transparent full-body frames at a consistent size', () => {
    for (const character of ['max', 'maxine']) {
      const frames = [1, 2, 3].map(index => readFileSync(new URL(`../public/art/${character}-wave-${index}.png`, import.meta.url)));
      for (const frame of frames) {
        expect(frame.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(frame.readUInt32BE(16)).toBe(500);
        expect(frame.readUInt32BE(20)).toBe(724);
      }
      expect(new Set(frames.map(frame => frame.toString('base64'))).size).toBe(3);
    }
  });
});

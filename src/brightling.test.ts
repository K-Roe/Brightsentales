import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generateBrightlingFrames, OLIVER_SPEC, SAMPLE_VARIATION_SPEC, validateBrightlingSpec } from './brightling';
import { FRAME_DISTANCE, frameForDistance } from './walking';
import { WAVE_SEQUENCE } from './wave';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('deterministic Brightling generator', () => {
  it('validates identity, colours, styles and seed', () => {
    expect(validateBrightlingSpec(OLIVER_SPEC)).toEqual(OLIVER_SPEC);
    expect(() => validateBrightlingSpec({ ...OLIVER_SPEC, id: '../max' })).toThrow();
    expect(() => validateBrightlingSpec({ ...OLIVER_SPEC, bodyColour: 'green' })).toThrow();
    expect(() => validateBrightlingSpec({ ...OLIVER_SPEC, hairStyle: 'unknown' as typeof OLIVER_SPEC.hairStyle })).toThrow();
    expect(() => validateBrightlingSpec({ ...OLIVER_SPEC, seed: -1 })).toThrow();
  });

  it('regenerates identical frames and produces a different character from the same templates', () => {
    const first = generateBrightlingFrames(OLIVER_SPEC);
    expect(generateBrightlingFrames({ ...OLIVER_SPEC })).toEqual(first);
    const second = generateBrightlingFrames(SAMPLE_VARIATION_SPEC);
    expect(digest(second)).not.toBe(digest(first));
    expect(generateBrightlingFrames({ ...OLIVER_SPEC, seed: OLIVER_SPEC.seed! + 1 }).idle).not.toBe(first.idle);
    expect(second.idle).toContain(SAMPLE_VARIATION_SPEC.clothingColour);
    expect(first.idle).toContain(OLIVER_SPEC.clothingColour);
  });

  it('supplies compatible front, four distinct walking frames and three wave poses', () => {
    const frames = generateBrightlingFrames(OLIVER_SPEC);
    expect(frames.side).toHaveLength(5);
    expect(frames.wave).toHaveLength(3);
    expect(new Set(frames.side.slice(1))).toHaveProperty('size', 4);
    expect(new Set(frames.wave)).toHaveProperty('size', 3);
    expect([0, 1, 2, 3].map(i => frames.side[frameForDistance(i * FRAME_DISTANCE)])).toEqual(frames.side.slice(1));
    expect(WAVE_SEQUENCE.map(frame => frame ? frames.wave[frame - 1] : frames.idle)).toHaveLength(9);
    for (const frame of [frames.idle, ...frames.side, ...frames.wave]) {
      expect(frame).toContain('<svg ');
      expect(frame).toContain(OLIVER_SPEC.bodyColour);
      expect(frame).toContain(OLIVER_SPEC.hairColour);
      expect(frame).toContain(OLIVER_SPEC.clothingColour);
      expect(frame).not.toContain('/art/max');
    }
  });
});

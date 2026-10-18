import { describe, expect, it } from 'vitest';
import { beginnerPitchName, pitchInScale } from './musicGuidance';

describe('beginner music guidance', () => {
  it('names natural pitches, enharmonic spellings and middle C', () => {
    expect(beginnerPitchName(60)).toBe('C4');
    expect(beginnerPitchName(61)).toBe('C♯4 / D♭4');
    expect(beginnerPitchName(71)).toBe('B4');
  });
  it('guides without restricting chromatic pitches', () => {
    expect(pitchInScale(60, 'C major')).toBe(true);
    expect(pitchInScale(61, 'C major')).toBe(false);
    expect(pitchInScale(66, 'G major')).toBe(true);
    expect(pitchInScale(70, 'F major')).toBe(true);
    expect(pitchInScale(69, 'A minor')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { physicalPoseAt } from './physicalRig';

describe('experimental standing rig clock', () => {
  it('returns the same pose when frames are sought out of order', () => {
    const times = [0, 1.25, 5.8, 12.5, 17.9];
    const forward = times.map(time => physicalPoseAt('max', time, false));
    const reverse = times.slice().reverse().map(time => physicalPoseAt('max', time, false)).reverse();
    expect(reverse).toEqual(forward);
  });

  it('keeps physical channels gentle and leaves blink independently composable', () => {
    let breathing = false, posture = false, head = false, pauses = false;
    for (let frame = 0; frame <= 18 * 24; frame++) {
      const time = frame / 24;
      const pose = physicalPoseAt('max', time, false);
      expect(pose.breath).toBeGreaterThanOrEqual(0);
      expect(pose.breath).toBeLessThanOrEqual(1);
      expect(Math.abs(pose.lean)).toBeLessThanOrEqual(1);
      expect(Math.abs(pose.headAngle)).toBeLessThanOrEqual(.55);
      breathing ||= pose.breath > .5;
      posture ||= Math.abs(pose.lean) > .5;
      head ||= Math.abs(pose.headAngle) > .2;
      pauses ||= pose.breath === 0 && pose.lean === 0;
      expect(physicalPoseAt('max', time, true)).toEqual({ ...pose, blink: true });
    }
    expect([breathing, posture, head, pauses]).toEqual([true, true, true, true]);
  });
});

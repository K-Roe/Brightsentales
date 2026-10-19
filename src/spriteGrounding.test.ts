import { describe, expect, it } from 'vitest';
import { footAnchor, footDrop, SOURCE_SIZE } from './spriteGrounding';

describe('sprite grounding', () => {
  it('provides measured foot anchors for all approved sprites', () => {
    for (const character of ['max', 'maxine'] as const) {
      expect(footAnchor(character, 'idle', 0).y).toBeGreaterThan(0.85);
      expect(footAnchor(character, 'idle', 0).y).toBeLessThan(1);
      for (let frame = 0; frame <= 4; frame++) {
        expect(footAnchor(character, 'side', frame).y).toBeGreaterThan(0.85);
        expect(footAnchor(character, 'side', frame).y).toBeLessThan(1);
      }
      for (let frame = 1; frame <= 3; frame++) {
        expect(footAnchor(character, 'wave', frame).y).toBeGreaterThan(0.85);
        expect(footAnchor(character, 'wave', frame).y).toBeLessThan(1);
      }
    }
  });

  it('drops the sprite so the measured foot touches the floor', () => {
    const displayHeight = 355;
    const maxIdle = footAnchor('max', 'idle', 0);
    const drop = footDrop('idle', maxIdle.y, displayHeight);
    // The sprite bottom was at displayHeight; the foot was above by (1 - y) * displayHeight.
    // The drop should equal that gap, moving the foot down to the floor.
    expect(drop).toBeCloseTo((1 - maxIdle.y) * displayHeight, 1);
    expect(drop).toBeGreaterThan(0);
  });

  it('uses moving source size for side and wave poses', () => {
    expect(footDrop('side', 0.95, 355)).toBeCloseTo(355 - 0.95 * SOURCE_SIZE.moving.height * (355 / SOURCE_SIZE.moving.height), 1);
  });
});

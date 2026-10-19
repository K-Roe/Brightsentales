import { Point } from './scene';

export type Direction = -1 | 1;
export type Motion = {
  direction: Direction;
  distance: number;
  turnUntil: number;
  stopUntil: number;
  moving: boolean;
};

export const WALK_SPEED = 235;
export const TURN_MS = 110;
export const STOP_MS = 110;
/** Legacy frame step distance kept for existing tests and procedural characters. */
export const FRAME_DISTANCE = 29;

/** Stride length in display pixels for one full walk cycle for the approved Native2D sprites.
 *  A cycle is two steps: left foot forward, then right foot forward.
 *  Tuned to the approved side sprites so feet appear to push off the ground
 *  rather than sliding across it.
 */
export const STRIDE_PX: Record<'max' | 'maxine', number> = { max: 56, maxine: 62 };

/** Number of frames in one full Native2D walk cycle. */
export const CYCLE_FRAMES = 4;

export function directionTo(from: Point, to: Point, previous: Direction): Direction {
  return Math.abs(to.x - from.x) < 1 ? previous : to.x > from.x ? 1 : -1;
}

/** Maps travelled distance to a side frame.
 *
 *  For the approved Native2D Max and Maxine sprites the cycle follows a repeating
 *  contact pattern: side-1 (right foot forward / contact), side-2 (passing),
 *  side-3 (left foot forward / contact), side-2 (passing). Frame 0 is the static
 *  side-standing pose and is only used at the very start of a walk.
 *
 *  For procedural characters the original 1-2-3-4 cycle is preserved.
 */
export function frameForDistance(characterIdOrDistance: string | number, distance?: number): number {
  // Legacy single-number call used by tests and procedural code.
  if (typeof characterIdOrDistance === 'number') {
    const d = characterIdOrDistance;
    return 1 + Math.floor(Math.max(0, d) / FRAME_DISTANCE) % 4;
  }
  const characterId = characterIdOrDistance;
  const d = distance ?? 0;
  if (d <= 0) return 0;
  if (characterId === 'max' || characterId === 'maxine') {
    const stride = STRIDE_PX[characterId] ?? 58;
    const phase = (d % stride) / stride;
    const frameIndex = Math.floor(phase * CYCLE_FRAMES);
    const cycle = [1, 2, 3, 2];
    return cycle[Math.max(0, Math.min(CYCLE_FRAMES - 1, frameIndex))];
  }
  // Legacy cycle for procedural/Oliver Brightlings.
  return 1 + Math.floor(Math.max(0, d) / FRAME_DISTANCE) % 4;
}

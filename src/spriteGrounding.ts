/** Measured foot anchors for approved Native2D sprites.
 *
 * Values are ratios in source-pixel space so they stay correct when a sprite is
 * drawn at any display size. The `y` ratio is the point on the sprite that
 * should sit on the floor. Drawing the sprite lower by `(1 - y) * displayHeight`
 * keeps shoes in contact with the ground during idle, wave and walking, and
 * removes the previous floating appearance caused by drawing every sprite from
 * its bottom edge.
 */

export type FootAnchor = { x: number; y: number };

const MAX_IDLE: FootAnchor = { x: 0.2765, y: 0.9461 };
const MAXINE_IDLE: FootAnchor = { x: 0.3134, y: 0.9171 };

const MAX_SIDE: FootAnchor[] = [
  { x: 0.4460, y: 0.9613 }, // side-0 standing
  { x: 0.3300, y: 0.9586 }, // side-1 right forward
  { x: 0.3100, y: 0.9448 }, // side-2 passing
  { x: 0.3440, y: 0.9503 }, // side-3 left forward
  { x: 0.3680, y: 0.9586 }, // side-4 transition
];

const MAXINE_SIDE: FootAnchor[] = [
  { x: 0.4920, y: 0.9351 }, // side-0 standing
  { x: 0.4140, y: 0.9365 }, // side-1 right forward
  { x: 0.4960, y: 0.9420 }, // side-2 passing
  { x: 0.4000, y: 0.9157 }, // side-3 left forward
  { x: 0.4460, y: 0.9157 }, // side-4 transition
];

const MAX_WAVE: FootAnchor[] = [
  { x: 0.3300, y: 0.9641 }, // wave-1
  { x: 0.3380, y: 0.9641 }, // wave-2
  { x: 0.3420, y: 0.9641 }, // wave-3
];

const MAXINE_WAVE: FootAnchor[] = [
  { x: 0.3280, y: 0.9710 }, // wave-1
  { x: 0.3320, y: 0.9710 }, // wave-2
  { x: 0.5980, y: 0.9738 }, // wave-3
];

export function footAnchor(characterId: 'max' | 'maxine', pose: 'idle' | 'side' | 'wave', frame: number): FootAnchor {
  if (characterId === 'max') {
    if (pose === 'idle') return MAX_IDLE;
    if (pose === 'side') return MAX_SIDE[Math.max(0, Math.min(4, frame))] ?? MAX_SIDE[0];
    return MAX_WAVE[Math.max(0, Math.min(2, frame - 1))] ?? MAX_WAVE[0];
  }
  if (pose === 'idle') return MAXINE_IDLE;
  if (pose === 'side') return MAXINE_SIDE[Math.max(0, Math.min(4, frame))] ?? MAXINE_SIDE[0];
  return MAXINE_WAVE[Math.max(0, Math.min(2, frame - 1))] ?? MAXINE_WAVE[0];
}

/** Source sizes used to convert ratios to display pixels. */
export const SOURCE_SIZE = {
  idle: { width: 434, height: 724 },
  moving: { width: 500, height: 724 },
};

/** Vertical offset to add to `top` so the measured foot touches the floor at `y`.
 *  Positive values move the sprite downward.
 */
export function footDrop(pose: 'idle' | 'side' | 'wave', anchorY: number, displayHeight: number): number {
  const sourceHeight = pose === 'idle' ? SOURCE_SIZE.idle.height : SOURCE_SIZE.moving.height;
  // The anchor is measured in source pixels; scale it to display height.
  const scaledAnchorY = anchorY * displayHeight;
  return displayHeight - scaledAnchorY;
}

/** Experimental standing-only layered rig. No production renderer imports it. */
export type LayerName = 'hidden-fill' | 'neck-back' | 'lower' | 'upper' | 'chest' | 'head';
export type RigGeometry = {
  width: number;
  height: number;
  neck: readonly [number, number];
  chest: readonly [number, number];
  waist: readonly [number, number];
};
export type StandingRig = {
  geometry: RigGeometry;
  motion: {
    upperLift: number;
    upperLean: number;
    chestLift: number;
    chestWidth: number;
    chestHeight: number;
    headAngleScale: number;
  };
  layers: Record<LayerName, HTMLImageElement>;
  blink?: { canvas: HTMLCanvasElement; x: number; y: number } | null;
};
export type PhysicalPose = {
  breath: number;
  lean: number;
  headAngle: number;
  headX: number;
  blink: boolean;
};

const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
const hash = (s: string) => { let n = 2166136261; for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; };
const random = (seed: number, index: number) => {
  let n = (seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  n ^= n >>> 16; n = Math.imul(n, 0x7feb352d); n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
};
function eventValue(time: number, start: number, duration: number): number {
  if (time < start || time >= start + duration) return 0;
  const t = time - start;
  return Math.min(smooth(t / .9), smooth((duration - t) / .9));
}

/** Absolute-time pose; compatible blink is supplied by the approved life channel. */
export function physicalPoseAt(id: string, time: number, blinking: boolean): PhysicalPose {
  const seed = hash(id);
  const period = 5.15 + random(seed, 5) * .7;
  const cycle = ((time + random(seed, 6) * 1.3) % period + period) % period;
  const breath = cycle < 1.5 ? smooth(cycle / 1.5)
    : cycle < 3.8 ? 1 - smooth((cycle - 1.5) / 2.3) : 0;
  let lean = 0, headAngle = 0, headX = 0, start = 4 + random(seed, 11) * 1.7;
  for (let i = 0; start < time + 4; i++) {
    const value = eventValue(time, start, 2.8 + random(seed, 30 + i) * .7);
    lean += (random(seed, 50 + i) < .5 ? -1 : 1) * value;
    start += 7.2 + random(seed, 70 + i) * 3.5;
  }
  start = 2.5 + random(seed, 101) * 2;
  for (let i = 0; start < time + 4; i++) {
    const value = eventValue(time, start, 2.3 + random(seed, 120 + i) * .6);
    const sign = random(seed, 140 + i) < .5 ? -1 : 1;
    headAngle += sign * .55 * value;
    headX += sign * .7 * value;
    start += 5.4 + random(seed, 160 + i) * 3.5;
  }
  return { breath, lean, headAngle, headX, blink: blinking };
}

function moved(context: CanvasRenderingContext2D, image: CanvasImageSource,
  pivot: readonly [number, number], x: number, y: number, angle = 0, sx = 1, sy = 1) {
  context.save();
  context.translate(pivot[0] + x, pivot[1] + y);
  context.rotate(angle * Math.PI / 180);
  context.scale(sx, sy);
  context.drawImage(image, -pivot[0], -pivot[1]);
  context.restore();
}

/** Source-pixel geometry; caller controls display scale and position. */
export function drawStandingRig(context: CanvasRenderingContext2D, rig: StandingRig, pose: PhysicalPose): void {
  const { layers, geometry, motion } = rig;
  const shoulderLift = -motion.upperLift * pose.breath;
  const torsoX = motion.upperLean * pose.lean;
  context.drawImage(layers['hidden-fill'], 0, 0);
  context.save();
  context.globalAlpha = Math.min(1, pose.breath * 3 + Math.abs(pose.lean) * 2 + Math.abs(pose.headAngle) * 3);
  context.drawImage(layers['neck-back'], 0, 0);
  context.restore();
  context.drawImage(layers.lower, 0, 0);
  moved(context, layers.upper, geometry.waist, torsoX, shoulderLift);
  moved(context, layers.chest, geometry.chest, torsoX, shoulderLift - motion.chestLift * pose.breath,
    0, 1 + motion.chestWidth * pose.breath, 1 + motion.chestHeight * pose.breath);
  const headX = 0;
  const headY = 0;
  const headAngle = -.08 * pose.lean + pose.headAngle * motion.headAngleScale;
  moved(context, layers.head, geometry.neck, headX, headY, headAngle);
  if (pose.blink && rig.blink) {
    context.save();
    context.translate(geometry.neck[0] + headX, geometry.neck[1] + headY);
    context.rotate(headAngle * Math.PI / 180);
    context.drawImage(rig.blink.canvas, rig.blink.x - geometry.neck[0], rig.blink.y - geometry.neck[1]);
    context.restore();
  }
}

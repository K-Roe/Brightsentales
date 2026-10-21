/** Isolated Max rig study. Nothing in Studio imports this module. */
const BASE = '/art/experimental/max-sit-v1/';
const SOURCE_WIDTH = 434;
const SOURCE_HEIGHT = 724;
// Last solid approved shoe row (the few pixels below are transparent fringe).
const FOOT_LINE = 684;
const CHAIR_FOOT_FRACTION = 1029 / 1080;

export type Vec2 = { x: number; y: number };
export type MaxRigAssets = Record<string, HTMLImageElement>;
export type SitPose = { amount: number; lean: number; phase: 'idle' | 'anticipation' | 'lowering' | 'seated' | 'rising' };

const names = [
  'head', 'hand-right', 'hand-left', 'upper-arm-right', 'upper-arm-left',
  'forearm-right', 'forearm-left', 'shoe-right', 'shoe-left', 'pelvis',
  'upper-leg-right', 'upper-leg-left', 'lower-leg-right', 'lower-leg-left',
  'torso', 'upper-leg-fill-right', 'lower-leg-fill-right',
  'upper-leg-fill-left', 'lower-leg-fill-left', 'arm-fill-right',
  'arm-fill-left', 'seated-thigh-right', 'seated-shin-right',
  'seated-thigh-left', 'seated-shin-left', 'chair-back', 'chair-front',
] as const;

const load = (name: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Could not load experimental asset ${name}`));
  image.src = `${BASE}${name}.png`;
});

export async function loadMaxRigAssets(): Promise<MaxRigAssets> {
  const images = await Promise.all(names.map(load));
  return Object.fromEntries(names.map((name, index) => [name, images[index]]));
}

const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export const CYCLE_SECONDS = 6.4;
export function sitPoseAt(time: number): SitPose {
  const t = Math.max(0, Math.min(CYCLE_SECONDS, time));
  if (t < 0.45) return { amount: 0, lean: 0, phase: 'idle' };
  if (t < 0.9) {
    const amount = .12 * ease((t - .45) / .45);
    return { amount, lean: -.05 * ease((t - .45) / .45), phase: 'anticipation' };
  }
  if (t < 2.2) {
    const amount = .12 + .88 * ease((t - .9) / 1.3);
    return { amount, lean: -.05 * Math.sin(Math.PI * (t - .9) / 1.3), phase: 'lowering' };
  }
  if (t < 3.7) return { amount: 1, lean: 0, phase: 'seated' };
  if (t < 5.35) {
    const amount = 1 - ease((t - 3.7) / 1.65);
    return { amount, lean: -.06 * Math.sin(Math.PI * (t - 3.7) / 1.65), phase: 'rising' };
  }
  return { amount: 0, lean: 0, phase: 'idle' };
}

const point = (x: number, y: number): Vec2 => ({ x, y });
const distance = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y);

/** Two fixed-length leg bones; the ankle is anchored to the approved shoe. */
export function kneeAt(hip: Vec2, ankle: Vec2, thighLength: number, shinLength: number, outward: -1 | 1): Vec2 {
  const dx = ankle.x - hip.x;
  const dy = ankle.y - hip.y;
  const rawDistance = Math.hypot(dx, dy);
  const d = Math.max(1e-5, Math.min(thighLength + shinLength - 1e-5, rawDistance));
  const along = (thighLength * thighLength - shinLength * shinLength + d * d) / (2 * d);
  const normal = Math.sqrt(Math.max(0, thighLength * thighLength - along * along));
  const ux = dx / Math.max(rawDistance, 1e-5);
  const uy = dy / Math.max(rawDistance, 1e-5);
  return point(hip.x + ux * along + outward * uy * normal, hip.y + uy * along - outward * ux * normal);
}

function rotate(pointToMove: Vec2, pivot: Vec2, angle: number): Vec2 {
  const dx = pointToMove.x - pivot.x;
  const dy = pointToMove.y - pivot.y;
  return point(pivot.x + dx * Math.cos(angle) - dy * Math.sin(angle), pivot.y + dx * Math.sin(angle) + dy * Math.cos(angle));
}

function drawPart(context: CanvasRenderingContext2D, assets: MaxRigAssets, name: string, sourcePivot: Vec2, targetPivot: Vec2, radians = 0, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;
  context.translate(targetPivot.x, targetPivot.y);
  context.rotate(radians);
  context.translate(-sourcePivot.x, -sourcePivot.y);
  context.drawImage(assets[name], 0, 0);
  context.restore();
}

function drawBone(context: CanvasRenderingContext2D, assets: MaxRigAssets, name: string, sourceStart: Vec2, sourceEnd: Vec2, targetStart: Vec2, targetEnd: Vec2, alpha = 1) {
  const sourceAngle = Math.atan2(sourceEnd.y - sourceStart.y, sourceEnd.x - sourceStart.x);
  const targetAngle = Math.atan2(targetEnd.y - targetStart.y, targetEnd.x - targetStart.x);
  drawPart(context, assets, name, sourceStart, targetStart, targetAngle - sourceAngle, alpha);
}

export function drawMaxRigSource(context: CanvasRenderingContext2D, assets: MaxRigAssets, pose: SitPose) {
  const amount = Math.max(0, Math.min(1, pose.amount));
  const root = point(217, 548);
  const targetRoot = point(217, 548 + 40 * amount);
  const upperPoint = (source: Vec2) => {
    const turned = rotate(source, root, pose.lean);
    return point(turned.x, turned.y + targetRoot.y - root.y);
  };

  const legJoints: Array<{ side: 'right' | 'left'; sourceHip: Vec2; sourceKnee: Vec2; sourceAnkle: Vec2; hip: Vec2; knee: Vec2; ankle: Vec2 }> = [];
  // Articulated knees move outward as the pelvis descends; shoes remain fixed.
  for (const side of ['right', 'left'] as const) {
    const right = side === 'right';
    const sourceHip = point(right ? 164 : 268, 552);
    const sourceKnee = point(right ? 162 : 271, 590);
    const sourceAnkle = point(right ? 153 : 281, 620);
    const hip = upperPoint(sourceHip);
    const ankle = sourceAnkle;
    const solved = kneeAt(hip, ankle, distance(sourceHip, sourceKnee), distance(sourceKnee, sourceAnkle), right ? -1 : 1);
    const knee = point(sourceKnee.x + (solved.x - sourceKnee.x) * amount, sourceKnee.y + (solved.y - sourceKnee.y) * amount);
    legJoints.push({ side, sourceHip, sourceKnee, sourceAnkle, hip, knee, ankle });
    const seatedOpacity = Math.min(1, amount * 3);
    drawBone(context, assets, `seated-shin-${side}`, sourceKnee, sourceAnkle, knee, ankle, seatedOpacity);
    drawBone(context, assets, `lower-leg-${side}`, sourceKnee, sourceAnkle, knee, ankle, 1 - seatedOpacity);
  }
  // The approved shoe pixels are unchanged and fixed on the floor.
  drawPart(context, assets, 'shoe-right', point(153, 620), point(153, 620));
  drawPart(context, assets, 'shoe-left', point(281, 620), point(281, 620));

  drawPart(context, assets, 'torso', root, targetRoot, pose.lean);
  drawPart(context, assets, 'pelvis', root, targetRoot, pose.lean);

  // A bent thigh is in front of Max's shorts and the upper shoe, while its
  // lower leg remains behind the shoe. The neutral source partition is exact.
  for (const leg of legJoints) {
    const seatedOpacity = Math.min(1, amount * 3);
    drawBone(context, assets, `upper-leg-${leg.side}`, leg.sourceHip, leg.sourceKnee, leg.hip, leg.knee, 1 - seatedOpacity);
    drawBone(context, assets, `seated-thigh-${leg.side}`, leg.sourceHip, leg.sourceKnee, leg.hip, leg.knee, seatedOpacity);
  }

  for (const side of ['right', 'left'] as const) {
    const right = side === 'right';
    const sourceShoulder = point(right ? 150 : 300, 410);
    const sourceElbow = point(right ? 112 : 334, right ? 477 : 474);
    const sourceWrist = point(right ? 98 : 333, right ? 521 : 522);
    const shoulder = upperPoint(sourceShoulder);
    const shoulderAngle = pose.lean + (right ? .15 : -.15) * amount;
    const elbow = rotate(point(shoulder.x + sourceElbow.x - sourceShoulder.x, shoulder.y + sourceElbow.y - sourceShoulder.y), shoulder, shoulderAngle);
    const elbowAngle = shoulderAngle + (right ? .12 : -.12) * amount;
    const wrist = rotate(point(elbow.x + sourceWrist.x - sourceElbow.x, elbow.y + sourceWrist.y - sourceElbow.y), elbow, elbowAngle);
    drawBone(context, assets, `arm-fill-${side}`, sourceShoulder, sourceElbow, shoulder, elbow, Math.min(1, amount * 4));
    drawBone(context, assets, `upper-arm-${side}`, sourceShoulder, sourceElbow, shoulder, elbow);
    drawBone(context, assets, `forearm-${side}`, sourceElbow, sourceWrist, elbow, wrist);
    drawPart(context, assets, `hand-${side}`, sourceWrist, wrist, elbowAngle);
  }
  const neck = point(218, 382);
  drawPart(context, assets, 'head', neck, upperPoint(neck), pose.lean);
}

/** Draws the experimental rig at a scene-style ground point with layered chair. */
export function drawMaxSitStudy(context: CanvasRenderingContext2D, assets: MaxRigAssets, approved: HTMLImageElement, room: HTMLImageElement, time: number, mode: 'motion' | 'comparison' | 'joints' = 'motion') {
  const canvas = context.canvas;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(room, 0, 0, canvas.width, canvas.height);
  const pose = mode === 'comparison' || mode === 'joints' ? sitPoseAt(0) : sitPoseAt(time);
  const scale = 355 / SOURCE_HEIGHT;
  const floor = 790;
  const center = mode === 'comparison' ? 1040 : mode === 'joints' ? 700 : 835;
  const top = floor - FOOT_LINE * scale;
  if (mode === 'comparison') {
    context.drawImage(approved, 390 - SOURCE_WIDTH * scale / 2, top, SOURCE_WIDTH * scale, 355);
  }
  context.save();
  context.fillStyle = 'rgba(68,42,75,.22)';
  context.beginPath(); context.ellipse(center, floor, 86, 14, 0, 0, Math.PI * 2); context.fill();
  if (mode === 'motion') context.drawImage(assets['chair-back'], center - 115, floor - 140 * CHAIR_FOOT_FRACTION, 230, 140);
  const offscreen = document.createElement('canvas');
  offscreen.width = SOURCE_WIDTH; offscreen.height = SOURCE_HEIGHT;
  const local = offscreen.getContext('2d')!;
  drawMaxRigSource(local, assets, pose);
  context.drawImage(offscreen, center - SOURCE_WIDTH * scale / 2, top, SOURCE_WIDTH * scale, 355);
  if (mode === 'motion') context.drawImage(assets['chair-front'], center - 115, floor - 140 * CHAIR_FOOT_FRACTION, 230, 140);
  if (mode === 'joints') {
    const stage = (x: number, y: number) => point(center - SOURCE_WIDTH * scale / 2 + x * scale, top + y * scale);
    const joints: Record<string, Vec2> = {
      neck: stage(218, 382), pelvis: stage(217, 548),
      'right shoulder': stage(150, 410), 'right elbow': stage(112, 477), 'right wrist': stage(98, 521),
      'left shoulder': stage(300, 410), 'left elbow': stage(334, 474), 'left wrist': stage(333, 522),
      'right hip': stage(164, 552), 'right knee': stage(162, 590), 'right ankle': stage(153, 620),
      'left hip': stage(268, 552), 'left knee': stage(271, 590), 'left ankle': stage(281, 620),
    };
    context.strokeStyle = '#fff7cf'; context.lineWidth = 3;
    for (const chain of [['right shoulder', 'right elbow', 'right wrist'], ['left shoulder', 'left elbow', 'left wrist'], ['right hip', 'right knee', 'right ankle'], ['left hip', 'left knee', 'left ankle']]) {
      context.beginPath();
      chain.forEach((name, index) => { const joint = joints[name]; index ? context.lineTo(joint.x, joint.y) : context.moveTo(joint.x, joint.y); });
      context.stroke();
    }
    for (const [name, joint] of Object.entries(joints)) {
      context.fillStyle = name.includes('hip') || name.includes('knee') || name.includes('ankle') ? '#ffce56' : '#fff8e2';
      context.strokeStyle = '#271b4e'; context.lineWidth = 3;
      context.beginPath(); context.arc(joint.x, joint.y, 6, 0, Math.PI * 2); context.fill(); context.stroke();
    }
    context.fillStyle = 'rgba(31,23,51,.9)'; context.fillRect(960, 510, 520, 335);
    context.fillStyle = '#fff8e2'; context.font = 'bold 28px Segoe UI'; context.fillText('Registered joints', 985, 555);
    context.font = '22px Segoe UI';
    ['Neck + pelvis: torso balance', 'Shoulders → elbows → wrists: each arm', 'Hips → knees → ankles: each leg', 'Ankles + shoes: planted on floor', 'Source space: 434 × 724 pixels'].forEach((line, index) => context.fillText(line, 985, 605 + 47 * index));
  }
  context.restore();
}

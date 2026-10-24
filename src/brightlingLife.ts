import type { SceneState, TimedAction, TimedScene } from './timedScenes';

export type LifeMode = 'v1' | 'v2';
export type CharacterLife = { blinking: boolean; breathX: number; breathY: number; lift: number };
const hash = (value: string) => { let n = 2166136261; for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619); return n >>> 0; };
const random = (seed: number, index: number) => { let n = (seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0; n ^= n >>> 16; n = Math.imul(n, 0x7feb352d); n ^= n >>> 15; n = Math.imul(n, 0x846ca68b); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
const schedules = new Map<string, { moments: number[]; primary: number; index: number }>();

/** The cache only avoids recalculating a pure, character-ID-seeded schedule. */
export function blinkMoments(id: string, through: number): readonly number[] {
  const seed = hash(id);
  let schedule = schedules.get(id);
  if (!schedule) {
    const first = .65 + random(seed, 0) * 2.7;
    schedule = { moments: [first], primary: first, index: 0 };
    schedules.set(id, schedule);
  }
  while (schedule.primary < through + 7) {
    const index = ++schedule.index;
    schedule.primary += 2.7 + random(seed, index * 3 + 1) * 3.9;
    schedule.moments.push(schedule.primary);
    if (random(seed, index * 3 + 2) < .16) schedule.moments.push(schedule.primary + .22 + random(seed, index * 3 + 3) * .09);
  }
  return schedule.moments;
}

export function independentBlinkAt(id: string, time: number): boolean {
  if (time < 0) return false;
  const moments = blinkMoments(id, time);
  let left = 0, right = moments.length;
  while (left < right) { const mid = (left + right) >> 1; if (moments[mid] <= time) left = mid + 1; else right = mid; }
  return left > 0 && time - moments[left - 1] < .15;
}

const end = (action: TimedAction) => action.start + action.duration;
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** Independent body channel, composed with the existing action pose and clock. */
export function characterLifeAt(scene: TimedScene, id: string, time: number, state: SceneState, phoneHeld: boolean): CharacterLife {
  if (!state.visible) return { blinking: false, breathX: 1, breathY: 1, lift: 0 };
  const seed = hash(id);
  const phase = random(seed, 91) * Math.PI * 2;
  const period = 4.4 + random(seed, 92) * 2.5;
  const cycle = (time + random(seed, 93) * period) % period;
  const rest = smooth(Math.min(cycle / .65, (period - .8 - cycle) / .65));
  const breath = Math.max(0, rest) * Math.sin(Math.PI * Math.min(1, cycle / (period - .8))) ** 2;
  const actions = scene.actions.filter(action => action.characterId === id);
  const current = actions.find(action => action.duration > 0 && action.start <= time && end(action) > time);
  const next = actions.filter(action => action.start > time && (action.type === 'walk' || action.type === 'wave')).sort((a, b) => a.start - b.start)[0];
  const previous = actions.filter(action => end(action) <= time && (action.type === 'walk' || action.type === 'wave')).sort((a, b) => end(b) - end(a))[0];
  const active = current?.type === 'walk' ? .27 : current?.type === 'wave' || state.expression || state.gestureFrame || phoneHeld ? .48 : .95;
  let breathY = 1 + .0045 * breath * active;
  let breathX = 1 - .0015 * breath * active;
  let lift = 0;
  if (next && next.start - time > 0 && next.start - time < .28 && !current) {
    const amount = smooth(1 - (next.start - time) / .28);
    breathY -= .008 * amount; breathX += .003 * amount;
  }
  if (current?.type === 'walk') {
    const elapsed = time - current.start;
    const envelope = Math.min(1, elapsed / .25, (end(current) - time) / .25);
    lift -= 1.5 * Math.sin(elapsed * Math.PI * 4.5 + phase) ** 2 * Math.max(0, envelope);
  }
  if (previous && time - end(previous) < .42 && !current) {
    const elapsed = time - end(previous);
    lift += 1.5 * Math.exp(-elapsed * 9) * Math.sin(elapsed * 12);
  }
  return { blinking: independentBlinkAt(id, time), breathX, breathY, lift };
}

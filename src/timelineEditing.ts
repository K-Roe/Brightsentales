import { waveDurationSeconds, type TimedAction, type TimedScene } from './timedScenes';

export const SNAP_SECONDS = 0.5;
export type TimingEdit = 'move' | 'resize';
const round = (value: number) => Math.round(value / SNAP_SECONDS) * SNAP_SECONDS;
const overlaps = (start: number, duration: number, other: TimedAction) => start < other.start + other.duration - 1e-7 && other.start < start + duration - 1e-7;

/** Places a new action at the playhead or the next gap on that character's track. */
export function nextActionStart(scene: TimedScene, characterId: string, playhead: number, duration: number): number | null {
  if (!Number.isFinite(playhead) || !Number.isFinite(duration) || duration <= 0) return null;
  let start = Math.max(0, playhead);
  for (const action of scene.actions.filter(item => item.characterId === characterId && item.duration > 0).sort((a, b) => a.start - b.start)) {
    if (start + duration <= action.start + 1e-7) break;
    if (start < action.start + action.duration - 1e-7) start = action.start + action.duration;
  }
  return start + duration <= scene.duration + 1e-7 ? Number(start.toFixed(2)) : null;
}

/** Returns a valid action timing without changing the persisted scene format. */
export function editActionTiming(scene: TimedScene, id: string, mode: TimingEdit, deltaSeconds: number): TimedAction | null {
  const action = scene.actions.find(item => item.id === id);
  if (!action || !Number.isFinite(deltaSeconds)) return null;
  const others = scene.actions.filter(item => item.id !== id && item.characterId === action.characterId);
  if (mode === 'resize') {
    if (!action.duration) return action;
    const minimum = action.type === 'wave' ? waveDurationSeconds : 0.1;
    const target = Math.max(minimum, Math.min(scene.duration - action.start, action.duration + round(deltaSeconds)));
    const next = Math.min(target, ...others.filter(item => item.start >= action.start).map(item => item.start - action.start));
    return { ...action, duration: Math.max(minimum, Number(next.toFixed(2))) };
  }
  const desired = Math.max(0, Math.min(scene.duration - action.duration, round(action.start + deltaSeconds)));
  const valid = (start: number) => !others.some(item => overlaps(start, action.duration, item)) && !others.some(item => item.duration === 0 && action.duration > 0 && item.start > start && item.start < start + action.duration);
  if (valid(desired)) return { ...action, start: desired };
  const candidates = new Set([action.start, 0, scene.duration - action.duration]);
  for (const item of others) { candidates.add(item.start + item.duration); candidates.add(item.start - action.duration); }
  const nearest = [...candidates].filter(start => start >= 0 && start + action.duration <= scene.duration && valid(start)).sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired))[0];
  return { ...action, start: nearest ?? action.start };
}

/** Action Creator V1 data. The only articulated artwork currently available is Max's
 * original standing cut-out. Other Brightlings keep their approved sprite animation. */
export const ACTIONS_KEY = 'brightsenappstales.actions.v1';
export const ACTION_PARTS = ['arm-left', 'arm-right', 'hand-left', 'hand-right'] as const;
export type ActionPart = typeof ACTION_PARTS[number];
export type ActionPose = Record<ActionPart, number>;
export type ActionKeyframe = { id: string; time: number; pose: ActionPose };
export type SavedAction = { version: 1; id: string; name: string; category: 'movement' | 'emotions' | 'interactions' | 'daily'; rig: 'max-original-v1'; duration: number; keyframes: ActionKeyframe[] };
export type ActionLibrary = { version: 1; actions: SavedAction[] };
export const EMPTY_ACTIONS: ActionLibrary = { version: 1, actions: [] };
export const neutralPose = (): ActionPose => ({ 'arm-left': 0, 'arm-right': 0, 'hand-left': 0, 'hand-right': 0 });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function validateActionLibrary(input: unknown): { ok: true; library: ActionLibrary } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || (input as ActionLibrary).version !== 1 || !Array.isArray((input as ActionLibrary).actions)) return { ok: false, error: 'Action Library data is invalid.' };
  const library = input as ActionLibrary;
  if (library.actions.length > 200) return { ok: false, error: 'The Action Library is too large.' };
  const ids = new Set<string>();
  for (const action of library.actions) {
    if (!action || action.version !== 1 || !uuid.test(action.id) || ids.has(action.id) || typeof action.name !== 'string' || action.name.trim() !== action.name || !action.name || action.name.length > 80 || !['movement', 'emotions', 'interactions', 'daily'].includes(action.category) || action.rig !== 'max-original-v1' || !finite(action.duration) || action.duration < .2 || action.duration > 60 || !Array.isArray(action.keyframes) || action.keyframes.length < 2 || action.keyframes.length > 120) return { ok: false, error: 'An action has invalid details.' };
    ids.add(action.id);
    const frames = new Set<string>();
    let previous = -1;
    for (const key of action.keyframes) {
      if (!key || !uuid.test(key.id) || frames.has(key.id) || !finite(key.time) || key.time < 0 || key.time > action.duration || key.time <= previous || !key.pose || ACTION_PARTS.some(part => !finite(key.pose[part]) || Math.abs(key.pose[part]) > 70)) return { ok: false, error: 'An action has invalid keyframes.' };
      frames.add(key.id); previous = key.time;
    }
    if (action.keyframes[0].time !== 0 || action.keyframes.at(-1)!.time !== action.duration) return { ok: false, error: 'An action needs keyframes at its start and end.' };
  }
  return { ok: true, library };
}

export function decodeActionLibrary(raw: string | null) {
  if (raw === null) return { ok: true as const, library: structuredClone(EMPTY_ACTIONS) };
  try { return validateActionLibrary(JSON.parse(raw)); }
  catch { return { ok: false as const, error: 'Saved actions are not valid JSON.' }; }
}

export function poseAt(action: SavedAction, seconds: number): ActionPose {
  const time = Math.max(0, Math.min(action.duration, seconds));
  const after = action.keyframes.find(key => key.time >= time) ?? action.keyframes.at(-1)!;
  const before = [...action.keyframes].reverse().find(key => key.time <= time) ?? action.keyframes[0];
  if (after === before) return { ...before.pose };
  const t = (time - before.time) / (after.time - before.time);
  const eased = t * t * (3 - 2 * t);
  return Object.fromEntries(ACTION_PARTS.map(part => [part, before.pose[part] + (after.pose[part] - before.pose[part]) * eased])) as ActionPose;
}

export function newAction(): SavedAction {
  return { version: 1, id: crypto.randomUUID(), name: 'My Action', category: 'interactions', rig: 'max-original-v1', duration: 2, keyframes: [
    { id: crypto.randomUUID(), time: 0, pose: neutralPose() },
    { id: crypto.randomUUID(), time: 2, pose: neutralPose() },
  ] };
}

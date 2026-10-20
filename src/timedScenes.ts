import { HEIGHT, Point, WIDTH } from './scene';
import { directionTo, frameForDistance, TURN_MS } from './walking';
import { WAVE_DURATION_MS, waveFrameAt } from './wave';
import { type AudioClip, validAudioClips } from './audio';
import { prunePhoneActions, validatePhoneActions, type PhoneAction, type PhoneHand } from './phone';

export const TIMED_SCENES_KEY = 'brightsenappstales.timed-scenes.v1';
export type ActionType = 'appear' | 'walk' | 'wait' | 'wave' | 'disappear' | 'breathe' | 'point' | 'nod' | 'shake' | 'smile' | 'surprise' | 'clap' | 'react' | 'turn' | 'jump' | 'excited';
export type TimedAction = { id: string; characterId: string; type: ActionType; start: number; duration: number; point?: Point };
/**
 * `phone` and `phoneIn` are optional, so scenes saved before Max's phone existed keep loading
 * unchanged. `phoneIn` carries the prop across a shot boundary: a scene that starts with the
 * phone already in hand means the previous shot did not put it away.
 */
export type TimedScene = { id: string; name: string; duration: number; placeId: string; characters: Record<string, Point>; actions: TimedAction[]; audio?: AudioClip[]; phone?: PhoneAction[]; phoneIn?: PhoneHand | null };
export type TimedLibrary = { version: 1; scenes: TimedScene[] };
export type ExpressionState = { scaleX?: number; scaleY?: number; rotate?: number; offsetX?: number; offsetY?: number; anchor?: 'foot' };
export type SceneState = { visible: boolean; point: Point; pose: 'idle' | 'side' | 'wave'; frame: number; direction: -1 | 1; expression?: ExpressionState };
export type TimedResult = { ok: true; library: TimedLibrary } | { ok: false; error: string };
export const EMPTY_TIMED_LIBRARY: TimedLibrary = { version: 1, scenes: [] };
const characterId = /^(max|maxine|brightling-[a-f0-9-]{36})$/;
const uuidId = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const point = (value: unknown): value is Point => !!value && typeof value === 'object' && finite((value as Point).x) && finite((value as Point).y) && (value as Point).x >= -250 && (value as Point).x <= WIDTH + 250 && (value as Point).y >= 350 && (value as Point).y <= HEIGHT + 150;
const ends = (action: TimedAction) => action.start + action.duration;

export function validateTimedLibrary(value: unknown, availablePlaces: string[] = ['living-room']): TimedResult {
  if (!value || typeof value !== 'object' || (value as TimedLibrary).version !== 1 || !Array.isArray((value as TimedLibrary).scenes)) return { ok: false, error: 'Timed scenes data is invalid.' };
  const scenes = (value as TimedLibrary).scenes;
  if (scenes.length > 100) return { ok: false, error: 'Too many timed scenes.' };
  const seen = new Set<string>();
  for (const scene of scenes) {
    if (!scene || typeof scene !== 'object' || !uuidId.test(scene.id) || seen.has(scene.id) || typeof scene.name !== 'string' || !scene.name.trim() || scene.name !== scene.name.trim() || scene.name.length > 80 || !finite(scene.duration) || scene.duration <= 0 || scene.duration > 3600 || !availablePlaces.includes(scene.placeId) || !scene.characters || typeof scene.characters !== 'object' || Array.isArray(scene.characters) || !Array.isArray(scene.actions) || scene.audio !== undefined && !validAudioClips(scene.audio, scene.duration)) return { ok: false, error: 'A timed scene has invalid details.' };
    seen.add(scene.id);
    const ids = Object.keys(scene.characters);
    if (ids.length > 30 || ids.some(id => !characterId.test(id) || !point(scene.characters[id])) || scene.actions.length > 500) return { ok: false, error: 'A timed scene has invalid characters or positions.' };
    const actions = new Set<string>();
    const perCharacter = new Map<string, TimedAction[]>();
    for (const action of scene.actions) {
      const expressionActions = new Set<ActionType>(['wait', 'wave', 'breathe', 'point', 'nod', 'shake', 'smile', 'surprise', 'clap', 'react', 'turn', 'jump', 'excited']);
      if (!action || !uuidId.test(action.id) || actions.has(action.id) || !ids.includes(action.characterId) || !['appear', 'walk', 'wait', 'wave', 'disappear', 'breathe', 'point', 'nod', 'shake', 'smile', 'surprise', 'clap', 'react', 'turn', 'jump', 'excited'].includes(action.type) || !finite(action.start) || action.start < 0 || action.start > scene.duration || !finite(action.duration) || action.duration < 0 || ends(action) > scene.duration + 1e-7 || (action.type === 'appear' || action.type === 'disappear') && action.duration !== 0 || (action.type === 'walk' || action.type === 'appear') && !point(action.point) || (action.type === 'wait' || action.type === 'wave' || action.type === 'disappear' || expressionActions.has(action.type)) && action.point !== undefined) return { ok: false, error: 'A timed action is invalid or extends beyond its scene.' };
      actions.add(action.id);
      perCharacter.set(action.characterId, [...(perCharacter.get(action.characterId) ?? []), action]);
    }
    for (const list of perCharacter.values()) {
      list.sort((a, b) => a.start - b.start || scene.actions.indexOf(a) - scene.actions.indexOf(b));
      for (let i = 1; i < list.length; i++) if (list[i].start < ends(list[i - 1]) - 1e-7) return { ok: false, error: 'Actions overlap for one Brightling.' };
    }
    if (scene.phoneIn !== undefined && scene.phoneIn !== null && scene.phoneIn !== 'right' && scene.phoneIn !== 'left') return { ok: false, error: 'A scene has an invalid starting phone hand.' };
    const phone = validatePhoneActions(scene.phone, { sceneDuration: scene.duration, characterIds: ids, phoneIn: scene.phoneIn });
    if (!phone.ok) return { ok: false, error: phone.error };
  }
  return { ok: true, library: value as TimedLibrary };
}

export function decodeTimedLibrary(raw: string | null, places?: string[]): TimedResult {
  if (raw === null) return { ok: true, library: structuredClone(EMPTY_TIMED_LIBRARY) };
  try { return validateTimedLibrary(JSON.parse(raw), places); }
  catch { return { ok: false, error: 'Saved timed scenes are not valid JSON.' }; }
}

export function expressionAt(actionType: ActionType, elapsed: number, duration: number): ExpressionState | undefined {
  if (duration <= 0) return undefined;
  const t = Math.max(0, Math.min(1, elapsed / duration));
  const phase = elapsed * Math.PI * 2; // radians per second for oscillations
  switch (actionType) {
    case 'breathe':
      return { scaleY: 1 + Math.sin(phase * 0.8) * 0.015, scaleX: 1 + Math.cos(phase * 0.8) * 0.005 };
    case 'point':
      return { rotate: Math.sin(t * Math.PI) * 8 * (elapsed < 0.12 ? elapsed / 0.12 : 1) };
    case 'nod':
      return { rotate: Math.sin(t * Math.PI * 2) * 4 };
    case 'shake':
      return { rotate: Math.sin(phase * 12) * 3 };
    case 'smile':
      return { scaleY: 1 + Math.sin(t * Math.PI) * 0.025 };
    case 'surprise':
      return { scaleY: 1 + Math.sin(t * Math.PI) * 0.06, scaleX: 1 + Math.sin(t * Math.PI) * 0.04, offsetY: -Math.sin(t * Math.PI) * 6 };
    case 'clap':
      return { scaleX: 1 + Math.sin(phase * 10) * 0.08 };
    case 'react':
      return { scaleY: 1 + Math.sin(t * Math.PI) * 0.05, offsetY: -Math.sin(t * Math.PI) * 10 };
    case 'turn':
      return { scaleX: 1 - Math.sin(t * Math.PI) * 0.35 };
    case 'jump': {
      // The approved standing frame remains whole. Feet stay at the stage anchor
      // during takeoff and landing; only the flight interval lifts the sprite.
      if (t < 0.14) return { anchor: 'foot', scaleY: 1 - 0.08 * Math.sin(Math.PI * t / 0.14) };
      if (t < 0.8) return { anchor: 'foot', offsetY: -105 * Math.sin(Math.PI * (t - 0.14) / 0.66) };
      return { anchor: 'foot', scaleY: 1 - 0.08 * Math.sin(Math.PI * (t - 0.8) / 0.2) };
    }
    case 'excited':
      // Two short hops land on the same measured floor point between beats.
      return { anchor: 'foot', offsetY: -38 * Math.sin(2 * Math.PI * t) ** 2 };
    default:
      return undefined;
  }
}

export function stateAt(scene: TimedScene, character: string, time: number): SceneState {
  let position = { ...scene.characters[character] };
  let visible = false;
  let direction: -1 | 1 = 1;
  const now = Math.max(0, Math.min(scene.duration, time));
  const actions = scene.actions.filter(action => action.characterId === character).sort((a, b) => a.start - b.start || scene.actions.indexOf(a) - scene.actions.indexOf(b));
  for (const action of actions) {
    if (action.start > now) break;
    if (action.type === 'appear') { position = { ...action.point! }; visible = true; continue; }
    if (action.type === 'disappear') { visible = false; continue; }
    if (action.type === 'walk') {
      const destination = action.point!;
      direction = directionTo(position, destination, direction);
      const origin = position;
      const turn = Math.min(action.duration, TURN_MS / 1000);
      const progress = Math.max(0, Math.min(1, (now - action.start - turn) / Math.max(1e-6, action.duration - turn)));
      if (now < ends(action)) {
        const current = { x: origin.x + (destination.x - origin.x) * progress, y: origin.y + (destination.y - origin.y) * progress };
        const travelled = Math.hypot(current.x - origin.x, current.y - origin.y);
        return { visible, point: current, pose: 'side', frame: progress === 0 ? 0 : frameForDistance(character as 'max' | 'maxine', travelled), direction };
      }
      position = { ...destination };
    }
    if (action.type === 'wave' && now < ends(action)) {
      const frame = waveFrameAt((now - action.start) * 1000);
      return { visible, point: position, pose: frame ? 'wave' : 'idle', frame: frame ?? 0, direction };
    }
    if (now < ends(action)) {
      const expression = expressionAt(action.type, now - action.start, action.duration);
      if (expression) return { visible, point: position, pose: 'idle', frame: 0, direction, expression };
    }
  }
  return { visible, point: position, pose: 'idle', frame: 0, direction };
}

export function pruneTimedScenes(library: TimedLibrary, availableCharacters: string[]): TimedLibrary {
  const allowed = new Set(['max', 'maxine', ...availableCharacters]);
  return { version: 1, scenes: library.scenes.map(scene => {
    const characters = Object.fromEntries(Object.entries(scene.characters).filter(([id]) => allowed.has(id)));
    const phone = prunePhoneActions(scene.phone, Object.keys(characters));
    return { ...scene, characters, actions: scene.actions.filter(action => allowed.has(action.characterId)), phone };
  }) };
}

export const waveDurationSeconds = WAVE_DURATION_MS / 1000;

export function advanceSceneTime(current: number, elapsedSeconds: number, duration: number): number {
  return Math.min(duration, current + Math.max(0, elapsedSeconds));
}

import { HEIGHT, Point, WIDTH } from './scene';
import { directionTo, frameForDistance, TURN_MS } from './walking';
import { WAVE_DURATION_MS, waveFrameAt } from './wave';
import { type AudioClip, validAudioClips } from './audio';
import { prunePhoneActions, validatePhoneActions, type PhoneAction, type PhoneHand } from './phone';

export const TIMED_SCENES_KEY = 'brightsenappstales.timed-scenes.v1';
export type ActionType = 'appear' | 'walk' | 'wait' | 'wave' | 'disappear' | 'breathe' | 'point' | 'nod' | 'shake' | 'smile' | 'surprise' | 'clap' | 'react' | 'turn' | 'jump' | 'excited' | 'sit-down' | 'stand-up' | 'pick-up' | 'put-down';
export type FrameActionType = 'sit-down' | 'stand-up' | 'pick-up' | 'put-down';
export const isFrameAction = (type: ActionType): type is FrameActionType => type === 'sit-down' || type === 'stand-up' || type === 'pick-up' || type === 'put-down';
export type GestureType = 'point' | 'clap' | 'nod' | 'shake';
export type GestureFrame = 'point' | 'clap-open' | 'clap-contact' | 'nod-down' | 'shake-left' | 'shake-right' | 'sit-lowering' | 'sit-seated' | 'object-reach' | 'object-lift' | 'object-carry';
export const isGesture = (type: ActionType): type is GestureType => type === 'point' || type === 'clap' || type === 'nod' || type === 'shake';
// Absence means the original whole-sprite expression, preserving saved scenes.
export type TimedAction = { id: string; characterId: string; type: ActionType; start: number; duration: number; point?: Point; artwork?: 'provisional-v1'; seat?: 'chair' | 'sofa'; objectId?: string };
export type SceneObject = { id: string; kind: 'toy-ball'; point: Point };
/**
 * `phone` and `phoneIn` are optional, so scenes saved before Max's phone existed keep loading
 * unchanged. `phoneIn` carries the prop across a shot boundary: a scene that starts with the
 * phone already in hand means the previous shot did not put it away.
 */
export type TimedScene = { id: string; name: string; duration: number; placeId: string; characters: Record<string, Point>; actions: TimedAction[]; objects?: SceneObject[]; audio?: AudioClip[]; phone?: PhoneAction[]; phoneIn?: PhoneHand | null };
export type TimedLibrary = { version: 1; scenes: TimedScene[] };
export type ExpressionState = { scaleX?: number; scaleY?: number; rotate?: number; offsetX?: number; offsetY?: number; anchor?: 'foot' };
export type SceneState = { visible: boolean; point: Point; pose: 'idle' | 'side' | 'wave'; frame: number; direction: -1 | 1; expression?: ExpressionState; gestureFrame?: GestureFrame };
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
    if (scene.objects !== undefined && (!Array.isArray(scene.objects) || scene.objects.length > 30 || scene.objects.some(object => !object || !uuidId.test(object.id) || object.kind !== 'toy-ball' || !point(object.point)) || new Set(scene.objects.map(object => object.id)).size !== scene.objects.length)) return { ok: false, error: 'A scene object is invalid.' };
    const actions = new Set<string>();
    const perCharacter = new Map<string, TimedAction[]>();
    for (const action of scene.actions) {
      const expressionActions = new Set<ActionType>(['wait', 'wave', 'breathe', 'point', 'nod', 'shake', 'smile', 'surprise', 'clap', 'react', 'turn', 'jump', 'excited']);
      if (!action || !uuidId.test(action.id) || actions.has(action.id) || !ids.includes(action.characterId) || !['appear', 'walk', 'wait', 'wave', 'disappear', 'breathe', 'point', 'nod', 'shake', 'smile', 'surprise', 'clap', 'react', 'turn', 'jump', 'excited', 'sit-down', 'stand-up', 'pick-up', 'put-down'].includes(action.type) || !finite(action.start) || action.start < 0 || action.start > scene.duration || !finite(action.duration) || action.duration < 0 || ends(action) > scene.duration + 1e-7 || (action.type === 'appear' || action.type === 'disappear') && action.duration !== 0 || (action.type === 'walk' || action.type === 'appear' || action.type === 'put-down') && !point(action.point) || (action.type === 'wait' || action.type === 'wave' || action.type === 'disappear' || expressionActions.has(action.type) || action.type === 'sit-down' || action.type === 'stand-up' || action.type === 'pick-up') && action.point !== undefined || action.artwork !== undefined && (action.artwork !== 'provisional-v1' || !(isGesture(action.type) || isFrameAction(action.type)) || action.characterId !== 'max' && action.characterId !== 'maxine') || isFrameAction(action.type) && (action.artwork !== 'provisional-v1' || action.duration < .4) || (action.type === 'sit-down' || action.type === 'stand-up') && (action.seat !== 'chair' && action.seat !== 'sofa' || action.objectId !== undefined) || action.type !== 'sit-down' && action.type !== 'stand-up' && action.seat !== undefined || (action.type === 'pick-up' || action.type === 'put-down') && (!action.objectId || !scene.objects?.some(object => object.id === action.objectId)) || action.type !== 'pick-up' && action.type !== 'put-down' && action.objectId !== undefined) return { ok: false, error: 'A timed action is invalid or extends beyond its scene.' };
      actions.add(action.id);
      perCharacter.set(action.characterId, [...(perCharacter.get(action.characterId) ?? []), action]);
    }
    for (const list of perCharacter.values()) {
      list.sort((a, b) => a.start - b.start || scene.actions.indexOf(a) - scene.actions.indexOf(b));
      for (let i = 1; i < list.length; i++) if (list[i].start < ends(list[i - 1]) - 1e-7) return { ok: false, error: 'Actions overlap for one Brightling.' };
      let seated = false;
      let seat: 'chair' | 'sofa' | null = null;
      for (const action of list) {
        if (action.type === 'sit-down') {
          if (seated || action.seat === 'sofa') return { ok: false, error: 'Sofa sitting needs separately layered furniture art. Use the provisional chair.' };
          seated = true;
          seat = action.seat!;
        } else if (action.type === 'stand-up') {
          if (!seated || action.seat !== seat) return { ok: false, error: 'Stand up needs a Brightling seated on the same furniture.' };
          seated = false;
          seat = null;
        } else if (seated && (action.type === 'walk' || action.type === 'jump' || action.type === 'pick-up' || action.type === 'put-down')) return { ok: false, error: 'Stand up before moving or using a toy.' };
      }
    }
    // A single object has one owner; its ownership changes only at completed actions.
    for (const object of scene.objects ?? []) {
      let owner: string | null = null;
      for (const action of scene.actions.filter(item => item.objectId === object.id).sort((a, b) => a.start - b.start)) {
        const p = stateAt(scene, action.characterId, action.start).point;
        if (action.type === 'pick-up') {
          const floor = objectAt(scene, object.id, Math.max(0, action.start - 0.001))?.point;
          if (owner || !floor || Math.hypot(floor.x - (p.x - 72), floor.y - (p.y - 17)) > 25) return { ok: false, error: 'The toy must be beside the Brightling’s reaching hand before pickup.' };
          owner = action.characterId;
        }
        if (action.type === 'put-down') {
          if (owner !== action.characterId || Math.hypot(action.point!.x - (p.x - 72), action.point!.y - p.y) > 90) return { ok: false, error: 'Put down needs the carried toy and a nearby floor position.' };
          owner = null;
        }
      }
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

/** Registered whole-body frames. The approved idle frame leads and ends every action. */
export function gestureFrameAt(type: GestureType, elapsed: number, duration: number): GestureFrame | undefined {
  if (duration <= 0 || elapsed <= 0 || elapsed >= duration) return undefined;
  const t = elapsed / duration;
  if (type === 'point') return t < 0.12 || t >= 0.88 ? undefined : 'point';
  if (type === 'clap') {
    if (t < 0.08 || t >= 0.92) return undefined;
    if (t < 0.22 || t >= 0.76) return 'clap-open';
    if (t < 0.39 || t >= 0.61) return 'clap-contact';
    return 'clap-open';
  }
  if (type === 'nod') return t >= 0.16 && t < 0.37 || t >= 0.57 && t < 0.78 ? 'nod-down' : undefined;
  if (t < 0.1 || t >= 0.9) return undefined;
  if (t < 0.3 || t >= 0.7 && t < 0.9) return 'shake-left';
  if (t < 0.4 || t >= 0.6 && t < 0.7) return undefined;
  return 'shake-right';
}

export function gestureFramesForScene(scene: TimedScene, character: string): GestureFrame[] {
  const frames = new Set<GestureFrame>();
  if (scene.actions.some(action => action.characterId === character && isFrameAction(action.type))) {
    for (const frame of ['sit-lowering', 'sit-seated', 'object-reach', 'object-lift', 'object-carry'] as GestureFrame[]) frames.add(frame);
  }
  for (const action of scene.actions) if (action.characterId === character && action.artwork === 'provisional-v1' && isGesture(action.type)) {
    if (action.type === 'clap') { frames.add('clap-open'); frames.add('clap-contact'); }
    else if (action.type === 'nod') frames.add('nod-down');
    else if (action.type === 'shake') { frames.add('shake-left'); frames.add('shake-right'); }
    else frames.add('point');
  }
  return [...frames];
}

export function stateAt(scene: TimedScene, character: string, time: number): SceneState {
  let position = { ...scene.characters[character] };
  let visible = false;
  let direction: -1 | 1 = 1;
  let seated = false;
  let carrying = false;
  const now = Math.max(0, Math.min(scene.duration, time));
  const actions = scene.actions.filter(action => action.characterId === character).sort((a, b) => a.start - b.start || scene.actions.indexOf(a) - scene.actions.indexOf(b));
  for (const action of actions) {
    if (action.start > now) break;
    if (action.type === 'appear') { position = { ...action.point! }; visible = true; continue; }
    if (action.type === 'disappear') { visible = false; continue; }
    if (isFrameAction(action.type)) {
      const t = Math.max(0, Math.min(1, (now - action.start) / action.duration));
      if (now < ends(action)) {
        const gestureFrame: GestureFrame | undefined = action.type === 'sit-down' ? t < .2 ? undefined : t < .72 ? 'sit-lowering' : 'sit-seated'
          : action.type === 'stand-up' ? t < .28 ? 'sit-seated' : t < .8 ? 'sit-lowering' : undefined
          : action.type === 'pick-up' ? t < .16 ? carrying ? 'object-carry' : undefined : t < .48 ? 'object-reach' : t < .78 ? 'object-lift' : 'object-carry'
          : t < .22 ? 'object-carry' : t < .55 ? 'object-lift' : t < .82 ? 'object-reach' : undefined;
        return { visible, point: position, pose: 'idle', frame: 0, direction, gestureFrame };
      }
      if (action.type === 'sit-down') seated = true;
      if (action.type === 'stand-up') seated = false;
      if (action.type === 'pick-up') carrying = true;
      if (action.type === 'put-down') carrying = false;
      continue;
    }
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
    if (action.artwork === 'provisional-v1' && isGesture(action.type) && now < ends(action)) {
      return { visible, point: position, pose: 'idle', frame: 0, direction, gestureFrame: gestureFrameAt(action.type, now - action.start, action.duration) };
    }
    if (now < ends(action)) {
      const expression = expressionAt(action.type, now - action.start, action.duration);
      if (expression) return { visible, point: position, pose: 'idle', frame: 0, direction, expression };
    }
  }
  return { visible, point: position, pose: 'idle', frame: 0, direction, gestureFrame: seated ? 'sit-seated' : carrying ? 'object-carry' : undefined };
}

export type ObjectState = { point: Point; heldBy: string | null; phase: 'floor' | 'reach' | 'lift' | 'held' | 'lower' };
/** Toy state is evaluated from saved actions for both Studio preview and export. */
export function objectAt(scene: TimedScene, objectId: string, time: number): ObjectState | null {
  const object = scene.objects?.find(item => item.id === objectId);
  if (!object) return null;
  let position = { x: object.point.x, y: object.point.y - 17 };
  let owner: string | null = null;
  const now = Math.max(0, Math.min(scene.duration, time));
  const actions = scene.actions.filter(action => action.objectId === objectId).sort((a, b) => a.start - b.start);
  for (const action of actions) {
    if (action.start > now) break;
    const state = stateAt(scene, action.characterId, Math.min(now, action.start + action.duration));
    const floorHand = { x: state.point.x - 72, y: state.point.y - 23 };
    const carryHand = { x: state.point.x - 55, y: state.point.y - 83 };
    if (now < ends(action)) {
      const t = (now - action.start) / action.duration;
      if (action.type === 'pick-up') {
        if (t < .48) return { point: position, heldBy: null, phase: 'reach' };
        const p = Math.min(1, (t - .48) / .3);
        return { point: { x: floorHand.x + (carryHand.x - floorHand.x) * p, y: floorHand.y + (carryHand.y - floorHand.y) * p }, heldBy: action.characterId, phase: 'lift' };
      }
      if (action.type === 'put-down') {
        if (t < .22) return { point: carryHand, heldBy: action.characterId, phase: 'held' };
        const p = Math.min(1, (t - .22) / .6);
        return { point: { x: carryHand.x + (action.point!.x - carryHand.x) * p, y: carryHand.y + (action.point!.y - 17 - carryHand.y) * p }, heldBy: action.characterId, phase: 'lower' };
      }
    }
    if (action.type === 'pick-up') owner = action.characterId;
    if (action.type === 'put-down') { owner = null; position = { x: action.point!.x, y: action.point!.y - 17 }; }
  }
  if (owner) {
    const state = stateAt(scene, owner, now);
    return { point: { x: state.point.x - (state.pose === 'side' ? 58 : 55), y: state.point.y - (state.pose === 'side' ? 87 : 83) }, heldBy: owner, phase: 'held' };
  }
  return { point: position, heldBy: null, phase: 'floor' };
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

/**
 * Max's Phone & Bright Speak communication, V1.
 *
 * Brightlings in this project are whole-body sprite frames, not jointed rigs, so this
 * module never claims to animate arms. The phone is a prop composited onto an existing
 * pose at a measured hand anchor, and the communication pop-up is drawn beside the
 * character. All timing is a pure function of scene time, so the Scene Maker preview,
 * the storyboard and the WebM export agree without a second animation engine.
 */
import { HEIGHT, WIDTH } from './scene';
import type { AudioAssetInfo, AudioClip } from './audio';

export type PhoneHand = 'right' | 'left';
export type PhoneActionType = 'take-out' | 'hold' | 'tap' | 'communicate' | 'put-away';
export type PhoneSymbolId = 'food' | 'drink' | 'toilet' | 'help' | 'yes' | 'no' | 'play' | 'love' | 'hurt';
export type PhonePopupPosition = 'above-left' | 'above-right' | 'left' | 'right';

export type PhoneAction = {
  id: string;
  characterId: string;
  type: PhoneActionType;
  start: number;
  duration: number;
  /** Which hand holds the phone. Set when taking out; remembered afterwards. */
  hand?: PhoneHand;
  /** Communicate only: the message the phone shows and speaks. */
  message?: string;
  /** Communicate only. */
  symbol?: PhoneSymbolId;
  /** Communicate only. */
  position?: PhonePopupPosition;
  /** Communicate only: saved speech asset used as the phone's assistive voice. */
  assetId?: string;
  /** Communicate only: the scene audio clip this interaction owns. */
  clipId?: string;
};

export type PhonePopup = {
  message: string;
  symbol: PhoneSymbolId;
  position: PhonePopupPosition;
  opacity: number;
  speaking: boolean;
};

export type PhoneState = {
  held: boolean;
  hand: PhoneHand;
  /** 0 = tucked away, 1 = fully raised. Smoothly animated. */
  raise: number;
  tapping: boolean;
  popup: PhonePopup | null;
};
export type IllustratedPhoneFrame = 'idle' | 'enter' | 'hold' | 'tap-start' | 'tap-mid' | 'raise' | 'touch';

/** A take-out, tap or put-away is a short gesture; the pop-up lingers long enough to read. */
export const PHONE_RAISE_SECONDS = 0.55;
export const PHONE_TAP_SECONDS = 0.5;
export const PHONE_FADE_SECONDS = 0.3;
/** The tap reads before the device speaks, so the speech is never unprompted. */
export const PHONE_SPEECH_LEAD_SECONDS = 0.22;

export const PHONE_SYMBOLS: ReadonlyArray<{ id: PhoneSymbolId; label: string }> = [
  { id: 'food', label: 'Food' },
  { id: 'drink', label: 'Drink' },
  { id: 'toilet', label: 'Toilet' },
  { id: 'help', label: 'Help' },
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
  { id: 'play', label: 'Play' },
  { id: 'love', label: 'Love' },
  { id: 'hurt', label: 'Hurt' },
];

export const PHONE_POSITIONS: ReadonlyArray<{ id: PhonePopupPosition; label: string }> = [
  { id: 'above-left', label: 'Above left' },
  { id: 'above-right', label: 'Above right' },
  { id: 'left', label: 'Beside left' },
  { id: 'right', label: 'Beside right' },
];

/** Beginner message starters, so a first interaction does not need typing. */
export const PHONE_MESSAGES: readonly string[] = [
  "I'm hungry!",
  "I'm thirsty!",
  'I need the toilet.',
  'Yes, please.',
  'No, thank you.',
  "Let's play!",
  'I need help.',
  'I love you.',
  'It hurts.',
];

/** Older saved interactions may omit message; keep their original starter text. */
export const communicationMessage = (action: Pick<PhoneAction, 'message'>): string => action.message ?? PHONE_MESSAGES[0];

export const isPhoneSymbol = (value: unknown): value is PhoneSymbolId => PHONE_SYMBOLS.some(item => item.id === value);
export const isPhonePosition = (value: unknown): value is PhonePopupPosition => PHONE_POSITIONS.some(item => item.id === value);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const ends = (action: PhoneAction) => action.start + action.duration;

export const phoneActionNames: Record<PhoneActionType, string> = {
  'take-out': 'Take Out Bright Speak',
  hold: 'Hold Bright Speak',
  tap: 'Tap Bright Speak',
  communicate: 'Communicate Message',
  'put-away': 'Put Away Bright Speak',
};

export type PhoneValidation = { ok: true } | { ok: false; error: string };

/**
 * Validates one scene's phone interactions. Beginner-hostile states are rejected with a
 * plain reason rather than producing an interaction that cannot work.
 */
export function validatePhoneActions(value: unknown, options: { sceneDuration: number; characterIds: string[]; phoneIn?: PhoneHand | null }): PhoneValidation {
  if (value === undefined || value === null) return { ok: true };
  if (!Array.isArray(value)) return { ok: false, error: 'Phone interactions are invalid.' };
  if (value.length > 80) return { ok: false, error: 'Too many phone interactions in one scene.' };
  const ids = new Set<string>();
  const perCharacter = new Map<string, PhoneAction[]>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'A phone interaction is invalid.' };
    const action = raw as PhoneAction;
    const type = action.type;
    if (!uuid.test(action.id) || ids.has(action.id)) return { ok: false, error: 'A phone interaction has an invalid id.' };
    if (!options.characterIds.includes(action.characterId)) return { ok: false, error: 'A phone interaction refers to a Brightling who is not in this scene.' };
    if (!['take-out', 'hold', 'tap', 'communicate', 'put-away'].includes(type)) return { ok: false, error: 'A phone interaction has an unknown type.' };
    if (!finite(action.start) || action.start < 0 || action.start > options.sceneDuration) return { ok: false, error: 'A phone interaction starts outside the scene.' };
    if (!finite(action.duration) || action.duration <= 0 || ends(action) > options.sceneDuration + 1e-7) return { ok: false, error: 'A phone interaction extends beyond the scene.' };
    if (action.hand !== undefined && action.hand !== 'right' && action.hand !== 'left') return { ok: false, error: 'A phone interaction has an invalid hand.' };
    if (type === 'take-out' || type === 'put-away') {
      if (action.duration > 3) return { ok: false, error: 'Taking out or putting away a phone takes about half a second.' };
      if (action.message !== undefined || action.symbol !== undefined || action.assetId !== undefined || action.clipId !== undefined) return { ok: false, error: 'Only Communicate Message can carry a message or a voice.' };
    }
    if (type === 'tap' && (action.message !== undefined || action.symbol !== undefined || action.assetId !== undefined || action.clipId !== undefined)) return { ok: false, error: 'Only Communicate Message can carry a message or a voice.' };
    if (type === 'hold' && (action.message !== undefined || action.symbol !== undefined || action.assetId !== undefined || action.clipId !== undefined)) return { ok: false, error: 'Only Communicate Message can carry a message or a voice.' };
    if (type === 'communicate') {
      if (action.message !== undefined && (typeof action.message !== 'string' || !action.message.trim() || action.message.length > 80)) return { ok: false, error: 'A communication message must be 1 to 80 characters.' };
      if (!isPhoneSymbol(action.symbol)) return { ok: false, error: 'Choose a communication symbol.' };
      if (!isPhonePosition(action.position)) return { ok: false, error: 'Choose where the communication pop-up appears.' };
      if (action.duration < 0.8) return { ok: false, error: 'A communication pop-up needs at least 0.8 seconds to read.' };
      if (action.duration > 12) return { ok: false, error: 'A communication pop-up can stay up for at most 12 seconds.' };
      if ((action.assetId === undefined) !== (action.clipId === undefined)) return { ok: false, error: 'A communication voice needs both a saved voice and its scene clip.' };
      if (action.assetId !== undefined && !uuid.test(action.assetId)) return { ok: false, error: 'A communication voice is invalid.' };
      if (action.clipId !== undefined && !uuid.test(action.clipId)) return { ok: false, error: 'A communication voice clip is invalid.' };
    }
    ids.add(action.id);
    perCharacter.set(action.characterId, [...(perCharacter.get(action.characterId) ?? []), action]);
  }
  for (const list of perCharacter.values()) {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    // A Brightling cannot put a phone away before holding one, unless the scene starts with it in hand.
    if (sorted[0]?.type === 'put-away' && !phoneCarriedIn(options.phoneIn)) return { ok: false, error: 'Add Take Out Bright Speak before Put Away Bright Speak, or start the scene with Bright Speak already in hand.' };
    for (let i = 1; i < sorted.length; i++) if (sorted[i].start < ends(sorted[i - 1]) - 1e-7) return { ok: false, error: 'Two phone interactions overlap for one Brightling.' };
  }
  return { ok: true };
}

/** True when the scene begins with a phone already in the character's hand (shot continuity). */
export const phoneCarriedIn = (phoneIn: unknown): phoneIn is PhoneHand => phoneIn === 'right' || phoneIn === 'left';

const smooth = (value: number) => value * value * (3 - 2 * value);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
/** Guards the boundary so a gesture never shows a stray half-frame. */
const within = (elapsed: number, duration: number) => elapsed >= 0 && elapsed < duration - 1e-9;

/** Whether the phone's speech clip is playing, so the pop-up can show a quiet speaker mark. */
export function phoneSpeechPlaying(scene: { audio?: AudioClip[] }, action: PhoneAction, time: number): boolean {
  if (!action.clipId || !scene.audio) return false;
  return scene.audio.some(clip => clip.id === action.clipId && time >= clip.start && time < clip.start + (clip.trimEnd - clip.trimStart));
}

/**
 * The whole phone interaction at a point in scene time. Deterministic, so preview, playback
 * and export cannot disagree.
 */
export function phoneStateAt(scene: { phone?: PhoneAction[]; phoneIn?: PhoneHand | null; audio?: AudioClip[] }, characterId: string, time: number): PhoneState {
  const carried = phoneCarriedIn(scene.phoneIn) ? scene.phoneIn : null;
  const actions = (scene.phone ?? []).filter(action => action.characterId === characterId).sort((a, b) => a.start - b.start);
  let hand: PhoneHand = carried ?? 'right';
  let held = carried !== null;
  let raise = carried !== null ? 1 : 0;
  let tapping = false;
  let popup: PhonePopup | null = null;
  for (const action of actions) {
    if (action.start > time) break;
    const local = time - action.start;
    if (action.type === 'take-out') {
      if (action.hand) hand = action.hand;
      if (within(local, action.duration)) { held = true; raise = smooth(clamp01(local / PHONE_RAISE_SECONDS)); popup = null; tapping = false; continue; }
      held = true; raise = 1; continue;
    }
    if (action.type === 'put-away') {
      if (within(local, action.duration)) { held = true; raise = 1 - smooth(clamp01(local / PHONE_RAISE_SECONDS)); tapping = false; popup = null; continue; }
      held = false; raise = 0; continue;
    }
    if (action.type === 'tap') { tapping = within(local, Math.min(PHONE_TAP_SECONDS, action.duration)); continue; }
    if (action.type === 'communicate') {
      if (!within(local, action.duration)) { popup = null; continue; }
      const fade = Math.min(PHONE_FADE_SECONDS, action.duration / 2);
      const opacity = local < fade ? smooth(clamp01(local / fade)) : 1 - smooth(clamp01((local - (action.duration - fade)) / fade));
      popup = {
        message: communicationMessage(action),
        symbol: (action.symbol ?? 'help') as PhoneSymbolId,
        position: (action.position ?? 'above-right') as PhonePopupPosition,
        opacity: clamp01(opacity),
        speaking: phoneSpeechPlaying(scene, action, time),
      };
      continue;
    }
  }
  return { held: held || raise > 0, hand, raise, tapping, popup };
}

/** Whole-body Max artwork selection. The phone position is baked into each pose. */
export function illustratedPhoneFrameAt(scene: { phone?: PhoneAction[] }, characterId: string, time: number, phone: PhoneState): IllustratedPhoneFrame {
  if (!phone.held && phone.raise <= 0) return 'idle';
  if (phone.raise < 0.12) return 'idle';
  if (phone.raise < 0.68) return 'enter';
  const tap = (scene.phone ?? []).find(action => action.characterId === characterId && action.type === 'tap' && time >= action.start && time < action.start + Math.min(action.duration, PHONE_TAP_SECONDS));
  if (!tap) return 'hold';
  const phase = (time - tap.start) / Math.min(tap.duration, PHONE_TAP_SECONDS);
  if (phase < 0.08 || phase >= 0.94) return 'hold';
  if (phase < 0.2 || phase >= 0.86) return 'tap-start';
  if (phase < 0.32 || phase >= 0.76) return 'tap-mid';
  if (phase < 0.42 || phase >= 0.66) return 'raise';
  return 'touch';
}

type Anchor = { x: number; y: number };
/**
 * Hand centres measured from the approved sprite frames (source pixels). Custom Brightlings
 * are recoloured copies of these same frames, so they reuse the matching anchors.
 */
const HAND_ANCHORS: Record<'max' | 'maxine', Record<string, Record<PhoneHand, Anchor | null>>> = {
  max: {
    idle: { right: { x: 96, y: 517 }, left: { x: 332, y: 521 } },
    side0: { right: { x: 219, y: 556 }, left: null },
    side1: { right: { x: 208, y: 554 }, left: { x: 324, y: 545 } },
    side2: { right: { x: 283, y: 550 }, left: { x: 333, y: 513 } },
    side3: { right: { x: 197, y: 528 }, left: { x: 339, y: 580 } },
    side4: { right: { x: 240, y: 577 }, left: { x: 364, y: 529 } },
    wave1: { right: { x: 128, y: 352 }, left: { x: 381, y: 521 } },
    wave2: { right: { x: 141, y: 311 }, left: { x: 382, y: 524 } },
    wave3: { right: { x: 133, y: 315 }, left: { x: 382, y: 526 } },
  },
  maxine: {
    idle: { right: { x: 99, y: 506 }, left: { x: 314, y: 506 } },
    side0: { right: { x: 250, y: 516 }, left: { x: 344, y: 508 } },
    side1: { right: { x: 183, y: 492 }, left: { x: 356, y: 558 } },
    side2: { right: { x: 214, y: 506 }, left: { x: 353, y: 511 } },
    side3: { right: { x: 176, y: 494 }, left: { x: 366, y: 516 } },
    side4: { right: { x: 177, y: 489 }, left: { x: 367, y: 506 } },
    wave1: { right: { x: 137, y: 356 }, left: { x: 370, y: 522 } },
    wave2: { right: { x: 145, y: 329 }, left: { x: 370, y: 521 } },
    wave3: { right: { x: 144, y: 333 }, left: { x: 364, y: 523 } },
  },
};

export const anchorKey = (characterId: string, pose: string, frame: number) => pose === 'idle' ? 'idle' : pose === 'wave' ? `wave${frame}` : `side${frame}`;

/**
 * Where the phone sits for a character, pose and frame, in stage coordinates. `side` frames
 * mirror with the character, so the anchor mirrors too and the phone never drifts off the hand.
 * Returns null when the far hand is hidden behind the body (the artwork has no pixels there),
 * so the caller can refuse to pretend the phone is being held.
 */
export function phoneAnchor(characterId: string, pose: 'idle' | 'side' | 'wave', frame: number, hand: PhoneHand, box: { x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number; direction: number }): Anchor | null {
  const set = characterId === 'maxine' ? HAND_ANCHORS.maxine : HAND_ANCHORS.max;
  const anchor = set[anchorKey(characterId, pose, frame)]?.[hand];
  if (!anchor) return null;
  const scaleX = box.width / box.sourceWidth;
  const scaleY = box.height / box.sourceHeight;
  const localX = pose === 'side' ? (box.direction < 0 ? box.sourceWidth - anchor.x : anchor.x) : anchor.x;
  return { x: box.x + localX * scaleX, y: box.y + anchor.y * scaleY };
}

/** The phone voice is an assistive device voice, so it is never attributed to the character. */
export function phoneSpeechClip(action: PhoneAction, asset: AudioAssetInfo, sceneDuration: number, clipId: string): AudioClip {
  const available = Math.max(0, sceneDuration - asset.duration);
  const start = Math.min(action.start + PHONE_SPEECH_LEAD_SECONDS, Math.max(0, available));
  return { id: clipId, assetId: asset.id, start: Number(start.toFixed(3)), trimStart: 0, trimEnd: asset.duration, volume: 1, fadeIn: 0.02, fadeOut: Math.min(0.08, asset.duration / 3) };
}

/** Keeps the scene's own speech clip aligned with its communication interaction. */
export function syncPhoneClip(scene: { duration: number; audio?: AudioClip[] }, action: PhoneAction, asset: AudioAssetInfo | null, ownedClipId = action.clipId): AudioClip[] {
  const clips = (scene.audio ?? []).filter(clip => clip.id !== ownedClipId);
  if (!ownedClipId || action.type !== 'communicate' || !asset) return clips;
  return [...clips, phoneSpeechClip(action, asset, scene.duration, ownedClipId)];
}

/** Pop-up size on the 1672x941 stage: large enough to read on a phone-sized screen. */
export const PHONE_POPUP_SCALE = 0.74;
export const PHONE_POPUP_WIDTH = 470 * PHONE_POPUP_SCALE;
export const PHONE_POPUP_HEIGHT = 210 * PHONE_POPUP_SCALE;

/** Keeps the pop-up inside the frame and clear of the character's face. */
export function phonePopupBox(characterX: number, characterY: number, position: PhonePopupPosition, size = PHONE_POPUP_WIDTH, height = PHONE_POPUP_HEIGHT): { x: number; y: number } {
  // Sit beside the character rather than far away, so it reads as coming from the phone.
  const gap = 42;
  const above = position === 'above-left' || position === 'above-right';
  const leftSide = position === 'above-left' || position === 'left';
  let x = leftSide ? characterX - gap - size : characterX + gap;
  // "Above" clears the head entirely; "beside" sits at chest height.
  let y = above ? characterY - 355 - height - 26 : characterY - 268;
  x = Math.max(28, Math.min(WIDTH - size - 28, x));
  y = Math.max(28, Math.min(HEIGHT - height - 28, y));
  return { x, y };
}

/** Removes phone interactions belonging to Brightlings that are no longer in the scene. */
export function prunePhoneActions<T extends { characterId: string }>(actions: T[] | undefined, characterIds: string[]): T[] | undefined {
  if (!actions) return undefined;
  return actions.filter(action => characterIds.includes(action.characterId));
}

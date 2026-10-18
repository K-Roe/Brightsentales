import { describe, expect, it } from 'vitest';
import {
  PHONE_RAISE_SECONDS,
  PHONE_SPEECH_LEAD_SECONDS,
  isPhonePosition,
  isPhoneSymbol,
  phoneActionNames,
  phoneAnchor,
  phonePopupBox,
  phoneSpeechClip,
  phoneSpeechPlaying,
  phoneStateAt,
  prunePhoneActions,
  syncPhoneClip,
  validatePhoneActions,
  type PhoneAction,
  type PhoneHand,
} from './phone';
import { validateTimedLibrary, type TimedScene } from './timedScenes';
import { HEIGHT, WIDTH } from './scene';
import type { AudioAssetInfo } from './audio';

const uuid = (seed: string) => `00000000-0000-4000-8000-${seed.padStart(12, '0')}`;
const action = (over: Partial<PhoneAction> & { id: string; type: PhoneAction['type'] }): PhoneAction => ({ characterId: 'max', start: 0, duration: 1, ...over });
const base = (phone?: PhoneAction[], phoneIn?: PhoneHand | null) => ({ phone, phoneIn: phoneIn ?? null });

describe('phone interaction validation', () => {
  it('accepts an empty scene and rejects nonsense', () => {
    expect(validatePhoneActions(undefined, { sceneDuration: 10, characterIds: ['max'] })).toEqual({ ok: true });
    expect(validatePhoneActions([], { sceneDuration: 10, characterIds: ['max'] })).toEqual({ ok: true });
    expect(validatePhoneActions('nope', { sceneDuration: 10, characterIds: ['max'] }).ok).toBe(false);
    expect(validatePhoneActions([action({ id: 'bad-id', type: 'tap' })], { sceneDuration: 10, characterIds: ['max'] }).ok).toBe(false);
    expect(validatePhoneActions([action({ id: uuid('1'), type: 'tap', characterId: 'maxine' })], { sceneDuration: 10, characterIds: ['max'] }).ok).toBe(false);
  });

  it('keeps interactions inside the scene and refuses overlapping ones', () => {
    const inside = validatePhoneActions([action({ id: uuid('1'), type: 'tap', start: 9, duration: 2 })], { sceneDuration: 10, characterIds: ['max'] });
    expect(inside).toEqual({ ok: false, error: 'A phone interaction extends beyond the scene.' });
    const overlap = validatePhoneActions([action({ id: uuid('1'), type: 'tap', start: 1, duration: 1 }), action({ id: uuid('2'), type: 'tap', start: 1.5, duration: 1 })], { sceneDuration: 10, characterIds: ['max'] });
    expect(overlap.ok).toBe(false);
    const apart = validatePhoneActions([action({ id: uuid('1'), type: 'tap', start: 1, duration: 1 }), action({ id: uuid('2'), type: 'tap', start: 3, duration: 1 })], { sceneDuration: 10, characterIds: ['max'] });
    expect(apart.ok).toBe(true);
  });

  it('gives a beginner a plain reason for a broken sequence', () => {
    const result = validatePhoneActions([action({ id: uuid('1'), type: 'put-away', start: 2, duration: 0.5 })], { sceneDuration: 10, characterIds: ['max'] });
    expect(result).toEqual({ ok: false, error: 'Add Take Out Phone before Put Away Phone, or start the scene with the phone already in hand.' });
    const carried = validatePhoneActions([action({ id: uuid('1'), type: 'put-away', start: 2, duration: 0.5 })], { sceneDuration: 10, characterIds: ['max'], phoneIn: 'right' });
    expect(carried.ok).toBe(true);
  });

  it('requires a real message, symbol and position for a communication', () => {
    const missing = validatePhoneActions([action({ id: uuid('1'), type: 'communicate', duration: 2 })], { sceneDuration: 10, characterIds: ['max'] });
    expect(missing).toEqual({ ok: false, error: 'A communication message must be 1 to 80 characters.' });
    const bad = validatePhoneActions([action({ id: uuid('1'), type: 'communicate', message: 'Hi', duration: 2, symbol: 'burger' as never, position: 'above-right' })], { sceneDuration: 10, characterIds: ['max'] });
    expect(bad).toEqual({ ok: false, error: 'Choose a communication symbol.' });
    const lonely = validatePhoneActions([action({ id: uuid('1'), type: 'communicate', message: 'Hi', duration: 2, symbol: 'food', position: 'above-right', assetId: uuid('9') })], { sceneDuration: 10, characterIds: ['max'] });
    expect(lonely.ok).toBe(false);
    const complete = validatePhoneActions([action({ id: uuid('1'), type: 'communicate', message: "I'm hungry!", duration: 2, symbol: 'food', position: 'above-right', assetId: uuid('9'), clipId: uuid('8') })], { sceneDuration: 10, characterIds: ['max'] });
    expect(complete.ok).toBe(true);
  });

  it('will not let a message sit unreadably briefly', () => {
    expect(validatePhoneActions([action({ id: uuid('1'), type: 'communicate', message: 'Hi', duration: 0.3, symbol: 'food', position: 'right' })], { sceneDuration: 10, characterIds: ['max'] }).ok).toBe(false);
    expect(validatePhoneActions([action({ id: uuid('1'), type: 'communicate', message: 'Hi', duration: 30, symbol: 'food', position: 'right' })], { sceneDuration: 40, characterIds: ['max'] }).ok).toBe(false);
  });

  it('names every action for the beginner buttons', () => {
    expect(Object.values(phoneActionNames)).toEqual(['Take Out Phone', 'Hold Phone', 'Tap Phone', 'Communicate Message', 'Put Away Phone']);
  });

  it('validates the symbol and position catalogues', () => {
    expect(isPhoneSymbol('food')).toBe(true);
    expect(isPhoneSymbol('burger')).toBe(false);
    expect(isPhonePosition('above-left')).toBe(true);
    expect(isPhonePosition('middle')).toBe(false);
  });
});

describe('phone state over scene time', () => {
  const sequence = [
    action({ id: uuid('1'), type: 'take-out', start: 1, duration: PHONE_RAISE_SECONDS, hand: 'left' }),
    action({ id: uuid('2'), type: 'communicate', start: 3, duration: 2, message: "I'm hungry!", symbol: 'food', position: 'above-right' }),
    action({ id: uuid('3'), type: 'put-away', start: 6, duration: PHONE_RAISE_SECONDS }),
  ];

  it('is put away before the take out and raised smoothly after it', () => {
    const scene = base(sequence);
    expect(phoneStateAt(scene, 'max', 0).held).toBe(false);
    const midway = phoneStateAt(scene, 'max', 1 + PHONE_RAISE_SECONDS / 2);
    expect(midway.held).toBe(true);
    expect(midway.raise).toBeGreaterThan(0.1);
    expect(midway.raise).toBeLessThan(0.95);
    expect(phoneStateAt(scene, 'max', 1 + PHONE_RAISE_SECONDS).raise).toBe(1);
  });

  it('remembers which hand took the phone out', () => {
    expect(phoneStateAt(base(sequence), 'max', 2).hand).toBe('left');
  });

  it('shows the pop-up only inside the communication window and fades it at both ends', () => {
    const scene = base(sequence);
    expect(phoneStateAt(scene, 'max', 2.9).popup).toBeNull();
    const fadingIn = phoneStateAt(scene, 'max', 3.05);
    expect(fadingIn.popup?.message).toBe("I'm hungry!");
    expect(fadingIn.popup!.opacity).toBeLessThan(0.9);
    expect(phoneStateAt(scene, 'max', 4).popup?.opacity).toBe(1);
    expect(phoneStateAt(scene, 'max', 5.01).popup).toBeNull();
  });

  it('puts the phone away and clears the pop-up', () => {
    const scene = base(sequence);
    expect(phoneStateAt(scene, 'max', 6.2).held).toBe(true);
    expect(phoneStateAt(scene, 'max', 6.2).raise).toBeLessThan(1);
    const away = phoneStateAt(scene, 'max', 6 + PHONE_RAISE_SECONDS);
    expect(away.held).toBe(false);
    expect(away.raise).toBe(0);
  });

  it('taps briefly and only briefly', () => {
    const scene = base([action({ id: uuid('1'), type: 'take-out', start: 0, duration: 0.5 }), action({ id: uuid('2'), type: 'tap', start: 2, duration: 0.5 })]);
    expect(phoneStateAt(scene, 'max', 1.9).tapping).toBe(false);
    expect(phoneStateAt(scene, 'max', 2.1).tapping).toBe(true);
    expect(phoneStateAt(scene, 'max', 2.3).tapping).toBe(true);
    expect(phoneStateAt(scene, 'max', 2.9).tapping).toBe(false);
  });

  it('is independent per Brightling', () => {
    const scene = base([action({ id: uuid('1'), characterId: 'max', type: 'take-out', start: 0, duration: 0.5 })]);
    expect(phoneStateAt(scene, 'maxine', 1).held).toBe(false);
  });

  it('carries a held phone into the next shot', () => {
    const carried = base([], 'right');
    const state = phoneStateAt(carried, 'max', 0);
    expect(state.held).toBe(true);
    expect(state.raise).toBe(1);
    expect(state.hand).toBe('right');
    const away = phoneStateAt(base([action({ id: uuid('1'), type: 'put-away', start: 2, duration: 0.5 })], 'right'), 'max', 4);
    expect(away.held).toBe(false);
  });
});

describe('phone speech', () => {
  const asset: AudioAssetInfo = { id: uuid('9'), name: 'Phone: I am hungry', kind: 'speech', mime: 'audio/wav', duration: 1.4, size: 1000 };
  const communication = action({ id: uuid('1'), type: 'communicate', start: 4, duration: 3, message: "I'm hungry!", symbol: 'food', position: 'above-right', assetId: asset.id, clipId: uuid('8') });

  it('starts after the tap so the device is seen before it speaks', () => {
    const clip = phoneSpeechClip(communication, asset, 20, uuid('8'));
    expect(clip.start).toBeCloseTo(4 + PHONE_SPEECH_LEAD_SECONDS, 5);
    expect(clip.assetId).toBe(asset.id);
  });

  it('is an assistive device voice, never attributed to the Brightling', () => {
    expect(phoneSpeechClip(communication, asset, 20, uuid('8')).speakerId).toBeUndefined();
  });

  it('fits inside a short scene instead of running past the end', () => {
    const clip = phoneSpeechClip(communication, asset, 5, uuid('8'));
    expect(clip.start + (clip.trimEnd - clip.trimStart)).toBeLessThanOrEqual(5 + 1e-6);
  });

  it('keeps the scene clip in step with the interaction and removes it when the voice is cleared', () => {
    const withClip = syncPhoneClip({ duration: 20, audio: [] }, communication, asset);
    expect(withClip).toHaveLength(1);
    const scene = { duration: 20, audio: withClip };
    expect(phoneSpeechPlaying(scene, communication, communication.start + PHONE_SPEECH_LEAD_SECONDS + 0.2)).toBe(true);
    expect(phoneSpeechPlaying(scene, communication, communication.start)).toBe(false);
    const cleared = syncPhoneClip(scene, communication, null);
    expect(cleared).toHaveLength(0);
  });
});

describe('hand anchors and pop-up placement', () => {
  const box = { x: 500, y: 400, width: 213, height: 355, sourceWidth: 434, sourceHeight: 724, direction: 1 };

  it('puts the phone at the measured hand and mirrors with a walking character', () => {
    const right = phoneAnchor('max', 'idle', 0, 'right', box)!;
    expect(right.x).toBeCloseTo(500 + 96 * (213 / 434), 1);
    expect(right.y).toBeCloseTo(400 + 517 * (355 / 724), 1);
    const left = phoneAnchor('max', 'idle', 0, 'left', box)!;
    expect(left.x).toBeGreaterThan(right.x);
    const forward = phoneAnchor('max', 'side', 2, 'right', { ...box, width: 239, sourceWidth: 500 })!;
    const mirrored = phoneAnchor('max', 'side', 2, 'right', { ...box, width: 239, sourceWidth: 500, direction: -1 })!;
    expect(mirrored.x).toBeCloseTo(2 * (box.x + (239 / 2)) - forward.x, 1);
  });

  it('returns nothing rather than floating when the far hand has no artwork', () => {
    expect(phoneAnchor('max', 'side', 0, 'left', { ...box, width: 213, sourceWidth: 500 })).toBeNull();
    expect(phoneAnchor('max', 'side', 2, 'right', { ...box, width: 239, sourceWidth: 500 })).not.toBeNull();
  });

  it('keeps every pop-up inside the frame', () => {
    for (const position of ['above-left', 'above-right', 'left', 'right'] as const) {
      for (const x of [-200, 0, WIDTH / 2, WIDTH + 200]) {
        const boxOut = phonePopupBox(x, HEIGHT, position);
        expect(boxOut.x).toBeGreaterThanOrEqual(28);
        expect(boxOut.x + 470 * 0.74).toBeLessThanOrEqual(WIDTH);
        expect(boxOut.y).toBeGreaterThanOrEqual(28);
        expect(boxOut.y + 210 * 0.74).toBeLessThanOrEqual(HEIGHT);
      }
    }
  });

  it('puts the pop-up beside the character rather than over the face', () => {
    const above = phonePopupBox(800, 790, 'above-right', 470 * 0.74, 210 * 0.74);
    const beside = phonePopupBox(800, 790, 'right', 470 * 0.74, 210 * 0.74);
    expect(above.y).toBeLessThan(790 - 355);
    expect(beside.x).toBeGreaterThan(800);
  });

  it('keeps the pop-up clear of the head for an "above" placement and near the phone', () => {
    // The character's head occupies roughly y-355 to y; an above-head pop-up must end above it.
    const characterY = 790;
    const above = phonePopupBox(700, characterY, 'above-right');
    expect(above.y + 210 * 0.74).toBeLessThanOrEqual(characterY - 355);
    // And it sits close enough to read as coming from the device.
    const beside = phonePopupBox(700, characterY, 'right');
    expect(beside.x - 700).toBeLessThanOrEqual(42 + 1);
  });
});

describe('scene integration', () => {
  const scene = (over: Partial<TimedScene> = {}): TimedScene => ({
    id: uuid('1'), name: 'Phone scene', duration: 20, placeId: 'living-room',
    characters: { max: { x: 700, y: 790 } },
    actions: [{ id: uuid('2'), characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 700, y: 790 } }],
    ...over,
  });

  it('loads scenes saved before phones existed', () => {
    const older = { version: 1 as const, scenes: [scene()] };
    expect(validateTimedLibrary(older).ok).toBe(true);
  });

  it('keeps phone interactions inside scene validation with a readable reason', () => {
    const broken = { version: 1 as const, scenes: [scene({ phone: [action({ id: uuid('3'), type: 'communicate', start: 1, duration: 1 })] })] };
    const result = validateTimedLibrary(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/phone|communication/i);
  });

  it('accepts a complete interaction and a carried-in hand', () => {
    const full = scene({
      phoneIn: null,
      phone: [
        action({ id: uuid('3'), type: 'take-out', start: 1, duration: 0.5, hand: 'right' }),
        action({ id: uuid('4'), type: 'communicate', start: 4, duration: 3, message: "I'm hungry!", symbol: 'food', position: 'above-right' }),
        action({ id: uuid('5'), type: 'put-away', start: 9, duration: 0.5 }),
      ],
    });
    expect(validateTimedLibrary({ version: 1, scenes: [full] }).ok).toBe(true);
    expect(validateTimedLibrary({ version: 1, scenes: [{ ...full, phoneIn: 'left' }] }).ok).toBe(true);
  });

  it('drops phone interactions when their Brightling is removed', () => {
    const pruned = prunePhoneActions([
      action({ id: uuid('3'), characterId: 'max', type: 'take-out' }),
      action({ id: uuid('4'), characterId: 'maxine', type: 'take-out' }),
    ], ['max']);
    expect(pruned?.map(item => item.id)).toEqual([uuid('3')]);
  });
});
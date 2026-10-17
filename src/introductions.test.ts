import { describe, expect, it } from 'vitest';
import { clipLength, type AudioClip } from './audio';
import { decodeIntroLibrary, INTRO_MAX_DURATION, INTRO_MIN_DURATION, introTitleOpacity, newIntro, validateIntro, validateIntroLibrary, type Intro } from './introductions';
import { DEFAULT_PLACE_ORGANISATION } from './placeFolders';
import { createStudioBackup, restoreStudioBackup, STUDIO_BACKUP_VERSION, validateStudioBackup } from './studioBackup';
import type { TimedScene } from './timedScenes';

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const PLACES = ['living-room'];

const baseIntro = (): Intro => ({
  id: id(1), name: 'Opening Titles', duration: 8, placeId: 'living-room',
  characters: { max: { x: 700, y: 790 } },
  actions: [{ id: id(2), characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 700, y: 790 } }],
  seriesTitle: 'The Little Living Room', episodeTitle: 'Episode 1', titleStyle: 'banner',
});
const asScene = (intro: Intro): TimedScene => intro;
const musicClip = (over: Partial<AudioClip> = {}): AudioClip => ({ id: id(30), assetId: id(31), start: 0, trimStart: 0, trimEnd: 4, volume: .35, fadeIn: 0, fadeOut: 0, ...over });

describe('intro library', () => {
  it('accepts a complete intro and keeps the shared scene structure intact', () => {
    const checked = validateIntro(baseIntro(), PLACES);
    expect(typeof checked).not.toBe('string');
    const intro = checked as Intro;
    expect(intro.seriesTitle).toBe('The Little Living Room');
    expect(intro.episodeTitle).toBe('Episode 1');
    expect(intro.titleStyle).toBe('banner');
    // The intro is a timed scene, so the one animation engine reads it directly.
    expect(intro.characters.max).toEqual({ x: 700, y: 790 });
    expect(intro.actions[0].type).toBe('appear');
  });

  it('rejects missing or oversized titles and an unknown title style', () => {
    expect(typeof validateIntro({ ...baseIntro(), seriesTitle: '  ' }, PLACES)).toBe('string');
    expect(typeof validateIntro({ ...baseIntro(), episodeTitle: 'x'.repeat(200) }, PLACES)).toBe('string');
    expect(typeof validateIntro({ ...baseIntro(), titleStyle: 'sparkle' }, PLACES)).toBe('string');
  });

  it('enforces the intro length range', () => {
    expect(typeof validateIntro({ ...baseIntro(), duration: INTRO_MIN_DURATION - 1 }, PLACES)).toBe('string');
    expect(typeof validateIntro({ ...baseIntro(), duration: INTRO_MAX_DURATION + 1 }, PLACES)).toBe('string');
    expect(typeof validateIntro({ ...baseIntro(), duration: INTRO_MIN_DURATION }, PLACES)).not.toBe('string');
  });

  it('delegates place, position, action and audio rules to the shared scene validator', () => {
    expect(typeof validateIntro({ ...baseIntro(), placeId: 'bedroom' }, PLACES)).toBe('string');
    expect(typeof validateIntro({ ...baseIntro(), characters: { max: { x: 5, y: 5 } } }, PLACES)).toBe('string');
    expect(typeof validateIntro({ ...baseIntro(), actions: [{ id: id(2), characterId: 'maxine', type: 'appear', start: 0, duration: 0, point: { x: 700, y: 790 } }] }, PLACES)).toBe('string');
    // An action running past the intro end is rejected by the shared rule.
    expect(typeof validateIntro({ ...baseIntro(), duration: 1, actions: [{ id: id(2), characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 700, y: 790 } }] }, PLACES)).toBe('string');
  });

  it('accepts intro music and applies the same clip rules as a timed scene', () => {
    // Music may be trimmed beyond the intro end, exactly as a scene allows it; playback stops with the intro.
    expect(typeof validateIntro({ ...baseIntro(), audio: [musicClip()] }, PLACES)).not.toBe('string');
    expect(typeof validateIntro({ ...baseIntro(), audio: [musicClip({ start: 6, trimEnd: 10 })] }, PLACES)).not.toBe('string');
    // Structural clip rules still apply.
    expect(typeof validateIntro({ ...baseIntro(), audio: [musicClip({ volume: 2 })] }, PLACES)).toBe('string');
    expect(typeof validateIntro({ ...baseIntro(), audio: [musicClip({ start: -1 })] }, PLACES)).toBe('string');
  });

  it('refuses an attributed voice clip that would be cut off by the intro ending', () => {
    const spoken: AudioClip = { ...musicClip({ start: 6, trimStart: 0, trimEnd: 10 }), speakerId: 'narrator' };
    expect(typeof validateIntro({ ...baseIntro(), audio: [spoken] }, PLACES)).toBe('string');
    const fits = { ...musicClip({ start: 0, trimStart: 0, trimEnd: 3 }), speakerId: 'narrator' };
    expect(typeof validateIntro({ ...baseIntro(), audio: [fits] }, PLACES)).not.toBe('string');
  });

  it('rejects duplicate saved ids and non-JSON storage', () => {
    expect(validateIntroLibrary({ version: 1, intros: [baseIntro(), baseIntro()] }, PLACES).ok).toBe(false);
    expect(validateIntroLibrary({ version: 1, intros: [baseIntro()] }, PLACES).ok).toBe(true);
    expect(decodeIntroLibrary('{not json', PLACES).ok).toBe(false);
    expect(decodeIntroLibrary(null, PLACES)).toEqual({ ok: true, library: { version: 1, intros: [] } });
  });

  it('creates a fresh intro that validates against a place with artwork', () => {
    const intro = newIntro('living-room');
    expect(intro.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(typeof validateIntro(intro, PLACES)).not.toBe('string');
  });

  it('shows titles from the first frame and eases them out at the end', () => {
    const intro = asScene(baseIntro());
    // Visible at 0.0s so the editor never opens on a blank stage.
    expect(introTitleOpacity(intro, 0)).toBe(1);
    expect(introTitleOpacity(intro, 4)).toBe(1);
    expect(introTitleOpacity(intro, intro.duration - 1.2)).toBeGreaterThan(0.9);
    expect(introTitleOpacity(intro, intro.duration)).toBe(0);
    expect(introTitleOpacity(intro, intro.duration + 5)).toBe(0);
  });

  it('stops intro playback at the intro end without cutting a started clip short mid-intro', () => {
    const clip = musicClip({ start: 6, trimStart: 1, trimEnd: 9 });
    expect(clipLength(clip)).toBe(8);
    // The clip is still scheduled; only playback ends when the intro ends, matching scene behaviour.
    const checked = validateIntro({ ...baseIntro(), audio: [clip] }, PLACES);
    expect(typeof checked).not.toBe('string');
    expect((checked as Intro).audio?.[0].start).toBe(6);
  });
});

describe('intros in Studio Backup', () => {
  it('round-trips intros through a current backup', () => {
    const intros = { version: 1 as const, intros: [baseIntro()] };
    const backup = createStudioBackup([], null, new Date('2026-10-17T12:00:00.000Z'), DEFAULT_PLACE_ORGANISATION, { version: 1, scenes: [] }, { version: 1, episodes: [] }, [], intros);
    expect(backup.version).toBe(STUDIO_BACKUP_VERSION);
    const checked = validateStudioBackup(backup);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.backup.intros?.intros[0].episodeTitle).toBe('Episode 1');
    expect(checked.backup.intros?.intros[0].seriesTitle).toBe('The Little Living Room');
  });

  it('accepts an older version 5 backup without intros', () => {
    const legacy = { ...createStudioBackup([], null, new Date(), DEFAULT_PLACE_ORGANISATION), version: 5, audioAssets: [], intros: undefined } as unknown;
    const checked = validateStudioBackup(legacy);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.backup.intros).toBeNull();
  });

  it('keeps existing intros when an older backup is restored', () => {
    const store = new Map<string, string>([['brightsenappstales.introductions.v1', JSON.stringify({ version: 1, intros: [baseIntro()] })]]);
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); }, removeItem: (key: string) => { store.delete(key); } };
    const legacy = validateStudioBackup({ ...createStudioBackup([], null, new Date(), DEFAULT_PLACE_ORGANISATION), version: 5, audioAssets: [], intros: undefined } as unknown);
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) return;
    expect(restoreStudioBackup(storage, 'brightsenappstales.brightlings.v1', 'brightsenappstales.scene.v1', legacy.backup).ok).toBe(true);
    const kept = JSON.parse(store.get('brightsenappstales.introductions.v1')!);
    expect(kept.intros[0].episodeTitle).toBe('Episode 1');
  });

  it('rejects an intro that refers to a Brightling missing from the backup', () => {
    const intro: Intro = { ...baseIntro(), characters: { 'brightling-22222222-2222-4222-8222-222222222222': { x: 700, y: 790 } }, actions: [{ id: id(3), characterId: 'brightling-22222222-2222-4222-8222-222222222222', type: 'appear', start: 0, duration: 0, point: { x: 700, y: 790 } }] };
    const backup = { ...createStudioBackup([], null, new Date(), DEFAULT_PLACE_ORGANISATION), intros: { version: 1, intros: [intro] } } as unknown;
    const checked = validateStudioBackup(backup);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.error).toContain('intro');
  });

  it('rejects intro audio clips with no audio files in the backup', () => {
    const backup = { ...createStudioBackup([], null, new Date(), DEFAULT_PLACE_ORGANISATION), audioAssets: null, intros: { version: 1, intros: [{ ...baseIntro(), audio: [musicClip()] }] } } as unknown;
    const checked = validateStudioBackup(backup);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.error).toContain('audio');
  });
});
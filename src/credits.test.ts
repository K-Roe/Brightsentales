import { describe, expect, it } from 'vitest';
import type { AudioClip } from './audio';
import {
  CREDITS_MAX_DURATION, CREDITS_MAX_LINES, CREDITS_MAX_SPEED, CREDITS_MIN_DURATION, CREDITS_MIN_SPEED,
  CREDIT_BOTTOM, CREDIT_TOP, creditRowsAt, creditsAsScene, creditsOffset, decodeCreditsLibrary,
  newCredits, validateCredits, validateCreditsLibrary, validateCreditsLine, type CreditLine, type Credits,
} from './credits';
import { DEFAULT_PLACE_ORGANISATION } from './placeFolders';
import { createStudioBackup, restoreStudioBackup, STUDIO_BACKUP_VERSION, validateStudioBackup } from './studioBackup';

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const PLACES = ['living-room'];
const line = (n: number, heading = '', name = '', role = ''): CreditLine => ({ id: id(n), heading, name, role });

const base = (): Credits => ({
  id: id(1), name: 'End Credits', title: 'Credits', duration: 20, placeId: 'living-room',
  lines: [line(2, 'Created by', 'Karl'), line(3, 'Music', 'Theme', 'BrightBeats')],
  mode: 'scroll', scrollSpeed: 2,
});
const clip = (over: Partial<AudioClip> = {}): AudioClip => ({ id: id(40), assetId: id(41), start: 0, trimStart: 0, trimEnd: 5, volume: .35, fadeIn: 0, fadeOut: 0, ...over });

describe('credit lines', () => {
  it('accepts a complete line and rejects bad ids or overlong text', () => {
    expect(validateCreditsLine(line(2, 'Created by', 'Karl', 'Writer'))).toEqual(line(2, 'Created by', 'Karl', 'Writer'));
    expect(validateCreditsLine({ ...line(2), id: 'nope' })).toBeNull();
    expect(validateCreditsLine({ ...line(2), name: 'x'.repeat(200) })).toBeNull();
    expect(validateCreditsLine({ ...line(2), heading: 5 })).toBeNull();
  });

  it('allows an empty heading and empty role so a credit can be just a name', () => {
    expect(typeof validateCredits({ ...base(), lines: [line(2, '', 'Karl')] }, PLACES)).not.toBe('string');
  });
});

describe('credits validation', () => {
  it('accepts a complete credits sequence', () => {
    const checked = validateCredits(base(), PLACES);
    expect(typeof checked).not.toBe('string');
    expect((checked as Credits).lines).toHaveLength(2);
  });

  it('requires at least one line with a name or a role', () => {
    expect(typeof validateCredits({ ...base(), lines: [line(2)] }, PLACES)).toBe('string');
    expect(typeof validateCredits({ ...base(), lines: [] }, PLACES)).toBe('string');
  });

  it('rejects duplicate line ids and too many lines', () => {
    expect(typeof validateCredits({ ...base(), lines: [line(2, 'A', 'B'), line(2, 'C', 'D')] }, PLACES)).toBe('string');
    const many = Array.from({ length: CREDITS_MAX_LINES + 1 }, (_, i) => line(1000 + i, 'A', `N${i}`));
    expect(typeof validateCredits({ ...base(), lines: many }, PLACES)).toBe('string');
  });

  it('enforces the duration and scroll speed ranges', () => {
    expect(typeof validateCredits({ ...base(), duration: CREDITS_MIN_DURATION - 1 }, PLACES)).toBe('string');
    expect(typeof validateCredits({ ...base(), duration: CREDITS_MAX_DURATION + 1 }, PLACES)).toBe('string');
    expect(typeof validateCredits({ ...base(), scrollSpeed: CREDITS_MIN_SPEED - 1 }, PLACES)).toBe('string');
    expect(typeof validateCredits({ ...base(), scrollSpeed: CREDITS_MAX_SPEED + 1 }, PLACES)).toBe('string');
    expect(typeof validateCredits({ ...base(), mode: 'spinning', scrollSpeed: 5 } as unknown, PLACES)).toBe('string');
  });

  it('requires an available background place', () => {
    expect(typeof validateCredits({ ...base(), placeId: 'bedroom' }, PLACES)).toBe('string');
  });

  it('applies the shared audio clip rules', () => {
    expect(typeof validateCredits({ ...base(), audio: [clip()] }, PLACES)).not.toBe('string');
    expect(typeof validateCredits({ ...base(), audio: [clip({ volume: 3 })] }, PLACES)).toBe('string');
    expect(typeof validateCredits({ ...base(), audio: [clip({ trimEnd: 0 })] }, PLACES)).toBe('string');
  });

  it('rejects duplicate saved credits ids and invalid JSON, and treats missing storage as empty', () => {
    expect(validateCreditsLibrary({ version: 1, credits: [base(), base()] }, PLACES).ok).toBe(false);
    expect(validateCreditsLibrary({ version: 1, credits: [base()] }, PLACES).ok).toBe(true);
    expect(decodeCreditsLibrary('{oops', PLACES).ok).toBe(false);
    expect(decodeCreditsLibrary(null, PLACES)).toEqual({ ok: true, library: { version: 1, credits: [] } });
  });

  it('creates a fresh credits sequence that validates', () => {
    const credits = newCredits('living-room');
    expect(credits.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(credits.lines).toHaveLength(1);
  });

  it('presents credits through the shared scene model so one renderer serves both', () => {
    const scene = creditsAsScene({ ...base(), audio: [clip()] });
    expect(scene.characters).toEqual({});
    expect(scene.actions).toEqual([]);
    expect(scene.placeId).toBe('living-room');
    expect(scene.duration).toBe(20);
    expect(scene.audio).toHaveLength(1);
  });
});

describe('credits timing', () => {
  const many = Array.from({ length: 14 }, (_, i) => line(200 + i, 'Heading', `Person ${i}`));

  it('centres short static credits instead of scrolling', () => {
    const credits = { ...base(), mode: 'static' as const, lines: [line(2, 'Created by', 'Karl')] };
    expect(creditsOffset(credits, 0)).toBe(creditsOffset(credits, 10));
    expect(creditsOffset(credits, 10)).toBeGreaterThan(CREDIT_TOP);
  });

  it('holds short scrolling credits centred when they already fit', () => {
    const credits = { ...base(), mode: 'scroll' as const, lines: [line(2, 'Created by', 'Karl')] };
    expect(creditsOffset(credits, 0)).toBe(creditsOffset(credits, 10));
  });

  it('moves long scrolling credits upward over time', () => {
    const credits = { ...base(), mode: 'scroll' as const, lines: many, duration: 30, scrollSpeed: 3 };
    const start = creditsOffset(credits, 0);
    const middle = creditsOffset(credits, 10);
    const end = creditsOffset(credits, 30);
    expect(middle).toBeLessThan(start);
    expect(end).toBeLessThan(middle);
  });

  it('slows automatically so the last credit is on screen at the end of a short sequence', () => {
    // 14 lines cannot scroll at 8 lines/s in 3 seconds, so the offset must still be on stage.
    const credits = { ...base(), mode: 'scroll' as const, lines: many, duration: 3, scrollSpeed: CREDITS_MAX_SPEED };
    const end = creditsOffset(credits, 3);
    const top = creditsOffset(credits, 0);
    expect(end).toBeLessThan(top);
    // The list bottom should not have scrolled far above the stage.
    expect(end).toBeGreaterThan(CREDIT_TOP - 200);
  });

  it('lays out a title, headings, names and roles in order', () => {
    const credits = { ...base(), mode: 'static' as const, lines: [line(2, 'Music', 'Theme', 'BrightBeats')] };
    const rows = creditRowsAt({ ...credits, title: 'Credits' }, 0).rows;
    expect(rows[0].text).toBe('Credits');
    expect(rows.map(row => row.text)).toEqual(['Credits', 'Music', 'Theme', 'BrightBeats']);
    // Every row sits lower than the one before it.
    for (let i = 1; i < rows.length; i++) expect(rows[i].y).toBeGreaterThan(rows[i - 1].y);
  });

  it('omits the role row when no role is set', () => {
    const rows = creditRowsAt({ ...base(), mode: 'static', lines: [line(2, 'Created by', 'Karl')] }, 0).rows;
    expect(rows.map(row => row.text)).toEqual(['Credits', 'Created by', 'Karl']);
  });
});

describe('credits in Studio Backup', () => {
  it('round-trips credits through a current backup', () => {
    const credits = { version: 1 as const, credits: [base()] };
    const backup = createStudioBackup([], null, new Date('2026-10-17T12:00:00.000Z'), DEFAULT_PLACE_ORGANISATION, { version: 1, scenes: [] }, { version: 1, episodes: [] }, [], { version: 1, intros: [] }, credits);
    expect(backup.version).toBe(STUDIO_BACKUP_VERSION);
    const checked = validateStudioBackup(backup);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.backup.credits?.credits[0].title).toBe('Credits');
    expect(checked.backup.credits?.credits[0].lines).toHaveLength(2);
  });

  it('accepts older backups that carry no credits field', () => {
    const legacy = { ...createStudioBackup([], null, new Date(), DEFAULT_PLACE_ORGANISATION), version: 6, audioAssets: [], intros: { version: 1, intros: [] }, credits: undefined } as unknown;
    const checked = validateStudioBackup(legacy);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.backup.credits).toBeNull();
  });

  it('keeps existing credits when an older backup is restored', () => {
    const store = new Map<string, string>([['brightsenappstales.credits.v1', JSON.stringify({ version: 1, credits: [base()] })]]);
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); }, removeItem: (key: string) => { store.delete(key); } };
    const legacy = validateStudioBackup({ ...createStudioBackup([], null, new Date(), DEFAULT_PLACE_ORGANISATION), version: 6, audioAssets: [], intros: { version: 1, intros: [] }, credits: undefined } as unknown);
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) return;
    expect(restoreStudioBackup(storage, 'brightsenappstales.brightlings.v1', 'brightsenappstales.scene.v1', legacy.backup).ok).toBe(true);
    expect(JSON.parse(store.get('brightsenappstales.credits.v1')!).credits[0].title).toBe('Credits');
  });

  it('rejects credits music clips when the backup carries no audio files', () => {
    const backup = { ...createStudioBackup([], null, new Date(), DEFAULT_PLACE_ORGANISATION), audioAssets: null, credits: { version: 1, credits: [{ ...base(), audio: [clip()] }] } } as unknown;
    const checked = validateStudioBackup(backup);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.error).toContain('audio');
  });

  it('rejects a credits clip pointing at audio missing from the backup', () => {
    const backup = { ...createStudioBackup([], null, new Date(), DEFAULT_PLACE_ORGANISATION), credits: { version: 1, credits: [{ ...base(), audio: [clip()] }] } } as unknown;
    const checked = validateStudioBackup(backup);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.error).toContain('audio');
  });

  it('restores credits through the real storage path', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); }, removeItem: (key: string) => { store.delete(key); } };
    const backup = createStudioBackup([], null, new Date('2026-10-17T12:00:00.000Z'), DEFAULT_PLACE_ORGANISATION, { version: 1, scenes: [] }, { version: 1, episodes: [] }, [], { version: 1, intros: [] }, { version: 1, credits: [{ ...base(), id: id(9) }] });
    expect(restoreStudioBackup(storage, 'brightsenappstales.brightlings.v1', 'brightsenappstales.scene.v1', backup).ok).toBe(true);
    const saved = JSON.parse(store.get('brightsenappstales.credits.v1')!);
    expect(saved.credits[0].lines[1].name).toBe('Theme');
  });
});
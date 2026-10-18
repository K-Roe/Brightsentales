import { describe, expect, it } from 'vitest';
import { APPEARANCE_KEY, LEGACY_MUSIC_THEME_KEY, readAppearance, resolveAppearance } from './appearance';

describe('appearance preference', () => {
  const storage = (values: Record<string, string>) => ({ getItem: (key: string) => values[key] ?? null });
  it('defaults to dark and preserves an older Music Studio choice', () => {
    expect(readAppearance(storage({}))).toBe('dark');
    expect(readAppearance(storage({ [LEGACY_MUSIC_THEME_KEY]: 'light' }))).toBe('light');
    expect(readAppearance(storage({ [LEGACY_MUSIC_THEME_KEY]: 'light', [APPEARANCE_KEY]: 'dark' }))).toBe('dark');
  });
  it('resolves System and survives unavailable storage', () => {
    expect(resolveAppearance('system', true)).toBe('dark');
    expect(resolveAppearance('system', false)).toBe('light');
    expect(readAppearance({ getItem: () => { throw Error('blocked'); } })).toBe('dark');
  });
});

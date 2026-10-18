export const APPEARANCE_KEY = 'brightsenappstales.appearance';
export const LEGACY_MUSIC_THEME_KEY = 'brightsenappstales.music-theme';
export type Appearance = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export function readAppearance(storage?: Pick<Storage, 'getItem'> | null): Appearance {
  try {
    const source = storage === undefined ? localStorage : storage;
    const saved = source?.getItem(APPEARANCE_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
    const music = source?.getItem(LEGACY_MUSIC_THEME_KEY);
    if (music === 'dark' || music === 'light') return music;
  } catch { /* a private browser may reject local storage */ }
  return 'dark';
}

export function resolveAppearance(appearance: Appearance, systemDark: boolean): ResolvedTheme {
  return appearance === 'system' ? systemDark ? 'dark' : 'light' : appearance;
}

export function saveAppearance(appearance: Appearance, storage?: Pick<Storage, 'setItem'> | null): void {
  try { (storage === undefined ? localStorage : storage)?.setItem(APPEARANCE_KEY, appearance); } catch { /* keep the session setting */ }
}

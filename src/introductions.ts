import { validateTimedLibrary, type TimedAction, type TimedScene } from './timedScenes';
import type { Point } from './scene';

export const INTROS_KEY = 'brightsenappstales.introductions.v1';

/** Title presentation styles. Both are plain canvas text over the approved place artwork. */
export type IntroTitleStyle = 'plain' | 'banner';

export const INTRO_TITLE_STYLES: Record<IntroTitleStyle, string> = { plain: 'Plain', banner: 'Banner' };

/**
 * An intro is a timed scene plus title text. Reusing `TimedScene` keeps one
 * animation engine (`stateAt`), one preview renderer and one audio clock rather
 * than a parallel intro-specific scene format.
 */
export type Intro = TimedScene & { seriesTitle: string; episodeTitle: string; titleStyle: IntroTitleStyle };

export type IntroLibrary = { version: 1; intros: Intro[] };
export type IntroResult = { ok: true; library: IntroLibrary } | { ok: false; error: string };

export const EMPTY_INTRO_LIBRARY: IntroLibrary = { version: 1, intros: [] };

export const INTRO_TITLE_LIMIT = 120;
export const INTRO_MIN_DURATION = 2;
export const INTRO_MAX_DURATION = 600;
/** Titles fade rather than pop so a reused intro reads calmly in a finished production. */
export const INTRO_TITLE_FADE = 0.8;

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const clean = (value: unknown, limit: number): value is string => typeof value === 'string' && !!value.trim() && value === value.trim() && value.length <= limit;

function asScene(intro: Intro): TimedScene {
  return { id: intro.id, name: intro.name, duration: intro.duration, placeId: intro.placeId, characters: intro.characters, actions: intro.actions, ...(intro.audio === undefined ? {} : { audio: intro.audio }) };
}

export function validateIntro(intro: unknown, availablePlaces: string[]): Intro | string {
  if (!intro || typeof intro !== 'object') return 'An intro is invalid.';
  const value = intro as Partial<Intro>;
  if (!clean(value.seriesTitle, INTRO_TITLE_LIMIT) || !clean(value.episodeTitle, INTRO_TITLE_LIMIT)) return 'Intro titles are missing or too long.';
  if (value.titleStyle !== 'plain' && value.titleStyle !== 'banner') return 'An intro title style is invalid.';
  if (!Number.isFinite(value.duration) || (value.duration as number) < INTRO_MIN_DURATION || (value.duration as number) > INTRO_MAX_DURATION) return 'Intro length is outside the supported range.';
  // Delegate every structural rule (IDs, points, actions, audio bounds) to the shared scene validator.
  const checked = validateTimedLibrary({ version: 1, scenes: [asScene(value as Intro)] }, availablePlaces);
  if (!checked.ok) return checked.error;
  return { ...checked.library.scenes[0], seriesTitle: value.seriesTitle, episodeTitle: value.episodeTitle, titleStyle: value.titleStyle };
}

export function validateIntroLibrary(value: unknown, availablePlaces: string[]): IntroResult {
  if (!value || typeof value !== 'object' || (value as IntroLibrary).version !== 1 || !Array.isArray((value as IntroLibrary).intros)) return { ok: false, error: 'Saved intros are invalid.' };
  const intros = (value as IntroLibrary).intros;
  if (intros.length > 100) return { ok: false, error: 'Too many intros.' };
  const seen = new Set<string>();
  const output: Intro[] = [];
  for (const entry of intros) {
    const result = validateIntro(entry, availablePlaces);
    if (typeof result === 'string') return { ok: false, error: result };
    if (seen.has(result.id)) return { ok: false, error: 'Two intros share the same saved ID.' };
    seen.add(result.id);
    output.push(result);
  }
  return { ok: true, library: { version: 1, intros: output } };
}

export function decodeIntroLibrary(raw: string | null, availablePlaces: string[]): IntroResult {
  if (raw === null) return { ok: true, library: structuredClone(EMPTY_INTRO_LIBRARY) };
  try { return validateIntroLibrary(JSON.parse(raw), availablePlaces); }
  catch { return { ok: false, error: 'Saved intros are not valid JSON.' }; }
}

export function newIntro(placeId: string): Intro {
  return { id: crypto.randomUUID(), name: 'My Intro', duration: 8, placeId, characters: {}, actions: [], seriesTitle: 'My Series', episodeTitle: 'Episode 1', titleStyle: 'banner' };
}

/**
 * Title opacity at a given intro time. Titles stay fully visible from the first
 * frame so the editor never opens on a blank stage, then ease out at the end.
 */
export function introTitleOpacity(intro: Pick<Intro, 'duration'>, time: number): number {
  const fade = Math.min(INTRO_TITLE_FADE, intro.duration / 4);
  const outGain = Math.max(0, Math.min(1, (intro.duration - time) / fade));
  return Math.max(0, Math.min(1, outGain));
}

export type { Point, TimedAction };
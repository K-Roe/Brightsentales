import { clipLength, validAudioClips, type AudioClip } from './audio';
import { HEIGHT, WIDTH } from './scene';
import type { TimedScene } from './timedScenes';

export const CREDITS_KEY = 'brightsenappstales.credits.v1';

/** How the credit list is presented. Both are deterministic functions of time. */
export type CreditsMode = 'static' | 'scroll';

export const CREDITS_MODES: Record<CreditsMode, string> = { static: 'Static', scroll: 'Scrolling' };

/** One visible credit entry: an optional heading, a name and an optional role. */
export type CreditLine = { id: string; heading: string; name: string; role: string };

/**
 * Reusable end credits. Credits have no characters, so they deliberately do not
 * carry a scene action list. Background, duration and audio reuse the shared
 * timed-scene rules, and `creditsAsScene` lets the existing scene renderer and
 * the existing audio clock draw them without a second engine.
 */
export type Credits = {
  id: string;
  name: string;
  title: string;
  duration: number;
  placeId: string;
  lines: CreditLine[];
  mode: CreditsMode;
  /** Lines per second for scrolling credits. Ignored in static mode. */
  scrollSpeed: number;
  audio?: AudioClip[];
};

export type CreditsLibrary = { version: 1; credits: Credits[] };
export type CreditsResult = { ok: true; library: CreditsLibrary } | { ok: false; error: string };
export const EMPTY_CREDITS_LIBRARY: CreditsLibrary = { version: 1, credits: [] };

export const CREDITS_MIN_DURATION = 2;
export const CREDITS_MAX_DURATION = 900;
export const CREDITS_MAX_LINES = 120;
export const CREDITS_MIN_SPEED = 0.2;
export const CREDITS_MAX_SPEED = 8;
export const CREDIT_HEADING_LIMIT = 60;
export const CREDIT_NAME_LIMIT = 80;
export const CREDIT_ROLE_LIMIT = 80;
/** Playback area for credit text, leaving the stage edges clear. */
export const CREDIT_TOP = 150;
export const CREDIT_BOTTOM = HEIGHT - 110;
export const CREDIT_LINE_HEIGHT = 62;
export const CREDIT_TITLE_HEIGHT = 120;

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const clean = (value: unknown, limit: number): value is string => typeof value === 'string' && value === value.trim() && value.length <= limit;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Presents credits to the existing scene renderer so backgrounds and audio stay consistent. */
export function creditsAsScene(credits: Credits): TimedScene {
  return { id: credits.id, name: credits.name, duration: credits.duration, placeId: credits.placeId, characters: {}, actions: [], ...(credits.audio === undefined ? {} : { audio: credits.audio }) };
}

export function validateCreditsLine(value: unknown): CreditLine | null {
  if (!value || typeof value !== 'object') return null;
  const line = value as Partial<CreditLine>;
  const { id: lineId, heading, name: lineName, role } = line;
  if (!uuid.test(lineId ?? '') || !clean(heading, CREDIT_HEADING_LIMIT) || !clean(lineName, CREDIT_NAME_LIMIT) || !clean(role, CREDIT_ROLE_LIMIT)) return null;
  return { id: lineId as string, heading, name: lineName, role };
}

export function validateCredits(value: unknown, availablePlaces: string[]): Credits | string {
  if (!value || typeof value !== 'object') return 'Credits are invalid.';
  const c = value as Partial<Credits>;
  if (!uuid.test(c.id ?? '')) return 'Credits are invalid.';
  if (!clean(c.name, 80) || !c.name) return 'A credits name is missing or too long.';
  if (!clean(c.title, 120)) return 'A credits title is missing or too long.';
  const placeId = c.placeId ?? '';
  if (!availablePlaces.includes(placeId)) return 'The credits background place is unavailable.';
  if (!finite(c.duration) || c.duration < CREDITS_MIN_DURATION || c.duration > CREDITS_MAX_DURATION) return 'Credits length is outside the supported range.';
  if (c.mode !== 'static' && c.mode !== 'scroll') return 'The credits presentation style is invalid.';
  if (!finite(c.scrollSpeed) || c.scrollSpeed < CREDITS_MIN_SPEED || c.scrollSpeed > CREDITS_MAX_SPEED) return 'Scroll speed is outside the supported range.';
  if (!Array.isArray(c.lines) || c.lines.length > CREDITS_MAX_LINES) return 'The credits list is invalid.';
  const lines = c.lines.map(validateCreditsLine);
  if (lines.some(line => line === null)) return 'A credit line is invalid.';
  if (new Set(lines.map(line => line!.id)).size !== lines.length) return 'Two credit lines share the same ID.';
  if (!lines.some(line => line!.name || line!.role)) return 'Add at least one credit line with a name or a role.';
  if (c.audio !== undefined && !validAudioClips(c.audio, c.duration)) return 'A credits music clip is invalid.';
  return { id: c.id as string, name: c.name, title: c.title, duration: c.duration, placeId, lines: lines as CreditLine[], mode: c.mode, scrollSpeed: c.scrollSpeed, ...(c.audio === undefined ? {} : { audio: c.audio }) };
}

export function validateCreditsLibrary(value: unknown, availablePlaces: string[]): CreditsResult {
  if (!value || typeof value !== 'object' || (value as CreditsLibrary).version !== 1 || !Array.isArray((value as CreditsLibrary).credits)) return { ok: false, error: 'Saved credits are invalid.' };
  const entries = (value as CreditsLibrary).credits;
  if (entries.length > 100) return { ok: false, error: 'Too many saved credits.' };
  const seen = new Set<string>();
  const output: Credits[] = [];
  for (const entry of entries) {
    const result = validateCredits(entry, availablePlaces);
    if (typeof result === 'string') return { ok: false, error: result };
    if (seen.has(result.id)) return { ok: false, error: 'Two saved credits share the same ID.' };
    seen.add(result.id);
    output.push(result);
  }
  return { ok: true, library: { version: 1, credits: output } };
}

export function decodeCreditsLibrary(raw: string | null, availablePlaces: string[]): CreditsResult {
  if (raw === null) return { ok: true, library: structuredClone(EMPTY_CREDITS_LIBRARY) };
  try { return validateCreditsLibrary(JSON.parse(raw), availablePlaces); }
  catch { return { ok: false, error: 'Saved credits are not valid JSON.' }; }
}

export function newCredits(placeId: string): Credits {
  return {
    id: crypto.randomUUID(), name: 'My Credits', title: 'Credits', duration: 20, placeId,
    lines: [{ id: crypto.randomUUID(), heading: 'Created by', name: '', role: '' }],
    mode: 'scroll', scrollSpeed: 2,
  };
}

/** A credit line always draws a heading row and a name row, plus a role row when set. */
const rowCount = (line: CreditLine) => 2 + (line.role ? 1 : 0);
const contentRows = (lines: CreditLine[]) => lines.reduce((sum, line) => sum + rowCount(line), 0);

/** Height of the credit text at a given line spacing. */
function layoutHeight(lines: CreditLine[], lineHeight: number) {
  return contentRows(lines) * lineHeight;
}

/**
 * Vertical offset of the first credit row. Static credits are centred; scrolling
 * credits travel upward at the requested speed but are slowed automatically when
 * the sequence is too short to show the whole list at that speed, so the last line
 * always finishes on screen instead of scrolling off.
 */
export function creditsOffset(credits: Pick<Credits, 'mode' | 'duration' | 'scrollSpeed' | 'lines'>, time: number): number {
  const area = CREDIT_BOTTOM - CREDIT_TOP;
  const lineHeight = creditsModeLineHeight(credits);
  const height = layoutHeight(credits.lines, lineHeight);
  if (credits.mode === 'static' || height <= area) return Math.max(0, CREDIT_TOP + (area - height) / 2);
  const requested = credits.scrollSpeed * credits.duration;
  // The list must travel exactly its own height, so the final credit always ends on stage.
  const needed = height;
  // Never scroll faster than the sequence is long enough to sustain.
  const speed = requested >= needed ? credits.scrollSpeed : needed / credits.duration;
  return CREDIT_TOP + area - speed * time;
}

function creditsModeLineHeight(credits: Pick<Credits, 'lines'>): number {
  return credits.lines.length > 0 && contentRows(credits.lines) * CREDIT_LINE_HEIGHT > CREDIT_BOTTOM - CREDIT_TOP
    ? Math.max(30, Math.floor((CREDIT_BOTTOM - CREDIT_TOP) / contentRows(credits.lines)))
    : CREDIT_LINE_HEIGHT;
}

export type CreditRow = { y: number; text: string; size: number; weight: string; colour: string };
export type CreditLayout = { rows: CreditRow[]; lineHeight: number; visible: boolean };

/**
 * Resolves credit rows at a given time. A row is returned even when off stage so
 * callers can decide what to draw; `visible` marks whether it is inside the stage.
 */
export function creditRowsAt(credits: Pick<Credits, 'title' | 'mode' | 'duration' | 'scrollSpeed' | 'lines'>, time: number): CreditLayout {
  const lineHeight = creditsModeLineHeight(credits);
  let y = creditsOffset(credits, time);
  const rows: CreditRow[] = [{ y, text: credits.title, size: 64, weight: 'bold', colour: '#ffe89a' }];
  y += CREDIT_TITLE_HEIGHT;
  for (const line of credits.lines) {
    rows.push({ y, text: line.heading, size: 38, weight: 'bold', colour: '#ffd76a' });
    y += lineHeight;
    rows.push({ y, text: line.name, size: 44, weight: '600', colour: '#fffaf0' });
    y += lineHeight;
    if (line.role) { rows.push({ y, text: line.role, size: 32, weight: '400', colour: '#e7e2ff' }); y += lineHeight; }
  }
  return { rows, lineHeight, visible: true };
}

export const creditsDuration = (credits: Pick<Credits, 'duration'>) => credits.duration;
export const creditsMusicLength = (clip: AudioClip) => clipLength(clip);
export const CREDITS_VIEW_WIDTH = WIDTH;
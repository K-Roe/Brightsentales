import { isInstrument, type InstrumentId } from './instruments';

export const MUSIC_KEY = 'brightsenappstales.music-projects.v1';

export const MUSIC_TEMPO_MIN = 40;
export const MUSIC_TEMPO_MAX = 240;
export const MUSIC_BARS_MIN = 1;
export const MUSIC_BARS_MAX = 64;
export const BEATS_PER_BAR = 4;
export const MUSIC_MAX_TRACKS = 12;
export const MUSIC_MAX_NOTES = 2000;

export type Note = { id: string; pitch: number; start: number; duration: number; velocity: number };
export type Track = { id: string; name: string; instrument: InstrumentId; volume: number; pan: number; muted: boolean; solo: boolean; notes: Note[] };
export type MusicProject = {
  id: string;
  name: string;
  tempo: number;
  bars: number;
  loop: boolean;
  masterVolume: number;
  tracks: Track[];
};

export type EffectPreset = 'footstep' | 'pop' | 'bounce' | 'sparkle' | 'whoosh' | 'bell' | 'transition';
export const EFFECT_PRESETS: EffectPreset[] = ['footstep', 'pop', 'bounce', 'sparkle', 'whoosh', 'bell', 'transition'];
export const EFFECT_PRESET_NAMES: Record<EffectPreset, string> = {
  footstep: 'Footstep', pop: 'Pop', bounce: 'Bounce', sparkle: 'Sparkle',
  whoosh: 'Whoosh', bell: 'Bell', transition: 'Cartoon transition',
};

/** A sound effect is a preset plus the few parameters a beginner might adjust. */
export type EffectProject = {
  id: string;
  name: string;
  preset: EffectPreset;
  pitch: number;      // semitone offset, -12..12
  duration: number;   // seconds, 0.1..4
  volume: number;     // 0..1
  decay: number;      // 0..1 tail shape
  noise: boolean;     // add a noise layer
};

export type StudioProjects = { version: 1; music: MusicProject[]; effects: EffectProject[] };
export type ProjectsResult = { ok: true; projects: StudioProjects } | { ok: false; error: string };
export const EMPTY_PROJECTS: StudioProjects = { version: 1, music: [], effects: [] };

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clean = (value: unknown, limit: number): value is string => typeof value === 'string' && value === value.trim() && value.length <= limit;
const unit = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1;

export function validateNote(value: unknown, bars: number): Note | null {
  if (!value || typeof value !== 'object') return null;
  const note = value as Partial<Note>;
  if (!uuid.test(note.id ?? '')) return null;
  if (!finite(note.pitch) || note.pitch < 12 || note.pitch > 108) return null;
  if (!finite(note.start) || note.start < 0 || note.start > bars * BEATS_PER_BAR + 1e-7) return null;
  if (!finite(note.duration) || note.duration <= 0 || note.duration > bars * BEATS_PER_BAR) return null;
  if (!finite(note.velocity) || note.velocity <= 0 || note.velocity > 1) return null;
  return { id: note.id as string, pitch: note.pitch, start: note.start, duration: note.duration, velocity: note.velocity };
}

export function validateTrack(value: unknown, bars: number): Track | null {
  if (!value || typeof value !== 'object') return null;
  const track = value as Partial<Track>;
  if (!uuid.test(track.id ?? '') || !clean(track.name, 60) || !isInstrument(track.instrument)) return null;
  if (!unit(track.volume) || !finite(track.pan) || track.pan < -1 || track.pan > 1) return null;
  if (typeof track.muted !== 'boolean' || typeof track.solo !== 'boolean') return null;
  if (!Array.isArray(track.notes) || track.notes.length > MUSIC_MAX_NOTES) return null;
  const notes = track.notes.map(note => validateNote(note, bars));
  if (notes.some(note => note === null)) return null;
  if (new Set(notes.map(note => note!.id)).size !== notes.length) return null;
  return { id: track.id as string, name: track.name, instrument: track.instrument, volume: track.volume, pan: track.pan as number, muted: track.muted, solo: track.solo, notes: notes as Note[] };
}

export function validateMusicProject(value: unknown): MusicProject | string {
  if (!value || typeof value !== 'object') return 'A music project is invalid.';
  const project = value as Partial<MusicProject>;
  if (!uuid.test(project.id ?? '')) return 'A music project is invalid.';
  if (!clean(project.name, 80) || !project.name) return 'A music project name is missing or too long.';
  if (!finite(project.tempo) || project.tempo < MUSIC_TEMPO_MIN || project.tempo > MUSIC_TEMPO_MAX) return 'Tempo is outside the supported range.';
  if (!finite(project.bars) || project.bars < MUSIC_BARS_MIN || project.bars > MUSIC_BARS_MAX) return 'Length in bars is outside the supported range.';
  if (typeof project.loop !== 'boolean' || !unit(project.masterVolume)) return 'A music project setting is invalid.';
  if (!Array.isArray(project.tracks) || project.tracks.length > MUSIC_MAX_TRACKS) return 'The track list is invalid.';
  const tracks = project.tracks.map(track => validateTrack(track, project.bars!));
  if (tracks.some(track => track === null)) return 'A track is invalid.';
  if (new Set(tracks.map(track => track!.id)).size !== tracks.length) return 'Two tracks share the same ID.';
  return { id: project.id as string, name: project.name, tempo: project.tempo, bars: project.bars as number, loop: project.loop, masterVolume: project.masterVolume, tracks: tracks as Track[] };
}

export function validateEffectProject(value: unknown): EffectProject | string {
  if (!value || typeof value !== 'object') return 'A sound effect project is invalid.';
  const effect = value as Partial<EffectProject>;
  if (!uuid.test(effect.id ?? '')) return 'A sound effect project is invalid.';
  if (!clean(effect.name, 80) || !effect.name) return 'A sound effect name is missing or too long.';
  if (!EFFECT_PRESETS.includes(effect.preset as EffectPreset)) return 'The sound effect preset is unknown.';
  if (!finite(effect.pitch) || effect.pitch < -12 || effect.pitch > 12) return 'Effect pitch is outside the supported range.';
  if (!finite(effect.duration) || effect.duration < 0.1 || effect.duration > 4) return 'Effect length is outside the supported range.';
  if (!unit(effect.volume) || !unit(effect.decay) || typeof effect.noise !== 'boolean') return 'A sound effect setting is invalid.';
  return { id: effect.id as string, name: effect.name, preset: effect.preset as EffectPreset, pitch: effect.pitch as number, duration: effect.duration as number, volume: effect.volume, decay: effect.decay, noise: effect.noise };
}

export function validateStudioProjects(value: unknown): ProjectsResult {
  if (!value || typeof value !== 'object' || (value as StudioProjects).version !== 1) return { ok: false, error: 'Saved music projects are invalid.' };
  const projects = value as StudioProjects;
  if (!Array.isArray(projects.music) || !Array.isArray(projects.effects)) return { ok: false, error: 'Saved music projects are invalid.' };
  if (projects.music.length > 100 || projects.effects.length > 200) return { ok: false, error: 'Too many saved music projects.' };
  const music: MusicProject[] = [];
  const ids = new Set<string>();
  for (const entry of projects.music) {
    const result = validateMusicProject(entry);
    if (typeof result === 'string') return { ok: false, error: result };
    if (ids.has(result.id)) return { ok: false, error: 'Two music projects share the same ID.' };
    ids.add(result.id);
    music.push(result);
  }
  const effects: EffectProject[] = [];
  for (const entry of projects.effects) {
    const result = validateEffectProject(entry);
    if (typeof result === 'string') return { ok: false, error: result };
    if (ids.has(result.id)) return { ok: false, error: 'Two music projects share the same ID.' };
    ids.add(result.id);
    effects.push(result);
  }
  return { ok: true, projects: { version: 1, music, effects } };
}

export function decodeStudioProjects(raw: string | null): ProjectsResult {
  if (raw === null) return { ok: true, projects: structuredClone(EMPTY_PROJECTS) };
  try { return validateStudioProjects(JSON.parse(raw)); }
  catch { return { ok: false, error: 'Saved music projects are not valid JSON.' }; }
}

/** Beats to seconds at a tempo, so one tempo drives preview, render and export. */
export const beatsToSeconds = (beats: number, tempo: number) => (beats * 60) / tempo;
export const secondsToBeats = (seconds: number, tempo: number) => (seconds * tempo) / 60;
export const projectBeats = (project: Pick<MusicProject, 'bars'>) => project.bars * BEATS_PER_BAR;
export const projectSeconds = (project: Pick<MusicProject, 'bars' | 'tempo'>) => beatsToSeconds(projectBeats(project), project.tempo);

/** A track plays when it is not muted, and either no track is soloed or it is. */
export const trackIsAudible = (tracks: Track[], track: Track) => {
  if (track.muted) return false;
  const anySolo = tracks.some(item => item.solo);
  return !anySolo || track.solo;
};

export function newMusicProject(): MusicProject {
  return { id: crypto.randomUUID(), name: 'My Song', tempo: 100, bars: 4, loop: true, masterVolume: 0.8, tracks: [] };
}

export function newTrack(instrument: InstrumentId, name: string): Track {
  return { id: crypto.randomUUID(), name, instrument, volume: 0.75, pan: 0, muted: false, solo: false, notes: [] };
}

export function newEffect(preset: EffectPreset = 'pop'): EffectProject {
  return { id: crypto.randomUUID(), name: 'My Sound Effect', preset, pitch: 0, duration: 0.8, volume: 0.7, decay: 0.5, noise: true };
}

// Beginner-friendly starters. Each is a short phrase that already sounds intentional.
const STARTERS: Record<string, (track: Track) => Note[]> = {
  'Twinkle melody': () => [60, 60, 67, 60, 69, 67, 60, 65].map((pitch, i) => ({ id: crypto.randomUUID(), pitch, start: i, duration: 0.9, velocity: 0.8 })),
  'Up and down': () => [60, 62, 64, 65, 67, 65, 64, 62, 60].map((pitch, i) => ({ id: crypto.randomUUID(), pitch, start: i, duration: 0.8, velocity: 0.75 })),
  'Happy bouncy': () => [67, 67, 72, 67, 74, 72, 76].map((pitch, i) => ({ id: crypto.randomUUID(), pitch, start: i * 0.75, duration: 0.6, velocity: 0.85 })),
  'Calm and slow': () => [62, 65, 67, 70, 67, 65].map((pitch, i) => ({ id: crypto.randomUUID(), pitch, start: i * 1.5, duration: 1.3, velocity: 0.6 })),
};

const DRUM_PATTERNS = {
  'Steady beat': [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ id: crypto.randomUUID(), pitch: 36, start: i, duration: 0.2, velocity: 0.9 })),
  'Marching': [0, 2, 4, 6].map(i => ({ id: crypto.randomUUID(), pitch: 36, start: i, duration: 0.2, velocity: 0.9 })),
  'Kick and clap': [0, 1.5, 2, 3.5].map((i, n) => ({ id: crypto.randomUUID(), pitch: n % 2 ? 38 : 36, start: i, duration: 0.2, velocity: 0.85 })),
} as const;

export const STARTER_NAMES = Object.keys(STARTERS);
export const DRUM_PATTERN_NAMES = Object.keys(DRUM_PATTERNS);

/** Adds a beginner melody to a track, replacing its notes. */
export function applyStarter(track: Track, starterName: string) {
  return STARTERS[starterName]?.(track) ?? track.notes;
}

/** Adds a beginner drum pattern to a track, replacing its notes. */
export function applyDrumPattern(track: Track, patternName: string) {
  const pattern = DRUM_PATTERNS[patternName as keyof typeof DRUM_PATTERNS];
  return pattern ? pattern.map(note => ({ ...note, id: crypto.randomUUID() })) : track.notes;
}

/** Rounds a time to the nearest sixteenth so the piano roll stays tidy. */
export const snapToStep = (value: number, stepsPerBeat = 4) => Math.round(value * stepsPerBeat) / stepsPerBeat;

/** Clamps a note to the bar range and a usable length. */
export function clampNote(note: Note, bars: number): Note {
  const limit = projectBeats({ bars });
  const start = Math.max(0, Math.min(limit - 0.0625, note.start));
  return { ...note, start, duration: Math.max(0.0625, Math.min(note.duration, limit - start)) };
}

/** Shifts every note on a track by whole steps, used for transpose. */
export const transposeTrack = (track: Track, semitones: number): Track => ({ ...track, notes: track.notes.map(note => ({ ...note, pitch: Math.max(12, Math.min(108, note.pitch + semitones)) })) });
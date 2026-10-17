import { describe, expect, it } from 'vitest';
import { decodeWav, encodeWav, isWav, peakLevel, toMono, WAV_SAMPLE_RATE } from './wav';
import { frequencyToNote, INSTRUMENT_NAMES, INSTRUMENTS, isInstrument, noteFrequency, noteName, trackTail } from './instruments';
import {
  applyDrumPattern, applyStarter, BEATS_PER_BAR, clampNote, decodeStudioProjects, DRUM_PATTERN_NAMES, EMPTY_PROJECTS,
  MUSIC_BARS_MAX, MUSIC_MAX_TRACKS, MUSIC_TEMPO_MAX, MUSIC_TEMPO_MIN, newEffect, newMusicProject, newTrack,
  projectBeats, projectSeconds, snapToStep, STARTER_NAMES, transposeTrack, trackIsAudible,
  validateEffectProject, validateMusicProject, validateStudioProjects,
  type EffectProject, type MusicProject, type Track,
} from './musicProject';
import { applySoftLimit, effectDuration } from './musicRender';

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const note = (n: number, over: Partial<{ pitch: number; start: number; duration: number; velocity: number }> = {}) => ({ id: id(n), pitch: 60, start: 0, duration: 1, velocity: 0.8, ...over });
const track = (n: number, over: Partial<Track> = {}): Track => ({ id: id(n), name: 'Lead', instrument: 'piano', volume: 0.8, pan: 0, muted: false, solo: false, notes: [note(n * 10)], ...over });
const project = (over: Partial<MusicProject> = {}): MusicProject => ({ id: id(1), name: 'Song', tempo: 120, bars: 4, loop: true, masterVolume: 0.8, tracks: [track(2)], ...over });
const effect = (over: Partial<EffectProject> = {}): EffectProject => ({ id: id(3), name: 'Pop', preset: 'pop', pitch: 0, duration: 0.8, volume: 0.7, decay: 0.5, noise: true, ...over });

describe('WAV encoding', () => {
  it('round-trips stereo PCM and preserves samples', () => {
    const left = Float32Array.from([0, 0.5, -0.5, 1, -1, 0.25]);
    const right = Float32Array.from([0, -0.5, 0.5, -1, 1, 0.75]);
    const decoded = decodeWav(encodeWav([left, right], WAV_SAMPLE_RATE));
    expect(decoded).not.toBeNull();
    if (!decoded) return;
    expect(decoded.sampleRate).toBe(WAV_SAMPLE_RATE);
    expect(decoded.channels).toHaveLength(2);
    for (let i = 0; i < left.length; i++) {
      expect(decoded.channels[0][i]).toBeCloseTo(left[i], 3);
      expect(decoded.channels[1][i]).toBeCloseTo(right[i], 3);
    }
  });

  it('writes a 16-bit PCM header a decoder can recognise', () => {
    const bytes = encodeWav([Float32Array.from([0, 1])], WAV_SAMPLE_RATE);
    expect(isWav(bytes)).toBe(true);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint16(20, true)).toBe(1);        // PCM
    expect(view.getUint16(22, true)).toBe(1);        // mono
    expect(view.getUint16(34, true)).toBe(16);       // 16-bit
    expect(bytes.length).toBe(44 + 2 * 2);
  });

  it('clamps out-of-range samples instead of wrapping', () => {
    const decoded = decodeWav(encodeWav([Float32Array.from([2, -2, Number.NaN])]));
    expect(decoded).not.toBeNull();
    if (!decoded) return;
    expect(decoded.channels[0][0]).toBeCloseTo(1, 4);
    expect(decoded.channels[0][1]).toBeCloseTo(-1, 4);
    expect(decoded.channels[0][2]).toBe(0);
  });

  it('rejects bytes that are not a WAV file', () => {
    expect(isWav(new Uint8Array(10))).toBe(false);
    expect(decodeWav(new Uint8Array(64))).toBeNull();
  });

  it('measures mono and peak level for audible verification', () => {
    expect(toMono([Float32Array.from([1, -1]), Float32Array.from([1, 1])])[0]).toBe(1);
    expect(peakLevel([Float32Array.from([0, -0.5, 0.25])])).toBe(0.5);
  });
});

describe('instruments', () => {
  it('offers the eight requested instruments and rejects unknown ids', () => {
    expect(INSTRUMENTS).toHaveLength(8);
    for (const id of INSTRUMENTS) expect(INSTRUMENT_NAMES[id]).toBeTruthy();
    expect(isInstrument('piano')).toBe(true);
    expect(isInstrument('trumpet')).toBe(false);
  });

  it('maps pitch to frequency and back at concert A', () => {
    expect(noteFrequency(69)).toBeCloseTo(440, 5);
    expect(frequencyToNote(440)).toBeCloseTo(69, 5);
    expect(noteFrequency(81)).toBeCloseTo(880, 5);
  });

  it('names notes readably', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(69)).toBe('A4');
    expect(noteName(61)).toBe('C#4');
  });

  it('reports the audible tail of a track including release', () => {
    const single = trackTail('piano', [{ pitch: 60, start: 2, duration: 1, velocity: 1 }]);
    expect(single).toBeGreaterThan(3);
    expect(trackTail('drums', [])).toBe(0);
  });
});

describe('music project validation', () => {
  it('accepts a well formed project', () => {
    expect(typeof validateMusicProject(project())).not.toBe('string');
  });

  it('rejects tempo and bar range violations', () => {
    expect(typeof validateMusicProject(project({ tempo: MUSIC_TEMPO_MIN - 1 }))).toBe('string');
    expect(typeof validateMusicProject(project({ tempo: MUSIC_TEMPO_MAX + 1 }))).toBe('string');
    expect(typeof validateMusicProject(project({ bars: MUSIC_BARS_MAX + 1 }))).toBe('string');
    expect(typeof validateMusicProject(project({ bars: 0 }))).toBe('string');
  });

  it('rejects a missing name and a non-boolean loop', () => {
    expect(typeof validateMusicProject(project({ name: '  ' }))).toBe('string');
    expect(typeof validateMusicProject(project({ loop: 'yes' as unknown as boolean }))).toBe('string');
  });

  it('rejects too many tracks and duplicate track ids', () => {
    const many = Array.from({ length: MUSIC_MAX_TRACKS + 1 }, (_, i) => track(100 + i));
    expect(typeof validateMusicProject(project({ tracks: many }))).toBe('string');
    expect(typeof validateMusicProject(project({ tracks: [track(5), track(5)] }))).toBe('string');
  });

  it('rejects notes outside the bar range, with bad pitch or velocity', () => {
    const bars = 2;
    expect(typeof validateMusicProject(project({ bars, tracks: [track(2, { notes: [note(1, { start: 99 })] })] }))).toBe('string');
    expect(typeof validateMusicProject(project({ bars, tracks: [track(2, { notes: [note(1, { pitch: 3 })] })] }))).toBe('string');
    expect(typeof validateMusicProject(project({ bars, tracks: [track(2, { notes: [note(1, { velocity: 0 })] })] }))).toBe('string');
    expect(typeof validateMusicProject(project({ bars, tracks: [track(2, { notes: [note(1, { duration: 0 })] })] }))).toBe('string');
    // A note at the very end of the final bar is still valid.
    expect(typeof validateMusicProject(project({ bars, tracks: [track(2, { notes: [note(1, { start: bars * BEATS_PER_BAR - 0.25, duration: 0.25 })] })] }))).not.toBe('string');
  });

  it('rejects an unknown instrument and out of range volume or pan', () => {
    expect(typeof validateMusicProject(project({ tracks: [track(2, { instrument: 'trumpet' as never })] }))).toBe('string');
    expect(typeof validateMusicProject(project({ tracks: [track(2, { volume: 2 })] }))).toBe('string');
    expect(typeof validateMusicProject(project({ tracks: [track(2, { pan: -3 })] }))).toBe('string');
  });

  it('rejects duplicate note ids inside one track', () => {
    expect(typeof validateMusicProject(project({ tracks: [track(2, { notes: [note(7), note(7, { pitch: 64 })] })] }))).toBe('string');
  });
});

describe('effect project validation', () => {
  it('accepts a well formed effect', () => {
    expect(typeof validateEffectProject(effect())).not.toBe('string');
  });

  it('rejects an unknown preset and out of range parameters', () => {
    expect(typeof validateEffectProject(effect({ preset: 'boom' as never }))).toBe('string');
    expect(typeof validateEffectProject(effect({ pitch: 40 }))).toBe('string');
    expect(typeof validateEffectProject(effect({ duration: 9 }))).toBe('string');
    expect(typeof validateEffectProject(effect({ duration: 0 }))).toBe('string');
    expect(typeof validateEffectProject(effect({ decay: 4 }))).toBe('string');
  });

  it('reserves room for the release tail after the chosen duration', () => {
    expect(effectDuration(effect({ duration: 1 }))).toBeGreaterThan(1);
  });
});

describe('studio project library', () => {
  it('treats missing storage as an empty library', () => {
    expect(decodeStudioProjects(null)).toEqual({ ok: true, projects: EMPTY_PROJECTS });
  });

  it('rejects invalid JSON and malformed structures', () => {
    expect(decodeStudioProjects('{nope').ok).toBe(false);
    expect(validateStudioProjects({ version: 2, music: [], effects: [] }).ok).toBe(false);
    expect(validateStudioProjects({ version: 1, music: 'no' }).ok).toBe(false);
  });

  it('rejects duplicate ids across music and effects', () => {
    const shared = project({ id: id(9) });
    const clash = effect({ id: id(9) });
    const result = validateStudioProjects({ version: 1, music: [shared], effects: [clash] });
    expect(result.ok).toBe(false);
  });
});

describe('project helpers', () => {
  it('converts beats to seconds at a tempo and back', () => {
    expect(projectSeconds(project({ tempo: 60, bars: 2 }))).toBeCloseTo(8, 5);
    expect(projectSeconds(project({ tempo: 120, bars: 2 }))).toBeCloseTo(4, 5);
    expect(projectBeats(project({ bars: 3 }))).toBe(12);
  });

  it('honours mute and solo in the mix', () => {
    const a = track(2, { muted: true });
    const b = track(3, { solo: true });
    expect(trackIsAudible([a, b], a)).toBe(false);
    expect(trackIsAudible([a, b], b)).toBe(true);
    // Solo silences everything that is not soloed.
    const c = track(4);
    expect(trackIsAudible([a, b, c], c)).toBe(false);
    // With no solo active every unmuted track plays.
    expect(trackIsAudible([a, c], c)).toBe(true);
  });

  it('snaps and clamps notes to a usable range', () => {
    expect(snapToStep(1.13)).toBe(1.25);
    const clamped = clampNote(note(1, { start: 99, duration: 99 }), 2);
    expect(clamped.start).toBeLessThanOrEqual(8);
    expect(clamped.start + clamped.duration).toBeLessThanOrEqual(8);
    expect(clamped.duration).toBeGreaterThan(0);
  });

  it('transposes within the legal pitch range', () => {
    const raised = transposeTrack(track(2, { notes: [note(1, { pitch: 60 })] }), 5);
    expect(raised.notes[0].pitch).toBe(65);
    const clampedLow = transposeTrack(track(2, { notes: [note(1, { pitch: 13 })] }), -12);
    expect(clampedLow.notes[0].pitch).toBe(12);
  });

  it('provides beginner melodies and drum patterns that fit the grid', () => {
    expect(STARTER_NAMES.length).toBeGreaterThanOrEqual(4);
    expect(DRUM_PATTERN_NAMES.length).toBeGreaterThanOrEqual(3);
    for (const name of STARTER_NAMES) {
      const notes = applyStarter(track(2), name);
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) expect(n.start).toBeLessThanOrEqual(16);
    }
    for (const name of DRUM_PATTERN_NAMES) {
      const notes = applyDrumPattern(track(2), name);
      expect(notes.length).toBeGreaterThan(0);
      expect(new Set(notes.map(n => n.id)).size).toBe(notes.length);
    }
    // An unknown starter leaves the track untouched.
    expect(applyStarter(track(2), 'nope')).toHaveLength(1);
  });

  it('creates valid new projects, tracks and effects', () => {
    expect(typeof validateMusicProject(newMusicProject())).not.toBe('string');
    expect(validateEffectProject(newEffect())).not.toBe('string');
    const created = newTrack('violin', 'Strings');
    expect(created.notes).toHaveLength(0);
    expect(created.instrument).toBe('violin');
  });
});

describe('soft limiting', () => {
  it('keeps every sample inside range even for a very loud mix', () => {
    const loud = [Float32Array.from([4, -4, 8, -8]), Float32Array.from([-6, 6, 0, 0])];
    const limited = applySoftLimit(loud);
    for (const channel of limited) for (const sample of channel) {
      expect(sample).toBeLessThanOrEqual(1);
      expect(sample).toBeGreaterThanOrEqual(-1);
    }
    expect(peakLevel(limited)).toBeLessThanOrEqual(1);
  });

  it('leaves a quiet mix completely unchanged so levels the user set are kept', () => {
    const quiet = [Float32Array.from([0.3, -0.3, 0, 0.05])];
    const limited = applySoftLimit(quiet);
    for (let i = 0; i < quiet[0].length; i++) expect(limited[0][i]).toBeCloseTo(quiet[0][i], 6);
  });

  it('compresses loud peaks without inverting them', () => {
    const limited = applySoftLimit([Float32Array.from([1, -1, 0.95, -0.8])]);
    expect(limited[0][0]).toBeLessThan(1);
    expect(limited[0][0]).toBeGreaterThan(0.7);
    expect(limited[0][1]).toBeLessThan(0);
    expect(limited[0][1]).toBeGreaterThan(-1);
  });
});
describe('music projects in Studio Backup', () => {
  it('round-trips editable music projects through a current backup', async () => {
    const { createStudioBackup, validateStudioBackup, STUDIO_BACKUP_VERSION, restoreStudioBackup } = await import('./studioBackup');
    const { DEFAULT_PLACE_ORGANISATION } = await import('./placeFolders');
    const projects = { version: 1 as const, music: [project()], effects: [effect()] };
    const backup = createStudioBackup([], null, new Date('2026-10-17T12:00:00.000Z'), DEFAULT_PLACE_ORGANISATION, { version: 1, scenes: [] }, { version: 1, episodes: [] }, [], { version: 1, intros: [] }, { version: 1, credits: [] }, projects);
    expect(backup.version).toBe(STUDIO_BACKUP_VERSION);
    const checked = validateStudioBackup(backup);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.backup.projects?.music[0].name).toBe('Song');
    expect(checked.backup.projects?.music[0].tracks[0].notes).toHaveLength(1);
    expect(checked.backup.projects?.effects[0].preset).toBe('pop');
  });

  it('accepts a version 7 backup that has no music projects', async () => {
    const { createStudioBackup, validateStudioBackup } = await import('./studioBackup');
    const { DEFAULT_PLACE_ORGANISATION } = await import('./placeFolders');
    const legacy = { ...createStudioBackup([], null, new Date(), DEFAULT_PLACE_ORGANISATION), version: 7, audioAssets: [], intros: { version: 1, intros: [] }, credits: { version: 1, credits: [] }, projects: undefined } as unknown;
    const checked = validateStudioBackup(legacy);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.backup.projects).toBeNull();
  });

  it('keeps existing music projects when an older backup is restored', async () => {
    const { createStudioBackup, validateStudioBackup, restoreStudioBackup } = await import('./studioBackup');
    const { DEFAULT_PLACE_ORGANISATION } = await import('./placeFolders');
    const store = new Map<string, string>([['brightsenappstales.music-projects.v1', JSON.stringify({ version: 1, music: [project({ id: id(77) })], effects: [] })]]);
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); }, removeItem: (key: string) => { store.delete(key); } };
    const legacy = validateStudioBackup({ ...createStudioBackup([], null, new Date(), DEFAULT_PLACE_ORGANISATION), version: 7, audioAssets: [], intros: { version: 1, intros: [] }, credits: { version: 1, credits: [] }, projects: undefined } as unknown);
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) return;
    expect(restoreStudioBackup(storage, 'brightsenappstales.brightlings.v1', 'brightsenappstales.scene.v1', legacy.backup).ok).toBe(true);
    const kept = JSON.parse(store.get('brightsenappstales.music-projects.v1')!);
    expect(kept.music[0].id).toBe(id(77));
    expect(kept.music[0].tracks[0].notes).toHaveLength(1);
  });

  it('rejects a backup whose music project is malformed', async () => {
    const { createStudioBackup, validateStudioBackup } = await import('./studioBackup');
    const { DEFAULT_PLACE_ORGANISATION } = await import('./placeFolders');
    const backup = { ...createStudioBackup([], null, new Date(), DEFAULT_PLACE_ORGANISATION), projects: { version: 1, music: [{ ...project(), tempo: 9999 }], effects: [] } } as unknown;
    const checked = validateStudioBackup(backup);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.error).toContain('Tempo');
  });
});

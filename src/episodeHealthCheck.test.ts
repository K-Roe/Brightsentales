import { describe, expect, it } from 'vitest';
import { DEFAULT_PLACE_ORGANISATION } from './placeFolders';
import { checkEpisodeHealth, assertEpisodeReady, type EpisodeHealthInput } from './episodeHealthCheck';
import type { AudioAsset, AudioClip } from './audio';
import type { Episode } from './episodes';
import type { TimedLibrary, TimedScene } from './timedScenes';

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const scene = (n: number, duration = 10): TimedScene => ({ id: id(n), name: `Scene ${n}`, duration, placeId: 'living-room', characters: { max: { x: 600, y: 790 }, maxine: { x: 1050, y: 790 } }, actions: [] });
const episode = (sceneIds: string[] = [id(1)]): Episode => ({ id: id(90), name: 'Health test', sceneIds });
const input = (patch: Partial<EpisodeHealthInput> = {}): EpisodeHealthInput => ({
  episode: episode(), scenes: { version: 1, scenes: [scene(1)] }, intros: { version: 1, intros: [] }, credits: { version: 1, credits: [] },
  characters: [], places: DEFAULT_PLACE_ORGANISATION, audioAssets: [], ...patch,
});
const clip = (patch: Partial<AudioClip> = {}): AudioClip => ({ id: id(30), assetId: id(31), start: 0, trimStart: 0, trimEnd: 2, volume: 1, fadeIn: 0, fadeOut: 0, ...patch });
const audioAsset = (): AudioAsset => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
  return { id: id(31), name: 'Cue', kind: 'effect', mime: 'audio/wav', duration: 20, size: blob.size, blob };
};

describe('Episode Health Check', () => {
  it('reports valid scenes, actions, camera, audio and final export boundary as passed', () => {
    const validScene = { ...scene(1), audio: [clip({ start: 1, trimEnd: 3 })] };
    const value = input({ scenes: { version: 1, scenes: [validScene] }, audioAssets: [audioAsset()] });
    const report = checkEpisodeHealth(value);
    expect(report.errors).toBe(0);
    expect(report.findings.some(item => item.id.startsWith('scene-content-') && item.category === 'passed')).toBe(true);
    expect(report.findings.some(item => item.id === 'audio-assets' && item.category === 'passed')).toBe(true);
    expect(report.findings.some(item => item.id === 'export-duration' && item.message.includes('final timeline boundary'))).toBe(true);
    expect(() => assertEpisodeReady(report, 'export')).not.toThrow();
  });

  it('identifies empty and missing scene references with locations', () => {
    const empty = checkEpisodeHealth(input({ episode: episode([]) }));
    expect(empty.findings).toContainEqual(expect.objectContaining({ id: 'scenes-empty', category: 'error' }));
    const missing = checkEpisodeHealth(input({ episode: episode([id(2)]) }));
    expect(missing.findings).toContainEqual(expect.objectContaining({ category: 'error', location: 'Scene 1', message: expect.stringContaining('missing') }));
  });

  it('names an unresolved saved Brightling reference', () => {
    const characterId = 'brightling-12345678-1234-4123-8123-123456789abc';
    const sceneWithCustom = { ...scene(1), characters: { [characterId]: { x: 700, y: 790 } } };
    const report = checkEpisodeHealth(input({ scenes: { version: 1, scenes: [sceneWithCustom] } }));
    expect(report.findings).toContainEqual(expect.objectContaining({ category: 'error', title: 'Saved Brightling', message: expect.stringContaining('missing from the saved cast') }));
  });

  it('rejects missing audio assets and warns when scene audio is shortened at its boundary', () => {
    const missing = checkEpisodeHealth(input({ episode: { ...episode(), audio: [clip()] } }));
    expect(missing.findings).toContainEqual(expect.objectContaining({ id: 'audio-assets', category: 'error', message: expect.stringContaining('missing or empty') }));
    const crossing = clip({ start: 8, trimEnd: 5 });
    const withAudio = checkEpisodeHealth(input({ scenes: { version: 1, scenes: [{ ...scene(1), audio: [crossing] }] }, audioAssets: [audioAsset()] }));
    expect(withAudio.findings).toContainEqual(expect.objectContaining({ category: 'warning', title: 'Scene audio boundary', sceneIndex: 0 }));
    expect(() => assertEpisodeReady(withAudio, 'export')).not.toThrow();
  });

  it('reports invalid action boundaries and invalid camera targets', () => {
    const boundaryAction = { id: id(11), characterId: 'max', type: 'wave' as const, start: 9, duration: 2 };
    const invalidCamera = { id: id(21), start: 0, duration: 2, shot: 'close-up' as const, target: 'brightling-12345678-1234-4123-8123-123456789abc', movement: 'static' as const };
    const report = checkEpisodeHealth(input({ episode: { ...episode(), camera: [invalidCamera] }, scenes: { version: 1, scenes: [{ ...scene(1), actions: [boundaryAction] }] } }));
    expect(report.findings.some(item => item.id.startsWith('scene-content-') && item.category === 'error')).toBe(true);
    expect(report.findings).toContainEqual(expect.objectContaining({ id: 'camera-track', category: 'error', cameraId: invalidCamera.id }));
  });

  it('reports episode length limits for export and Unity preview', () => {
    const longScenes = { version: 1 as const, scenes: [scene(1, 2400), scene(2, 2400)] };
    const report = checkEpisodeHealth(input({ episode: episode([id(1), id(2)]), scenes: longScenes }));
    expect(report.findings).toContainEqual(expect.objectContaining({ id: 'export-duration', category: 'error', scope: 'export' }));
    expect(() => assertEpisodeReady(report, 'export')).toThrow();
    expect(report.findings).toContainEqual(expect.objectContaining({ id: 'unity-episode-duration', category: 'error', scope: 'preview' }));
    expect(() => assertEpisodeReady(report, 'preview')).toThrow();
  });

  it('distinguishes a scene audio cue crossing a cut from an episode voice overrun', () => {
    const voice = clip({ speakerId: 'max', start: 9, trimEnd: 3 });
    const report = checkEpisodeHealth(input({ episode: { ...episode(), audio: [voice] }, audioAssets: [audioAsset()] }));
    expect(report.findings).toContainEqual(expect.objectContaining({ id: `episode-audio-end-${voice.id}`, category: 'error', scope: 'both' }));
  });
});

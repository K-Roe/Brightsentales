import { describe, expect, it, vi } from 'vitest';
import { studioEpisodeCommand, studioEpisodeConfig, studioEpisodeRevision } from './studioEpisodeBridge';
import type { TimedLibrary, TimedScene } from './timedScenes';
import type { Episode } from './episodes';

const id = (digit: number) => `${String(digit).padStart(8, '0')}-1111-4111-8111-111111111111`;
const first: TimedScene = { id: id(1), name: 'First', placeId: 'living-room', duration: 4,
  characters: { max: { x: 400, y: 790 } }, actions: [{ id: id(11), characterId: 'max', type: 'walk', start: 1, duration: 2, point: { x: 700, y: 790 } }] };
const second: TimedScene = { id: id(2), name: 'Second', placeId: 'living-room', duration: 3,
  characters: { maxine: { x: 900, y: 790 } }, actions: [{ id: id(12), characterId: 'maxine', type: 'wave', start: 1, duration: 1.2 }] };
const scenes: TimedLibrary = { version: 1, scenes: [first, second] };
const episode: Episode = { id: id(3), name: 'Repeat', sceneIds: [first.id, second.id, first.id] };
const media = { id: id(21), kind: 'music' as const, mime: 'audio/wav', duration: 12, size: 128,
  sha256: 'a'.repeat(64), url: 'http://127.0.0.1:4177/api/studio-audio/' + 'b'.repeat(48) };
const music = { id: id(22), assetId: media.id, start: 0, trimStart: 0, trimEnd: 11, volume: .4, fadeIn: 0, fadeOut: 0 };

describe('P4 episode transfer', () => {
  it('keeps repeated scenes as distinct ordered occurrences and one global clock', async () => {
    const config = studioEpisodeConfig(episode, scenes);
    expect(config.version).toBe(1);
    expect(config.scenes.map(item => [item.index, item.start, item.scene.sceneId])).toEqual([
      [0, 0, first.id], [1, 4, second.id], [2, 7, first.id],
    ]);
    expect(config.duration).toBe(11);
    expect(config.scenes[2].scene.actions[0].start).toBe(1);
    expect(config.scenes[2].scene.version).toBe(2);
    expect(await studioEpisodeRevision({ ...config, scenes: config.scenes.slice(0, 2) })).not.toBe(await studioEpisodeRevision(config));
  });

  it('transfers occurrence durations and fade boundaries in a versioned payload', async () => {
    const edited: Episode = { ...episode, sceneSettings: [{ duration: 2 }, { transition: { type: 'fade-black', duration: .6 } }, { duration: 5 }] };
    const config = studioEpisodeConfig(edited, scenes);
    expect(config.version).toBe(2);
    expect(config.duration).toBe(10);
    expect(config.scenes.map(item => [item.start, item.duration, item.scene.duration, item.transition?.duration])).toEqual([
      [0, 2, 4, undefined], [2, 3, 3, .6], [5, 5, 4, undefined],
    ]);
    expect(await studioEpisodeRevision(config)).not.toBe(await studioEpisodeRevision(studioEpisodeConfig(episode, scenes)));
    expect(() => studioEpisodeConfig({ ...edited, sceneSettings: [{ duration: .4 }, { transition: { type: 'fade-black', duration: 1 } }, {}] }, scenes)).toThrow('Fade duration');
  });

  it('retains episode music through boundaries and schedules scene audio per occurrence', () => {
    const withAudio = { ...episode, audio: [music] };
    const sceneClip = { ...music, id: id(23), start: 2, trimEnd: 2 };
    const config = studioEpisodeConfig(withAudio, { ...scenes, scenes: [{ ...first, audio: [sceneClip] }, second] }, [media]);
    expect(config.audio.map(clip => [clip.id, clip.start, clip.source])).toEqual([
      [`episode:${music.id}`, 0, 'episode'],
      [`scene:0:${sceneClip.id}`, 2, 'scene'],
      [`scene:2:${sceneClip.id}`, 9, 'scene'],
    ]);
    expect(config.audio[0].trimEnd).toBe(11);
    expect(config.audioAssets).toEqual([media]);
    expect(JSON.stringify(config)).not.toContain('RIFF');
  });

  it('rejects missing scenes and unsupported intro before transfer', () => {
    expect(() => studioEpisodeConfig({ ...episode, sceneIds: [id(99)] }, scenes)).toThrow('missing saved scene');
    expect(() => studioEpisodeConfig({ ...episode, introId: id(98) }, scenes)).toThrow('intros or credits');
    expect(() => studioEpisodeConfig({ ...episode, audio: [music] }, scenes)).toThrow('Transfer every');
  });

  it('sends a revisioned episode command and checks the acknowledgement', async () => {
    const config = studioEpisodeConfig(episode, scenes);
    const revision = await studioEpisodeRevision(config);
    const request = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.config.scenes).toHaveLength(3);
      expect(body.revision).toBe(revision);
      return { ok: true, status: 202, json: async () => ({ source: 'unity', version: 6,
        command: 'episode.load', runId: 'a'.repeat(32), episodeId: episode.id, revision,
        status: 'loaded', elapsed: 0, duration: 11, sceneIndex: 0, sceneId: first.id, reason: '' }) } as Response;
    });
    const reply = await studioEpisodeCommand('load', 'a'.repeat(32), episode.id, new AbortController().signal, { config }, request as typeof fetch);
    expect(reply.status).toBe('loaded');
    expect(request).toHaveBeenCalledOnce();
  });
});

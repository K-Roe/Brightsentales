import { describe, expect, it, vi } from 'vitest';
import { studioEpisodeCommand, studioEpisodeConfig, studioEpisodeRevision, validateStudioEpisodeForUnity } from './studioEpisodeBridge';
import type { TimedLibrary, TimedScene } from './timedScenes';
import type { Episode } from './episodes';
import type { Brightling } from './maker';
import type { BrightlingDefinition } from './brightlingTransfer';
import { DEFAULT_COLOURS } from './maker';

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

  it('transfers episode camera shots in a version 3 payload', async () => {
    const directed: Episode = { ...episode, camera: [
      { id: id(31), start: 0, duration: 2, shot: 'wide', target: 'max', movement: 'static' },
      { id: id(32), start: 2, duration: 3, shot: 'medium', target: 'max', movement: 'pan' },
      { id: id(33), start: 5, duration: 2, shot: 'custom', target: 'point', movement: 'static', x: 700, y: 500, zoom: 2.5 },
      { id: id(34), start: 7, duration: 2, shot: 'close-up', target: 'maxine', movement: 'follow' },
    ] };
    const config = studioEpisodeConfig(directed, scenes);
    expect(config.version).toBe(3);
    expect(config.scenes[0].duration).toBe(4);
    expect(config.camera?.map(shot => [shot.start, shot.duration, shot.shot, shot.target, shot.movement])).toEqual([
      [0, 2, 'wide', 'max', 'static'], [2, 3, 'medium', 'max', 'pan'],
      [5, 2, 'custom', 'point', 'static'], [7, 2, 'close-up', 'maxine', 'follow'],
    ]);
    expect(config.camera?.[2]).toMatchObject({ x: 700, y: 500, zoom: 2.5 });
    expect(await studioEpisodeRevision(config)).not.toBe(await studioEpisodeRevision(studioEpisodeConfig(episode, scenes)));
    expect(() => studioEpisodeConfig({ ...directed, camera: [{ ...directed.camera![0], target: 'other-brightling' }] }, scenes)).toThrow('not in this episode');
    expect(() => studioEpisodeConfig({ ...directed, camera: [directed.camera![0], { ...directed.camera![1], start: 0 }] }, scenes)).toThrow('overlap');
  });

  it('keeps a custom Brightling in scene occurrences and permits its camera target', () => {
    const characterId = 'brightling-12345678-1234-4123-8123-123456789abc';
    const customScene: TimedScene = { ...first, characters: { [characterId]: { x: 700, y: 790 } }, actions: [
      { ...first.actions[0], characterId, type: 'wave', point: undefined, start: 1, duration: 1.2 },
    ] };
    const character: Brightling = { id: characterId, name: 'Nova', template: 'female', ...DEFAULT_COLOURS.female };
    const definition = { schema: 'brighttales.brightling', version: 1, character, templateVersion: 1,
      bodyPart: { kind: 'whole-body', layer: 0, pivot: { x: .5, y: 0 }, scale: 1 },
      animations: ['idle', 'blink', 'walk', 'wave'], assets: [] } as unknown as BrightlingDefinition;
    const directed: Episode = { id: id(3), name: 'Custom cast', sceneIds: [customScene.id], camera: [
      { id: id(33), start: 0, duration: 4, shot: 'close-up', target: characterId, movement: 'follow' },
    ] };
    const config = studioEpisodeConfig(directed, { version: 1, scenes: [customScene] }, [], [definition]);
    expect(config.scenes[0].scene).toMatchObject({ characters: [{ id: characterId }], brightlings: [{ character: { id: characterId } }] });
    expect(config.camera?.[0].target).toBe(characterId);
  });

  it('keeps two modular identities, actions, camera targets and audio aligned in one episode payload', () => {
    const pipId = 'brightling-12345678-1234-4123-8123-123456789abc';
    const mallowId = 'brightling-22345678-1234-4123-8123-123456789abc';
    const pip: Brightling = { id: pipId, name: 'Pip', template: 'male', ...DEFAULT_COLOURS.male,
      appearance: { version: 2, headShape: 'round', eyeStyle: 'round', earShape: 'short', hairStyle: 'tuft', headDecoration: 'none', bodyShape: 'standard', clothingStyle: 'hoodie' } };
    const mallow: Brightling = { id: mallowId, name: 'Mallow', template: 'female', body: '#f7b788', hair: '#8740b6', clothing: '#d94b55',
      appearance: { version: 2, headShape: 'wide', eyeStyle: 'sparkle', earShape: 'long', hairStyle: 'swoop', headDecoration: 'star', bodyShape: 'tall', clothingStyle: 'jacket' } };
    const firstScene: TimedScene = { ...first, characters: { [pipId]: { x: 500, y: 790 }, [mallowId]: { x: 1120, y: 790 } }, actions: [
      { id: id(41), characterId: pipId, type: 'appear', start: 0, duration: 0, point: { x: 500, y: 790 } },
      { id: id(42), characterId: pipId, type: 'wait', start: .1, duration: .5 },
      { id: id(43), characterId: pipId, type: 'walk', start: .8, duration: 1, point: { x: 820, y: 790 }, motion: 'gentle' },
      { id: id(44), characterId: mallowId, type: 'appear', start: 0, duration: 0, point: { x: 1120, y: 790 } },
      { id: id(45), characterId: mallowId, type: 'wave', start: 1.8, duration: 1.2 },
    ] };
    const secondScene: TimedScene = { ...second, characters: { [pipId]: { x: 820, y: 790 }, [mallowId]: { x: 1120, y: 790 } }, actions: [
      { id: id(46), characterId: pipId, type: 'appear', start: 0, duration: 0, point: { x: 820, y: 790 } },
      { id: id(47), characterId: mallowId, type: 'appear', start: 0, duration: 0, point: { x: 1120, y: 790 } },
      { id: id(48), characterId: mallowId, type: 'wave', start: .4, duration: 1.2 },
    ] };
    const library: TimedLibrary = { version: 1, scenes: [firstScene, secondScene] };
    const episodeAudio = { ...music, start: 0, trimEnd: 5 };
    const directed: Episode = { id: id(3), name: 'Pip and Mallow', sceneIds: [firstScene.id, secondScene.id], audio: [episodeAudio], camera: [
      { id: id(51), start: 0, duration: 1, shot: 'wide', target: 'point', movement: 'static', x: 836, y: 470 },
      { id: id(52), start: 1, duration: 2, shot: 'medium', target: pipId, movement: 'pan' },
      { id: id(53), start: 3, duration: 2, shot: 'close-up', target: mallowId, movement: 'follow' },
    ] };
    const definition = (character: Brightling) => ({ schema: 'brighttales.brightling', version: 1, character,
      templateVersion: 1, bodyPart: { kind: 'whole-body', layer: 0, pivot: { x: .5, y: 0 }, scale: 1 },
      animations: ['idle', 'blink', 'walk', 'wave'], assets: [] }) as unknown as BrightlingDefinition;
    const config = studioEpisodeConfig(directed, library, [media], [definition(pip), definition(mallow)]);
    expect(config.version).toBe(3);
    expect(config.scenes.map(item => item.scene.characters.map(character => character.id))).toEqual([[pipId, mallowId], [pipId, mallowId]]);
    expect(config.scenes[0].scene.brightlings?.map(item => item.character.id)).toEqual([pipId, mallowId]);
    expect(config.scenes[1].scene.brightlings?.map(item => item.character.id)).toEqual([pipId, mallowId]);
    expect(config.scenes[0].scene.actions.map(action => [action.characterId, action.type])).toEqual([
      [pipId, 'appear'], [pipId, 'wait'], [pipId, 'walk'], [mallowId, 'appear'], [mallowId, 'wave'],
    ]);
    expect(config.camera?.map(shot => shot.target)).toEqual(['point', pipId, mallowId]);
    expect(config.audio).toMatchObject([{ source: 'episode', start: 0, assetId: media.id }]);
  });

  it('rejects missing scenes and unsupported intro before transfer', () => {
    expect(() => studioEpisodeConfig({ ...episode, sceneIds: [id(99)] }, scenes)).toThrow('missing saved scene');
    expect(() => studioEpisodeConfig({ ...episode, introId: id(98) }, scenes)).toThrow('intros or credits');
    expect(() => studioEpisodeConfig({ ...episode, audio: [music] }, scenes)).toThrow('Transfer every');
  });

  it('validates episode references and required media before Unity startup', async () => {
    await expect(validateStudioEpisodeForUnity(episode, scenes, [])).resolves.toEqual([]);
    await expect(validateStudioEpisodeForUnity({ ...episode, sceneIds: [id(99)] }, scenes, [])).rejects.toThrow('missing saved scene');
    await expect(validateStudioEpisodeForUnity({ ...episode, camera: [{ id: id(31), start: 0, duration: 2, shot: 'close-up', target: 'other', movement: 'static' }] }, scenes, []))
      .rejects.toThrow('not in this episode');
    await expect(validateStudioEpisodeForUnity({ ...episode, audio: [music] }, scenes, [])).rejects.toThrow('missing');
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

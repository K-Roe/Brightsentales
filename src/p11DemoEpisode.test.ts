import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generateBrightlingFrames } from './brightling';
import { validateLibrary } from './library';
import { studioEpisodeConfig, studioEpisodeRevision } from './studioEpisodeBridge';
import type { StudioAudioAsset } from './studioAudioTransfer';
import type { BrightlingDefinition } from './brightlingTransfer';
import type { Episode, EpisodeLibrary } from './episodes';
import type { TimedLibrary } from './timedScenes';

const demo = JSON.parse(readFileSync(new URL('../proofs/cartoon-foundation-p11/demo-episode.json', import.meta.url), 'utf8')) as {
  characters: unknown; scenes: TimedLibrary['scenes']; episode: Episode; audioAsset: { id: string; kind: 'effect'; mime: 'audio/wav'; duration: number; size: number; sha256: string };
};

describe('P11 demonstration episode fixture', () => {
  it('preserves two visibly distinct modular Brightlings and the episode save/reopen shape', async () => {
    const characters = validateLibrary(demo.characters);
    expect(characters.ok).toBe(true);
    if (!characters.ok) return;
    expect(characters.characters.map(character => character.name)).toEqual(['Pip', 'Mallow']);
    const [pip, mallow] = characters.characters;
    expect(generateBrightlingFrames({ id: 'pip', name: pip.name, bodyColour: pip.body, hairColour: pip.hair, clothingColour: pip.clothing,
      headShape: pip.appearance!.headShape, eyeStyle: pip.appearance!.eyeStyle, earShape: pip.appearance!.earShape,
      hairStyle: pip.appearance!.hairStyle, headDecoration: pip.appearance!.headDecoration, bodyShape: pip.appearance!.bodyShape,
      clothingStyle: pip.appearance!.clothingStyle }).idle).not.toBe(generateBrightlingFrames({ id: 'mallow', name: mallow.name,
      bodyColour: mallow.body, hairColour: mallow.hair, clothingColour: mallow.clothing,
      headShape: mallow.appearance!.headShape, eyeStyle: mallow.appearance!.eyeStyle, earShape: mallow.appearance!.earShape,
      hairStyle: mallow.appearance!.hairStyle, headDecoration: mallow.appearance!.headDecoration, bodyShape: mallow.appearance!.bodyShape,
      clothingStyle: mallow.appearance!.clothingStyle }).idle);
    const library: EpisodeLibrary = { version: 1, episodes: [demo.episode] };
    const reopened = JSON.parse(JSON.stringify(library));
    expect(reopened.episodes[0]).toEqual(demo.episode);
    expect(demo.scenes).toHaveLength(2);
    expect(demo.episode.sceneIds).toEqual(demo.scenes.map(scene => scene.id));
  });

  it('points at the existing supported soft chime with matching integrity metadata', () => {
    const audio = readFileSync(new URL('../proofs/cartoon-life-v1/soft-chime.wav', import.meta.url));
    expect(audio.byteLength).toBe(demo.audioAsset.size);
    expect(createHash('sha256').update(audio).digest('hex')).toBe(demo.audioAsset.sha256);
  });

  it('builds a stable Unity payload with both definitions, scene actions, modular camera targets and the supported audio cue', async () => {
    const characters = validateLibrary(demo.characters);
    if (!characters.ok) throw new Error(characters.error);
    const definitions = characters.characters.map(character => ({ schema: 'brighttales.brightling', version: 1, character,
      templateVersion: 1, bodyPart: { kind: 'whole-body', layer: 0, pivot: { x: .5, y: 0 }, scale: 1 },
      animations: ['idle', 'blink', 'walk', 'wave'], assets: [] })) as unknown as BrightlingDefinition[];
    const audio = { ...demo.audioAsset, url: `http://127.0.0.1:4177/api/studio-audio/${'a'.repeat(48)}` } as StudioAudioAsset;
    const episodeConfig = studioEpisodeConfig(demo.episode, { version: 1, scenes: demo.scenes }, [audio], definitions);
    expect(episodeConfig.version).toBe(3);
    expect(episodeConfig.scenes).toHaveLength(2);
    expect(episodeConfig.scenes[0].scene.brightlings?.map(character => character.character.name)).toEqual(['Pip', 'Mallow']);
    expect(episodeConfig.scenes.flatMap(item => item.scene.characters.map(character => character.id))).toEqual(expect.arrayContaining([
      'brightling-11111111-1111-4111-8111-111111111111', 'brightling-22222222-2222-4222-8222-222222222222',
    ]));
    expect(episodeConfig.scenes.flatMap(item => item.scene.actions.map(action => action.type))).toEqual(expect.arrayContaining(['wait', 'walk', 'wave']));
    expect(episodeConfig.camera?.map(shot => shot.target)).toEqual(['point', 'brightling-11111111-1111-4111-8111-111111111111', 'brightling-22222222-2222-4222-8222-222222222222', 'point']);
    expect(episodeConfig.audio).toMatchObject([{ assetId: demo.audioAsset.id, source: 'episode', start: 0, trimEnd: .65 }]);
    expect(await studioEpisodeRevision(episodeConfig)).toBe(await studioEpisodeRevision(episodeConfig));
  });
});

import { describe, expect, it, vi } from 'vitest';
import { studioSceneCommand, studioSceneConfig, studioSceneRevision } from './studioSceneBridge';
import type { TimedScene } from './timedScenes';
import type { Brightling } from './maker';
import type { BrightlingDefinition } from './brightlingTransfer';
import { DEFAULT_COLOURS } from './maker';

const sceneId = '11111111-1111-4111-8111-111111111111';
const actionId = '22222222-2222-4222-8222-222222222222';
const runId = '0123456789abcdef0123456789abcdef';
const scene: TimedScene = {
  id: sceneId, name: 'Editable greeting', placeId: 'living-room', duration: 10,
  characters: { max: { x: 575, y: 790 }, maxine: { x: 1090, y: 790 } },
  actions: [{ id: actionId, characterId: 'max', type: 'walk', start: 2, duration: 3, point: { x: 800, y: 790 } }],
};

describe('saved Scene Maker to Unity Phase 1 contract', () => {
  it('uses the edited saved position and timing instead of the fixed demonstration', () => {
    const edited = structuredClone(scene);
    edited.actions[0].start = 4;
    edited.actions[0].point = { x: 900, y: 790 };
    const config = studioSceneConfig(edited);
    expect(config.sceneId).toBe(sceneId);
    expect(config.actions[0]).toMatchObject({ start: 4, x: 900, y: 790 });
    expect(config.characters.map(character => character.id)).toEqual(['max', 'maxine']);
  });

  it('transfers saved custom cast identity and appearance artwork references', () => {
    const characterId = 'brightling-12345678-1234-4123-8123-123456789abc';
    const custom: TimedScene = { ...scene, characters: { [characterId]: { x: 700, y: 790 } }, actions: [
      { ...scene.actions[0], characterId, type: 'wave', start: 1, duration: 1.2, point: undefined },
    ] };
    const character: Brightling = { id: characterId, name: 'Nova', template: 'female', ...DEFAULT_COLOURS.female };
    const definition = { schema: 'brighttales.brightling', version: 1, character, templateVersion: 1,
      bodyPart: { kind: 'whole-body', layer: 0, pivot: { x: .5, y: 0 }, scale: 1 },
      animations: ['idle', 'blink', 'walk', 'wave'], assets: [] } as unknown as BrightlingDefinition;
    expect(() => studioSceneConfig(custom)).toThrow('Transfer the saved appearance');
    expect(studioSceneConfig(custom, undefined, [definition])).toMatchObject({
      characters: [{ id: characterId, x: 700 }], actions: [{ characterId }], brightlings: [{ character: { id: characterId } }],
    });
  });

  it('changes the content revision when a saved timing or destination changes', async () => {
    const original = studioSceneConfig(scene);
    const edited = structuredClone(scene);
    edited.actions[0].start = 4;
    edited.actions[0].point = { x: 900, y: 790 };
    expect(await studioSceneRevision(studioSceneConfig(edited))).not.toBe(await studioSceneRevision(original));
  });

  it('transfers calm life, looking and authored camera shots in a revisioned v2 scene', async () => {
    const sceneWithCamera: TimedScene = { ...scene, life: { enabled: true, mode: 'v2', ambience: false }, actions: [
      { ...scene.actions[0], motion: 'gentle' },
      { id: '33333333-3333-4333-8333-333333333333', characterId: 'maxine', type: 'look-at', target: 'max', start: 2, duration: 2 },
    ], camera: [{ id: '44444444-4444-4444-8444-444444444444', shot: 'medium', focus: 'group', start: 0, duration: 2 }] };
    const config = studioSceneConfig(sceneWithCamera);
    expect(config).toMatchObject({ version: 2, calmLife: true });
    expect(config.actions[0]).toMatchObject({ motion: 'gentle' });
    expect(config.actions[1]).toMatchObject({ type: 'look-at', target: 'max' });
    expect(config.camera[0]).toMatchObject({ shot: 'medium', focus: 'group', duration: 2 });
    const edited = structuredClone(sceneWithCamera); edited.camera![0].duration = 2.5;
    expect(await studioSceneRevision(studioSceneConfig(edited))).not.toBe(await studioSceneRevision(config));
    expect(() => studioSceneConfig({ ...sceneWithCamera, life: { enabled: true, mode: 'v2', ambience: true } })).toThrow('Calm Life');
  });

  it('transfers timed audio references in v3 without media bytes in scene JSON', async () => {
    const clip = { id: actionId, assetId: '33333333-3333-4333-8333-333333333333', start: 2, volume: .6, trimStart: 0, trimEnd: 2, fadeIn: .3, fadeOut: .2 };
    const withAudio = { ...scene, audio: [clip] };
    const media = [{ id: clip.assetId, kind: 'speech' as const, mime: 'audio/wav', duration: 2, size: 10, sha256: 'a'.repeat(64), url: 'http://127.0.0.1:4177/api/studio-audio/' + 'b'.repeat(48) }];
    expect(() => studioSceneConfig(withAudio)).toThrow('Transfer every scene audio file');
    const config = studioSceneConfig(withAudio, media);
    expect(config).toMatchObject({ version: 3, audio: [{ assetId: clip.assetId, start: 2, volume: .6 }], audioAssets: media });
    expect(JSON.stringify(config)).not.toContain('RIFF');
    expect(await studioSceneRevision({ ...config, audio: [{ ...config.audio![0], start: 3 }] })).not.toBe(await studioSceneRevision(config));
    const longMusic = { ...withAudio, audio: [{ ...clip, start: 9, trimEnd: 2 }] };
    expect(studioSceneConfig(longMusic, media).audio![0].trimEnd).toBe(1);
    expect(longMusic.audio[0].trimEnd).toBe(2);
  });

  it('rejects rejected frame actions and unsupported Bright Speak before transfer', () => {
    expect(() => studioSceneConfig({ ...scene, actions: [{ ...scene.actions[0], type: 'sit-down', artwork: 'provisional-v1', seat: 'chair', point: undefined }] })).toThrow();
    expect(() => studioSceneConfig({ ...scene, phone: [{ id: '33333333-3333-4333-8333-333333333333', characterId: 'max', type: 'communicate', start: 0, duration: 2, message: 'Can I have a drink?', symbol: 'drink', position: 'above-right' }] })).toThrow('Bright Speak is not supported by Unity playback yet.');
  });

  it('requires the matching Unity acknowledgement', async () => {
    const config = studioSceneConfig(scene);
    const request = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body));
      return { ok: true, status: 202, json: async () => ({ source: 'unity', version: 5, command: sent.command, runId: sent.runId, sceneId: sent.sceneId, revision: sent.revision, status: 'loaded', elapsed: 0, duration: 10, reason: '' }) };
    }) as unknown as typeof fetch;
    await expect(studioSceneCommand('load', runId, sceneId, new AbortController().signal, { config }, request)).resolves.toMatchObject({ status: 'loaded' });
    expect(JSON.parse(String((request as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).config.actions[0].x).toBe(800);
    const mismatch = vi.fn(async () => ({ ok: true, status: 202, json: async () => ({ source: 'unity', version: 5, command: 'studio.load', runId, sceneId: 'other', revision: '0'.repeat(64), status: 'loaded', elapsed: 0, duration: 10 }) })) as unknown as typeof fetch;
    await expect(studioSceneCommand('load', runId, sceneId, new AbortController().signal, { config }, mismatch)).rejects.toThrow('did not acknowledge');
  });
});

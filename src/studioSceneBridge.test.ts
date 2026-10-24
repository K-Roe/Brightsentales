import { describe, expect, it, vi } from 'vitest';
import { studioSceneCommand, studioSceneConfig } from './studioSceneBridge';
import type { TimedScene } from './timedScenes';

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

  it('rejects unsupported audio and rejected frame actions before transfer', () => {
    expect(() => studioSceneConfig({ ...scene, audio: [{ id: actionId, assetId: actionId, start: 0, volume: 1, trimStart: 0, trimEnd: 1, fadeIn: 0, fadeOut: 0 }] })).toThrow('Scene audio');
    expect(() => studioSceneConfig({ ...scene, actions: [{ ...scene.actions[0], type: 'sit-down', artwork: 'provisional-v1', seat: 'chair', point: undefined }] })).toThrow();
  });

  it('requires the matching Unity acknowledgement', async () => {
    const config = studioSceneConfig(scene);
    const request = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body));
      return { ok: true, status: 202, json: async () => ({ source: 'unity', version: 5, command: sent.command, runId: sent.runId, sceneId: sent.sceneId, status: 'loaded', elapsed: 0, duration: 10, reason: '' }) };
    }) as unknown as typeof fetch;
    await expect(studioSceneCommand('load', runId, sceneId, new AbortController().signal, config, request)).resolves.toMatchObject({ status: 'loaded' });
    expect(JSON.parse(String((request as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).config.actions[0].x).toBe(800);
    const mismatch = vi.fn(async () => ({ ok: true, status: 202, json: async () => ({ source: 'unity', version: 5, command: 'studio.load', runId, sceneId: 'other', status: 'loaded', elapsed: 0, duration: 10 }) })) as unknown as typeof fetch;
    await expect(studioSceneCommand('load', runId, sceneId, new AbortController().signal, config, mismatch)).rejects.toThrow('did not acknowledge');
  });
});

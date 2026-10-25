import { describe, expect, it, vi } from 'vitest';
import { transferStudioAudio } from './studioAudioTransfer';
import type { AudioAsset } from './audio';
import type { TimedScene } from './timedScenes';

const scene: TimedScene = {
  id: '11111111-1111-4111-8111-111111111111', name: 'Audio scene', placeId: 'living-room', duration: 8,
  characters: { max: { x: 575, y: 790 } }, actions: [],
  audio: [
    { id: '22222222-2222-4222-8222-222222222222', assetId: '44444444-4444-4444-8444-444444444444', start: 1, trimStart: 0, trimEnd: 2, volume: .7, fadeIn: 0, fadeOut: 0 },
    { id: '33333333-3333-4333-8333-333333333333', assetId: '44444444-4444-4444-8444-444444444444', start: 4, trimStart: 0, trimEnd: 2, volume: .5, fadeIn: 0, fadeOut: 0 },
  ],
};
const bytes = new Uint8Array([82, 73, 70, 70]);
const asset: AudioAsset = { id: scene.audio![0].assetId, name: 'speech', kind: 'speech', mime: 'audio/wav', duration: 2, size: bytes.length, blob: new Blob([bytes], { type: 'audio/wav' }) };

describe('local audio transfer for Unity', () => {
  it('sends one binary asset for two independently timed clips', async () => {
    const request = vi.fn(async (_url: string, init: RequestInit) => ({ ok: true, json: async () => ({
      id: asset.id, sha256: init.headers && (init.headers as Record<string, string>)['X-BrightTales-Sha256'],
      size: asset.size, url: `http://127.0.0.1:4177/api/studio-audio/${'a'.repeat(48)}`,
    }) })) as unknown as typeof fetch;
    const result = await transferStudioAudio(scene, [asset], new AbortController().signal, request, 'http://127.0.0.1:4177');
    expect(result).toHaveLength(1);
    expect((request as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    const sent = (request as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(sent.body).toBeInstanceOf(ArrayBuffer);
    expect(sent.headers).toMatchObject({ 'Content-Type': 'audio/wav', 'X-BrightTales-Audio-Id': asset.id });
  });

  it('rejects missing, mismatched and out of range media before Unity load', async () => {
    const origin = 'http://127.0.0.1:4177';
    await expect(transferStudioAudio(scene, [], new AbortController().signal, fetch, origin)).rejects.toThrow('missing');
    await expect(transferStudioAudio(scene, [{ ...asset, size: 9 }], new AbortController().signal, fetch, origin)).rejects.toThrow('invalid');
    await expect(transferStudioAudio({ ...scene, audio: [{ ...scene.audio![0], trimEnd: 3 }] }, [asset], new AbortController().signal, fetch, origin)).rejects.toThrow('exceeds');
  });
});

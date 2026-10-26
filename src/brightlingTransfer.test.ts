import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COLOURS, FRAMES, type Brightling } from './maker';

vi.mock('./maker', async () => {
  const actual = await vi.importActual<typeof import('./maker')>('./maker');
  return { ...actual, makeFrame: vi.fn(async () => {
    return { toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/GZkAAAAASUVORK5CYII=' } as HTMLCanvasElement;
  }) };
});

const character: Brightling = { id: 'brightling-12345678-1234-4123-8123-123456789abc', name: 'Nova', template: 'female', ...DEFAULT_COLOURS.female };

describe('Brightling transfer contract', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('packages all supported frames in stable order with content hashes', async () => {
    const { buildBrightlingDefinition, canonicalDefinition } = await import('./brightlingTransfer');
    const first = await buildBrightlingDefinition(character); const second = await buildBrightlingDefinition(character);
    expect(first.assets.map(asset => asset.frame)).toEqual(FRAMES);
    expect(first.assets.every(asset => /^[a-f0-9]{64}$/.test(asset.sha256))).toBe(true);
    expect(canonicalDefinition(first)).toBe(canonicalDefinition(second));
    expect(canonicalDefinition(first)).toContain('"command":"brightling.import"');
  });

  it('rejects an invalid or traversal-like identity before rendering assets', async () => {
    const { buildBrightlingDefinition } = await import('./brightlingTransfer');
    await expect(buildBrightlingDefinition({ ...character, id: 'brightling-../../x' })).rejects.toThrow(/invalid identity/i);
  });

  it('requires Unity acknowledgement for the same identity and a completed import', async () => {
    const { sendBrightlingToUnity } = await import('./brightlingTransfer');
    const ok = vi.fn(async () => new Response(JSON.stringify({ source: 'unity', version: 1, command: 'brightling.import', status: 'imported', characterId: character.id, name: character.name, revision: 'a'.repeat(64), animations: ['idle', 'blink', 'walk', 'wave'] }), { status: 202 }));
    await expect(sendBrightlingToUnity(character, new AbortController().signal, ok as typeof fetch)).resolves.toMatchObject({ status: 'imported', name: 'Nova' });
    const wrong = vi.fn(async () => new Response(JSON.stringify({ source: 'unity', version: 1, command: 'brightling.import', status: 'imported', characterId: 'brightling-other', name: 'Nova', revision: 'a'.repeat(64), animations: [] }), { status: 202 }));
    await expect(sendBrightlingToUnity(character, new AbortController().signal, wrong as typeof fetch)).rejects.toThrow(/did not confirm construction/i);
  });

  it('reports bridge validation failures instead of claiming import success', async () => {
    const { sendBrightlingToUnity } = await import('./brightlingTransfer');
    const failed = vi.fn(async () => new Response(JSON.stringify({ source: 'unity', version: 1, command: 'brightling.import', status: 'rejected', reason: 'Artwork hash mismatch' }), { status: 400 }));
    await expect(sendBrightlingToUnity(character, new AbortController().signal, failed as typeof fetch)).rejects.toThrow('Artwork hash mismatch');
  });

  it('accepts Unity animation acknowledgements only for the requested character and action', async () => {
    const { playBrightlingActionInUnity } = await import('./brightlingTransfer');
    const request = vi.fn(async () => new Response(JSON.stringify({ source: 'unity', version: 1, command: 'brightling.action', status: 'accepted', characterId: character.id, action: 'wave' }), { status: 202 }));
    await expect(playBrightlingActionInUnity(character.id, 'wave', new AbortController().signal, request as typeof fetch)).resolves.toBeUndefined();
    const rejected = vi.fn(async () => new Response(JSON.stringify({ source: 'unity', version: 1, command: 'brightling.action', status: 'accepted', characterId: 'brightling-other', action: 'wave' }), { status: 202 }));
    await expect(playBrightlingActionInUnity(character.id, 'wave', new AbortController().signal, rejected as typeof fetch)).rejects.toThrow(/did not acknowledge/i);
  });
});

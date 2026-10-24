import { describe, expect, it, vi } from 'vitest';
import { blinkMaxInUnity, connectToUnity, pingUnity, sendActingCommandToUnity, UnityBridgeTimeoutError, UnityBridgeUnavailableError, UNITY_BRIDGE_URL } from './unityBridge';

describe('Unity Bridge V0 client', () => {
  it('uses only the fixed loopback endpoint and accepts a valid Pong', async () => {
    const request = vi.fn(async () => ({ ok: true, json: async () => ({ type: 'pong', source: 'unity', version: 0 }) })) as unknown as typeof fetch;
    await expect(pingUnity(new AbortController().signal, request)).resolves.toMatchObject({ type: 'pong' });
    expect(request).toHaveBeenCalledWith(`${UNITY_BRIDGE_URL}/ping`, expect.objectContaining({ method: 'GET', cache: 'no-store' }));
  });

  it('rejects an unexpected health response', async () => {
    const request = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'ready', source: 'other', version: 0 }) })) as unknown as typeof fetch;
    await expect(connectToUnity(new AbortController().signal, request)).rejects.toThrow('unexpected bridge response');
  });

  it('sends max.blink and accepts only the matching Unity acknowledgement', async () => {
    const request = vi.fn(async () => ({ ok: true, status: 202, json: async () => ({ status: 'accepted', command: 'max.blink', source: 'unity', version: 1 }) })) as unknown as typeof fetch;
    await expect(blinkMaxInUnity(new AbortController().signal, request)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith(`${UNITY_BRIDGE_URL}/command`, expect.objectContaining({ method: 'POST', body: '{"command":"max.blink"}' }));
    const wrong = vi.fn(async () => ({ ok: true, status: 202, json: async () => ({ status: 'accepted', command: 'max.wave', source: 'unity', version: 1 }) })) as unknown as typeof fetch;
    await expect(blinkMaxInUnity(new AbortController().signal, wrong)).rejects.toThrow('did not acknowledge');
  });

  it('reports Unity command failures without claiming animation completion', async () => {
    const request = vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ status: 'failed', reason: 'Max is already blinking', source: 'unity', version: 1 }) })) as unknown as typeof fetch;
    await expect(blinkMaxInUnity(new AbortController().signal, request)).rejects.toThrow('Max is already blinking');
  });

  it('treats a stalled Unity player loop as unavailable', async () => {
    const health = vi.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;
    await expect(connectToUnity(new AbortController().signal, health)).rejects.toBeInstanceOf(UnityBridgeUnavailableError);
    const blink = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ status: 'failed', reason: 'Unity main thread did not respond', source: 'unity', version: 1 }) })) as unknown as typeof fetch;
    await expect(blinkMaxInUnity(new AbortController().signal, blink)).rejects.toBeInstanceOf(UnityBridgeUnavailableError);
  });
});

describe('Director Controls Bridge V2 client', () => {
  it('sends typed commands for both characters and requires matching main-thread acknowledgements', async () => {
    const request = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body)) as { command: string; actor: string; target?: string };
      return { ok: true, status: 202, json: async () => ({ ...sent, source: 'unity', version: 2, status: 'accepted' }) };
    }) as unknown as typeof fetch;
    await expect(sendActingCommandToUnity({ actor: 'max', action: 'look_at', target: 'maxine' }, new AbortController().signal, request)).resolves.toMatchObject({ actor: 'max', target: 'maxine' });
    await expect(sendActingCommandToUnity({ actor: 'maxine', action: 'wave' }, new AbortController().signal, request)).resolves.toMatchObject({ actor: 'maxine', command: 'acting.wave' });
    await expect(sendActingCommandToUnity({ actor: 'maxine', action: 'idle' }, new AbortController().signal, request)).resolves.toMatchObject({ actor: 'maxine', command: 'acting.idle' });
    expect(request).toHaveBeenCalledWith(`${UNITY_BRIDGE_URL}/command`, expect.objectContaining({ method: 'POST', body: '{"command":"acting.look_at","actor":"max","target":"maxine"}' }));
  });

  it('does not claim success for a rejected or mismatched command', async () => {
    const rejected = vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ status: 'rejected', reason: 'Wave already in progress', source: 'unity', version: 2 }) })) as unknown as typeof fetch;
    await expect(sendActingCommandToUnity({ actor: 'max', action: 'wave' }, new AbortController().signal, rejected)).rejects.toThrow('Wave already in progress');
    const wrong = vi.fn(async () => ({ ok: true, status: 202, json: async () => ({ status: 'accepted', command: 'acting.wave', actor: 'maxine', source: 'unity', version: 2 }) })) as unknown as typeof fetch;
    await expect(sendActingCommandToUnity({ actor: 'max', action: 'wave' }, new AbortController().signal, wrong)).rejects.toThrow('did not acknowledge');
    await expect(sendActingCommandToUnity({ actor: 'max', action: 'look_at', target: 'max' }, new AbortController().signal, wrong)).rejects.toThrow('different Look At target');
  });

  it('reports a command timeout distinctly', async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })) as unknown as typeof fetch;
      const result = sendActingCommandToUnity({ actor: 'maxine', action: 'idle' }, new AbortController().signal, request);
      const assertion = expect(result).rejects.toBeInstanceOf(UnityBridgeTimeoutError);
      await vi.advanceTimersByTimeAsync(3501);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

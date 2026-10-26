import { describe, expect, it, vi } from 'vitest';
import { blinkMaxInUnity, connectToUnity, getUnityEditorStatus, livingRoomUnityConfig, livingRoomUnityPolishedConfig, pingUnity, portalCommand, sendActingCommandToUnity, startUnityEditor, stopUnityEditor, unitySceneCommand, UnityBridgeTimeoutError, UnityBridgeUnavailableError, UNITY_BRIDGE_URL, UNITY_EDITOR_CONTROL_URL } from './unityBridge';

describe('Unity Editor Play Mode controller', () => {
  const token = 'a'.repeat(64);
  it('reads a Studio session token and confirms Editor Ready status with authentication', async () => {
    const request = vi.fn(async (url: string, init: RequestInit) => url === '/__brighttales_unity_control/session'
      ? ({ ok: true, status: 200, json: async () => ({ token, controllerState: 'ready', detail: '' }) })
      : ({ ok: true, status: 200, json: async () => ({ source: 'unity-editor', version: 1, state: 'Editor Ready', isPlaying: false }) })) as unknown as typeof fetch;
    await expect(getUnityEditorStatus(new AbortController().signal, request)).resolves.toMatchObject({ state: 'Editor Ready', isPlaying: false });
    expect(request).toHaveBeenNthCalledWith(1, '/__brighttales_unity_control/session', expect.objectContaining({ method: 'GET', cache: 'no-store' }));
    expect(request).toHaveBeenNthCalledWith(2, `${UNITY_EDITOR_CONTROL_URL}/status`, expect.objectContaining({ headers: { Authorization: `Bearer ${token}` } }));
  });

  it('sends only Start and Stop and requires the matching Unity Editor acknowledgement', async () => {
    const request = vi.fn(async (url: string) => url === '/__brighttales_unity_control/session'
      ? ({ ok: true, status: 200, json: async () => ({ token, controllerState: 'ready' }) })
      : ({ ok: true, status: 202, json: async () => ({ source: 'unity-editor', version: 1, state: 'Starting', isPlaying: false }) })) as unknown as typeof fetch;
    await expect(startUnityEditor(new AbortController().signal, request)).resolves.toMatchObject({ state: 'Starting' });
    expect(request).toHaveBeenNthCalledWith(2, `${UNITY_EDITOR_CONTROL_URL}/command`, expect.objectContaining({ method: 'POST', body: '{"command":"start"}' }));
    const stopped = vi.fn(async (url: string) => url === '/__brighttales_unity_control/session'
      ? ({ ok: true, status: 200, json: async () => ({ token, controllerState: 'ready' }) })
      : ({ ok: true, status: 202, json: async () => ({ source: 'unity-editor', version: 1, state: 'Stopping', isPlaying: true }) })) as unknown as typeof fetch;
    await expect(stopUnityEditor(new AbortController().signal, stopped)).resolves.toMatchObject({ state: 'Stopping' });
    expect(stopped).toHaveBeenNthCalledWith(2, `${UNITY_EDITOR_CONTROL_URL}/command`, expect.objectContaining({ method: 'POST', body: '{"command":"stop"}' }));
  });

  it('explains a missing Editor session and rejects authentication or malformed status replies', async () => {
    const closed = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: 'Unity Editor is not available. Start the Unity project with the BrightTales review launcher first.' }) })) as unknown as typeof fetch;
    await expect(startUnityEditor(new AbortController().signal, closed)).rejects.toThrow('review launcher');
    const session = async () => ({ ok: true, status: 200, json: async () => ({ token, controllerState: 'ready' }) });
    const denied = vi.fn(async (url: string) => url === '/__brighttales_unity_control/session' ? session() : ({ ok: false, status: 401, json: async () => ({ error: 'authentication failed' }) })) as unknown as typeof fetch;
    await expect(getUnityEditorStatus(new AbortController().signal, denied)).rejects.toThrow('authentication failed');
    const invalid = vi.fn(async (url: string) => url === '/__brighttales_unity_control/session' ? session() : ({ ok: true, status: 200, json: async () => ({ source: 'other', version: 1, state: 'Playing', isPlaying: true }) })) as unknown as typeof fetch;
    await expect(getUnityEditorStatus(new AbortController().signal, invalid)).rejects.toThrow('unexpected status');
    const controllerError = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ token, controllerState: 'Error', detail: 'Unity Editor control port 17845 is unavailable.' }) })) as unknown as typeof fetch;
    await expect(getUnityEditorStatus(new AbortController().signal, controllerError)).rejects.toThrow('port 17845 is unavailable');
  });
});

describe('Cartoon Engine V1 scene transfer', () => {
  const id = '0123456789abcdef0123456789abcdef';
  it('sends a bounded scene and waits for the matching Unity run', async () => {
    const request = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body));
      return { ok: true, status: 202, json: async () => ({ command: sent.command, runId: sent.runId, sceneId: sent.config.sceneId, status: 'loaded', elapsed: 0, duration: 26, source: 'unity', version: 4 }) };
    }) as unknown as typeof fetch;
    await expect(unitySceneCommand('load', id, new AbortController().signal, { config: livingRoomUnityConfig() }, request)).resolves.toMatchObject({ runId: id, status: 'loaded' });
    expect(JSON.parse(String((request as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).config.characters.map((actor: { id: string }) => actor.id)).toEqual(['max', 'maxine']);
  });
  it('rejects a mismatched acknowledgement and disconnected Unity', async () => {
    const wrong = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ command: 'scene.status', runId: 'ffffffffffffffffffffffffffffffff', sceneId: 'max-maxine-living-room-v1', status: 'complete', elapsed: 26, duration: 26, source: 'unity', version: 4 }) })) as unknown as typeof fetch;
    await expect(unitySceneCommand('status', id, new AbortController().signal, {}, wrong)).rejects.toThrow('did not acknowledge');
    const disconnected = vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    await expect(unitySceneCommand('load', id, new AbortController().signal, { config: livingRoomUnityConfig() }, disconnected)).rejects.toThrow('Failed to fetch');
  });
});

describe('Cartoon Engine V1.1 scene transfer', () => {
  it('uses the matching experimental scene for load and later status acknowledgements', async () => {
    const id = '0123456789abcdef0123456789abcdef';
    const config = livingRoomUnityPolishedConfig();
    const request = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body));
      return { ok: true, status: sent.command === 'scene.status' ? 200 : 202,
        json: async () => ({ command: sent.command, runId: id, sceneId: config.sceneId,
          status: sent.command === 'scene.load' ? 'loaded' : 'playing', elapsed: 4, duration: 26, source: 'unity', version: 4 }) };
    }) as unknown as typeof fetch;
    await expect(unitySceneCommand('load', id, new AbortController().signal, { config }, request)).resolves.toMatchObject({ sceneId: config.sceneId });
    await expect(unitySceneCommand('status', id, new AbortController().signal, { sceneId: config.sceneId }, request)).resolves.toMatchObject({ status: 'playing' });
    await expect(unitySceneCommand('status', id, new AbortController().signal, {}, request)).rejects.toThrow('did not acknowledge');
  });
});

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

describe('Portal V1 loopback client', () => {
  const id = '0123456789abcdef0123456789abcdef';
  it('requires matching Unity transfer acknowledgements', async () => {
    const request = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body));
      return { ok: true, status: 202, json: async () => ({ ...sent, source: 'unity', version: 3, status: 'preparing' }) };
    }) as unknown as typeof fetch;
    await expect(portalCommand('prepare', id, new AbortController().signal, request)).resolves.toMatchObject({ transferId: id, status: 'preparing' });
    expect(request).toHaveBeenCalledWith(`${UNITY_BRIDGE_URL}/command`, expect.objectContaining({ body: JSON.stringify({ command: 'portal.prepare', character: 'max', transferId: id }) }));
    const wrong = vi.fn(async () => ({ ok: true, status: 202, json: async () => ({ source: 'unity', version: 3, status: 'preparing', command: 'portal.prepare', character: 'max', transferId: 'ffffffffffffffffffffffffffffffff' }) })) as unknown as typeof fetch;
    await expect(portalCommand('prepare', id, new AbortController().signal, wrong)).rejects.toThrow('did not acknowledge');
  });
  it('surfaces rejection and invalid transfer IDs', async () => {
    const rejected = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ source: 'unity', version: 3, status: 'rejected', reason: 'Portal V1 scene is not ready' }) })) as unknown as typeof fetch;
    await expect(portalCommand('prepare', id, new AbortController().signal, rejected)).rejects.toThrow('Portal V1 scene is not ready');
    await expect(portalCommand('prepare', 'bad', new AbortController().signal, rejected)).rejects.toThrow('Invalid portal transfer ID');
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

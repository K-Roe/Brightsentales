export const UNITY_BRIDGE_URL = 'http://127.0.0.1:17843';

type BridgeReply = { source: 'unity'; version: 0; status?: 'ready'; type?: 'pong' };

export class UnityBridgeUnavailableError extends Error {}

async function command(path: '/health' | '/ping', signal: AbortSignal, request: typeof fetch): Promise<BridgeReply> {
  const response = await request(`${UNITY_BRIDGE_URL}${path}`, { method: 'GET', cache: 'no-store', signal });
  if (!response.ok) {
    if (response.status === 503) throw new UnityBridgeUnavailableError('Unity Play mode is not updating. Return to Unity, check Play mode, then reconnect.');
    throw new Error(`Unity returned HTTP ${response.status}.`);
  }
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Unity sent an invalid response.');
  const reply = data as Record<string, unknown>;
  if (reply.source !== 'unity' || reply.version !== 0 || (path === '/health' ? reply.status !== 'ready' : reply.type !== 'pong')) {
    throw new Error('Unity sent an unexpected bridge response.');
  }
  return reply as BridgeReply;
}

export const connectToUnity = (signal: AbortSignal, request: typeof fetch = fetch) => command('/health', signal, request);
export const pingUnity = (signal: AbortSignal, request: typeof fetch = fetch) => command('/ping', signal, request);

/** A 202 confirms Unity started handling the command, not that a frame was visually observed. */
export async function blinkMaxInUnity(signal: AbortSignal, request: typeof fetch = fetch): Promise<void> {
  const response = await request(`${UNITY_BRIDGE_URL}/command`, {
    method: 'POST', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'max.blink' }),
  });
  let data: unknown;
  try { data = await response.json(); } catch { throw new Error('Unity sent an invalid command response.'); }
  if (!data || typeof data !== 'object') throw new Error('Unity sent an invalid command response.');
  const reply = data as Record<string, unknown>;
  if (reply.source !== 'unity' || reply.version !== 1) throw new Error('Unity sent an unexpected bridge response.');
  if (!response.ok) {
    const reason = typeof reply.reason === 'string' ? reply.reason : `Unity returned HTTP ${response.status}.`;
    if (response.status === 503 && reason === 'Unity main thread did not respond') {
      throw new UnityBridgeUnavailableError('Unity Play mode is not updating. Return to Unity, check Play mode, then reconnect.');
    }
    throw new Error(reason);
  }
  if (response.status !== 202 || reply.status !== 'accepted' || reply.command !== 'max.blink') {
    throw new Error('Unity did not acknowledge max.blink.');
  }
}

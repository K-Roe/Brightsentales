export const UNITY_BRIDGE_URL = 'http://127.0.0.1:17843';

type BridgeReply = { source: 'unity'; version: 0; status?: 'ready'; type?: 'pong' };

export class UnityBridgeUnavailableError extends Error {}
export class UnityBridgeTimeoutError extends UnityBridgeUnavailableError {}

export type ActingCharacter = 'max' | 'maxine';
export type ActingCommand =
  | { actor: ActingCharacter; action: 'look_at'; target: ActingCharacter }
  | { actor: ActingCharacter; action: 'wave' | 'idle' };

export type ActingAcknowledgement = {
  status: 'accepted'; command: 'acting.look_at' | 'acting.wave' | 'acting.idle';
  actor: ActingCharacter; target?: ActingCharacter;
};

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

/** Acknowledged means the Unity main thread accepted the action, not that its animation has finished. */
export async function sendActingCommandToUnity(command: ActingCommand, signal: AbortSignal, request: typeof fetch = fetch): Promise<ActingAcknowledgement> {
  if (!['max', 'maxine'].includes(command.actor) || !['look_at', 'wave', 'idle'].includes(command.action) ||
      (command.action === 'look_at' && (!['max', 'maxine'].includes(command.target) || command.target === command.actor))) {
    throw new Error('Choose a valid character, action and different Look At target.');
  }
  const name = `acting.${command.action}` as ActingAcknowledgement['command'];
  const body = command.action === 'look_at'
    ? { command: name, actor: command.actor, target: command.target }
    : { command: name, actor: command.actor };
  const timeout = new AbortController();
  const forwardAbort = () => timeout.abort();
  signal.addEventListener('abort', forwardAbort, { once: true });
  if (signal.aborted) timeout.abort();
  const timer = setTimeout(() => timeout.abort(), 3500);
  let response: Response;
  try {
    response = await request(`${UNITY_BRIDGE_URL}/command`, {
      method: 'POST', cache: 'no-store', signal: timeout.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch (error) {
    if (timeout.signal.aborted && !signal.aborted) throw new UnityBridgeTimeoutError('Unity did not answer within 3.5 seconds. Check Play mode and reconnect.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', forwardAbort);
  }
  let data: unknown;
  try { data = await response.json(); } catch { throw new Error('Unity sent an invalid acting response.'); }
  if (!data || typeof data !== 'object') throw new Error('Unity sent an invalid acting response.');
  const reply = data as Record<string, unknown>;
  if (reply.source !== 'unity' || reply.version !== 2) throw new Error('Unity sent an unexpected acting response.');
  if (!response.ok) {
    const reason = typeof reply.reason === 'string' ? reply.reason : `Unity returned HTTP ${response.status}.`;
    if (response.status === 503 && reason === 'Unity main thread did not respond')
      throw new UnityBridgeUnavailableError('Unity Play mode is not updating. Return to Unity, check Play mode, then reconnect.');
    throw new Error(reason);
  }
  if (response.status !== 202 || reply.status !== 'accepted' || reply.command !== name || reply.actor !== command.actor ||
      (command.action === 'look_at' && reply.target !== command.target)) {
    throw new Error('Unity did not acknowledge the requested acting command.');
  }
  return reply as ActingAcknowledgement;
}

import { clampPoint } from './scene';
import { validateTimedLibrary, type TimedScene } from './timedScenes';
import { UNITY_BRIDGE_URL, UnityBridgeTimeoutError } from './unityBridge';

export type StudioSceneConfig = {
  version: 2;
  sceneId: string;
  environment: 'living-room';
  duration: number;
  calmLife: boolean;
  characters: { id: 'max' | 'maxine'; x: number; y: number; facing: 'front' | 'left' | 'right' }[];
  actions: { id: string; characterId: 'max' | 'maxine'; type: 'appear' | 'walk' | 'wait' | 'wave' | 'disappear' | 'look-at'; start: number; duration: number; x: number; y: number; target: string; motion: 'gentle' | 'linear' }[];
  camera: { id: string; shot: 'wide' | 'medium' | 'close-up'; focus: 'max' | 'maxine' | 'group' | 'point'; x: number; y: number; follow: boolean; start: number; duration: number }[];
};

export type StudioSceneAction = 'load' | 'play' | 'status' | 'reset';
export type StudioSceneReply = {
  source: 'unity'; version: 5; command: `studio.${StudioSceneAction}`; runId: string; sceneId: string;
  revision: string; status: 'idle' | 'loaded' | 'playing' | 'complete'; elapsed: number; duration: number; reason: string;
};

/** Fingerprints the actual supported payload, including saved positions and action timing. */
export async function studioSceneRevision(config: StudioSceneConfig): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(config)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Transfers only artwork and actions with a faithful mapping in the isolated Unity scene. */
export function studioSceneConfig(scene: TimedScene): StudioSceneConfig {
  if (scene.placeId !== 'living-room') throw new Error('Unity currently supports the approved Living Room artwork only.');
  const validated = validateTimedLibrary({ version: 1, scenes: [scene] }, ['living-room']);
  if (!validated.ok) throw new Error(validated.error);
  if (scene.duration > 120) throw new Error('Unity saved-scene playback is limited to 120 seconds.');
  if (scene.audio?.length) throw new Error('Scene audio is not supported by Unity playback yet.');
  if (scene.phone?.length || scene.phoneIn) throw new Error('Bright Speak is not supported by Unity playback yet.');
  if (scene.objects?.length) throw new Error('Scene objects are not supported by Unity playback yet.');
  if (scene.life && (scene.life.mode !== 'v2' || scene.life.ambience !== false) || scene.livingWorld)
    throw new Error('For Unity preview, choose Calm Life without room ambience. Living World is not supported yet.');
  const ids = Object.keys(scene.characters);
  if (!ids.length || ids.length > 2 || ids.some(id => id !== 'max' && id !== 'maxine'))
    throw new Error('Unity saved-scene playback currently supports Max and Maxine only.');
  if (scene.actions.length > 100) throw new Error('Unity saved-scene playback supports at most 100 actions.');
  for (const action of scene.actions) {
    if (!['appear', 'walk', 'wait', 'wave', 'disappear', 'look-at'].includes(action.type))
      throw new Error(`${action.type} is not supported by Unity saved-scene playback yet.`);
    if (action.artwork) throw new Error(`The ${action.artwork} artwork variant is not supported by Unity saved-scene playback.`);
    if (action.point && (clampPoint(action.point).x !== action.point.x || clampPoint(action.point).y !== action.point.y))
      throw new Error(`${action.type} destination is outside the approved Unity stage.`);
  }
  return {
    version: 2, sceneId: scene.id, environment: 'living-room', duration: scene.duration,
    calmLife: scene.life?.mode === 'v2',
    characters: ids.map(id => {
      const point = scene.characters[id];
      if (clampPoint(point).x !== point.x || clampPoint(point).y !== point.y)
        throw new Error(`${id} starts outside the approved Unity stage.`);
      return { id: id as 'max' | 'maxine', x: point.x, y: point.y, facing: 'front' as const };
    }),
    actions: scene.actions.map(action => ({
      id: action.id, characterId: action.characterId as 'max' | 'maxine',
      type: action.type as StudioSceneConfig['actions'][number]['type'],
      start: action.start, duration: action.duration,
      x: action.point?.x ?? 0, y: action.point?.y ?? 0,
      target: action.target ?? '', motion: action.motion ?? 'linear',
    })),
    camera: (scene.camera ?? []).map(key => ({
      id: key.id, shot: key.shot, focus: key.focus,
      x: key.point?.x ?? 0, y: key.point?.y ?? 0, follow: !!key.follow,
      start: key.start, duration: key.duration,
    })),
  };
}

export async function studioSceneCommand(action: StudioSceneAction, runId: string, sceneId: string,
  signal: AbortSignal, options: { config?: StudioSceneConfig; revision?: string } = {}, request: typeof fetch = fetch): Promise<StudioSceneReply> {
  if (!/^[a-f0-9]{32}$/.test(runId)) throw new Error('Invalid scene run ID.');
  if (!/^[a-f0-9]{8}-[a-f0-9-]{27}$/.test(sceneId)) throw new Error('Invalid saved scene ID.');
  if (action === 'load' && (!options.config || options.config.sceneId !== sceneId)) throw new Error('Saved scene payload is missing or mismatched.');
  const revision = action === 'load' ? await studioSceneRevision(options.config!) : options.revision;
  if (!revision || !/^[a-f0-9]{64}$/.test(revision)) throw new Error('Saved scene revision is missing or invalid.');
  const controller = new AbortController();
  const forward = () => controller.abort();
  signal.addEventListener('abort', forward, { once: true });
  if (signal.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), 3500);
  let response: Response;
  try {
    response = await request(`${UNITY_BRIDGE_URL}/command`, {
      method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: `studio.${action}`, runId, sceneId, revision, ...(options.config ? { config: options.config } : {}) }),
    });
  } catch (error) {
    if (controller.signal.aborted && !signal.aborted) throw new UnityBridgeTimeoutError('Unity did not answer the saved scene request within 3.5 seconds.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', forward);
  }
  let value: unknown;
  try { value = await response.json(); } catch { throw new Error('Unity sent invalid saved scene JSON.'); }
  if (!value || typeof value !== 'object') throw new Error('Unity sent an invalid saved scene response.');
  const reply = value as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof reply.reason === 'string' ? reply.reason : `Unity returned HTTP ${response.status}.`);
  if (reply.source !== 'unity' || reply.version !== 5 || reply.command !== `studio.${action}` ||
      reply.runId !== runId || reply.sceneId !== sceneId || reply.revision !== revision ||
      !['idle', 'loaded', 'playing', 'complete'].includes(String(reply.status)) ||
      typeof reply.elapsed !== 'number' || !Number.isFinite(reply.elapsed) ||
      typeof reply.duration !== 'number' || !Number.isFinite(reply.duration) ||
      response.status !== (action === 'status' ? 200 : 202))
    throw new Error('Unity did not acknowledge this saved scene run.');
  return reply as StudioSceneReply;
}

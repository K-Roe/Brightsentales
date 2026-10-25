import type { AudioAsset } from './audio';
import { episodePlaybackClips, type PlaybackClip } from './audioPlayback';
import { episodeTimingIssue, missingSceneIds, productionBlocks, productionDuration, type Episode } from './episodes';
import type { TimedLibrary } from './timedScenes';
import { episodeCameraIssue } from './episodeCamera';
import { studioSceneConfig, type StudioSceneConfig } from './studioSceneBridge';
import { transferStudioAudioClips, type StudioAudioAsset } from './studioAudioTransfer';
import { UNITY_BRIDGE_URL, UnityBridgeTimeoutError } from './unityBridge';

export type StudioEpisodeConfig = {
  version: 1 | 2 | 3;
  episodeId: string;
  duration: number;
  scenes: { index: number; start: number; duration?: number; transition?: { type: 'fade-black'; duration: number }; scene: StudioSceneConfig }[];
  camera?: { id: string; start: number; duration: number; shot: 'wide' | 'medium' | 'close-up' | 'custom'; target: string; x: number; y: number; zoom: number; movement: 'static' | 'pan' | 'follow' }[];
  audioAssets: StudioAudioAsset[];
  audio: { id: string; assetId: string; source: 'scene' | 'episode'; start: number; trimStart: number; trimEnd: number; volume: number; fadeIn: number; fadeOut: number }[];
};

export type StudioEpisodeAction = 'load' | 'play' | 'pause' | 'stop' | 'status' | 'reset';
export type StudioEpisodeReply = {
  source: 'unity'; version: 6; command: `episode.${StudioEpisodeAction}`;
  runId: string; episodeId: string; revision: string;
  status: 'idle' | 'loading' | 'loaded' | 'playing' | 'paused' | 'complete';
  elapsed: number; duration: number; sceneIndex: number; sceneId: string; reason: string;
};

function episodeClips(episode: Episode, library: TimedLibrary, duration: number): PlaybackClip[] {
  return episodePlaybackClips(episode, library).filter(clip => clip.start < duration)
    .map(clip => ({ ...clip, trimEnd: Math.min(clip.trimEnd, clip.trimStart + duration - clip.start) }));
}

/** The episode is an ordered list of occurrences. Repeated scene IDs keep separate clocks. */
export function studioEpisodeConfig(episode: Episode, library: TimedLibrary, media: StudioAudioAsset[] = []): StudioEpisodeConfig {
  if (episode.introId || episode.creditsId) throw new Error('Unity episode preview does not yet render intros or credits. Browser playback is available.');
  if (episode.sceneIds.length === 0) throw new Error('Add a saved scene before previewing this episode in Unity.');
  const missing = missingSceneIds(episode, library);
  if (missing.length) throw new Error(`Restore the missing saved scene before Unity preview: ${missing[0]}`);
  const timingIssue = episodeTimingIssue(episode, library);
  if (timingIssue) throw new Error(timingIssue);
  const blocks = productionBlocks(episode, library);
  const duration = productionDuration(episode, library);
  const cameraIssue = episodeCameraIssue(episode, library, duration);
  if (cameraIssue) throw new Error(cameraIssue);
  if (episode.camera?.some(shot => shot.target !== 'point' && shot.target !== 'max' && shot.target !== 'maxine'))
    throw new Error('Unity camera preview supports Max, Maxine or a fixed position. This shot targets another Brightling.');
  if (duration <= 0 || duration > 3600) throw new Error('Unity episode preview supports up to 60 minutes.');
  const clips = episodeClips(episode, library, duration);
  if (clips.length > 200) throw new Error('Unity episode preview supports up to 200 audio clips.');
  const mediaIds = new Set(media.map(asset => asset.id));
  if (mediaIds.size !== media.length || clips.some(clip => !mediaIds.has(clip.assetId)))
    throw new Error('Transfer every episode and scene audio file before sending to Unity.');
  const version = episode.camera?.length ? 3 : episode.sceneSettings?.some(setting => setting.duration !== undefined || setting.transition !== undefined) ? 2 : 1;
  return {
    version, episodeId: episode.id, duration,
    scenes: blocks.map(block => {
      const scene = studioSceneConfig(block.scene, media);
      return { index: block.index, start: block.start, ...(version >= 2 ? { duration: block.duration, ...(block.occurrenceIndex === undefined ? {} : { transition: episode.sceneSettings?.[block.occurrenceIndex]?.transition }) } : {}), scene: { ...scene, version: 2, audioAssets: undefined, audio: undefined } };
    }),
    ...(episode.camera?.length ? { camera: episode.camera.map(shot => ({
      id: shot.id, start: shot.start, duration: shot.duration, shot: shot.shot, target: shot.target,
      x: shot.target === 'point' ? shot.x! : 0, y: shot.target === 'point' ? shot.y! : 0,
      zoom: shot.shot === 'custom' ? shot.zoom ?? 2 : 0, movement: shot.movement,
    })) } : {}),
    audioAssets: media,
    audio: clips.map(clip => {
      const length = clip.trimEnd - clip.trimStart;
      return { id: clip.key, assetId: clip.assetId, source: clip.source, start: clip.start,
        trimStart: clip.trimStart, trimEnd: clip.trimEnd, volume: clip.volume,
        fadeIn: Math.min(clip.fadeIn, length), fadeOut: Math.min(clip.fadeOut, length) };
    }),
  };
}

export async function prepareStudioEpisode(episode: Episode, library: TimedLibrary, assets: AudioAsset[], signal: AbortSignal,
  request: typeof fetch = fetch, origin = window.location.origin): Promise<StudioEpisodeConfig> {
  const duration = productionDuration(episode, library);
  const clips = episodeClips(episode, library, duration);
  // Validate all artwork/actions before uploading any media.
  studioEpisodeConfig(episode, library, clips.map(clip => clip.assetId)
    .filter((id, index, all) => all.indexOf(id) === index).map(id => ({ id } as StudioAudioAsset)));
  const media = await transferStudioAudioClips(clips, assets, signal, request, origin);
  return studioEpisodeConfig(episode, library, media);
}

export async function studioEpisodeRevision(config: StudioEpisodeConfig): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(config));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function studioEpisodeCommand(action: StudioEpisodeAction, runId: string, episodeId: string,
  signal: AbortSignal, options: { config?: StudioEpisodeConfig; revision?: string } = {}, request: typeof fetch = fetch): Promise<StudioEpisodeReply> {
  if (!/^[a-f0-9]{32}$/.test(runId)) throw new Error('Invalid episode run ID.');
  if (!/^[a-f0-9]{8}-[a-f0-9-]{27}$/.test(episodeId)) throw new Error('Invalid saved episode ID.');
  if (action === 'load' && (!options.config || options.config.episodeId !== episodeId)) throw new Error('Saved episode payload is missing or mismatched.');
  const revision = action === 'load' ? await studioEpisodeRevision(options.config!) : options.revision;
  if (!revision || !/^[a-f0-9]{64}$/.test(revision)) throw new Error('Saved episode revision is missing or invalid.');
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
      body: JSON.stringify({ command: `episode.${action}`, runId, episodeId, revision, ...(options.config ? { config: options.config } : {}) }),
    });
  } catch (error) {
    if (controller.signal.aborted && !signal.aborted) throw new UnityBridgeTimeoutError('Unity did not answer the episode request within 3.5 seconds.');
    throw error;
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', forward);
  }
  let value: unknown;
  try { value = await response.json(); } catch { throw new Error('Unity sent invalid episode JSON.'); }
  const reply = value as StudioEpisodeReply;
  if (!response.ok) throw new Error(typeof reply?.reason === 'string' ? reply.reason : `Unity returned HTTP ${response.status}.`);
  if (!reply || reply.source !== 'unity' || reply.version !== 6 || reply.command !== `episode.${action}` ||
      reply.runId !== runId || reply.episodeId !== episodeId || reply.revision !== revision ||
      !['idle', 'loading', 'loaded', 'playing', 'paused', 'complete'].includes(reply.status) ||
      !Number.isFinite(reply.elapsed) || !Number.isFinite(reply.duration) ||
      !Number.isInteger(reply.sceneIndex) || typeof reply.sceneId !== 'string' ||
      response.status !== (action === 'status' ? 200 : 202))
    throw new Error('Unity did not acknowledge this episode run.');
  return reply;
}

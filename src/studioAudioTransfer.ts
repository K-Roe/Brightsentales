import { AUDIO_MIMES, validAudioInfo, type AudioAsset } from './audio';
import type { TimedScene } from './timedScenes';

export type StudioAudioAsset = {
  id: string; kind: 'music' | 'effect' | 'speech'; mime: string; duration: number;
  size: number; sha256: string; url: string;
};

const digest = async (bytes: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map(byte => byte.toString(16).padStart(2, '0')).join('');

/** Send only scene-referenced media to Studio's local, ephemeral relay. */
export async function transferStudioAudio(scene: TimedScene, assets: AudioAsset[], signal: AbortSignal,
  request: typeof fetch = fetch, origin = window.location.origin): Promise<StudioAudioAsset[]> {
  const result: StudioAudioAsset[] = [];
  const byId = new Map(assets.map(asset => [asset.id, asset]));
  for (const id of new Set((scene.audio ?? []).map(clip => clip.assetId))) {
    const asset = byId.get(id);
    if (!asset) throw new Error(`Audio file for a clip is missing: ${id}`);
    if (!validAudioInfo(asset) || !AUDIO_MIMES.includes(asset.blob?.type) ||
        asset.blob.type !== asset.mime || asset.blob.size !== asset.size)
      throw new Error(`Audio file for ${asset.name || id} is invalid.`);
    for (const clip of scene.audio ?? []) {
      if (clip.assetId === id && clip.trimEnd > asset.duration + .05)
        throw new Error(`Audio clip for ${asset.name} exceeds its file duration.`);
    }
    const bytes = await asset.blob.arrayBuffer();
    const sha256 = await digest(bytes);
    const response = await request(`${origin}/api/studio-audio`, {
      method: 'POST', cache: 'no-store', signal,
      headers: { 'Content-Type': asset.mime, 'X-BrightTales-Audio-Id': id, 'X-BrightTales-Sha256': sha256 },
      body: bytes,
    });
    if (!response.ok) throw new Error(`Local audio transfer failed for ${asset.name}: HTTP ${response.status}.`);
    const reply: unknown = await response.json();
    const value = reply as Record<string, unknown>;
    if (!value || value.id !== id || value.sha256 !== sha256 || value.size !== asset.size ||
        typeof value.url !== 'string' || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d{1,5}\/api\/studio-audio\/[a-f0-9]{48}$/.test(value.url) ||
        new URL(value.url).origin !== origin)
      throw new Error('Local audio relay returned an invalid asset address.');
    result.push({ id, kind: asset.kind, mime: asset.mime, duration: asset.duration, size: asset.size, sha256, url: value.url });
  }
  return result;
}

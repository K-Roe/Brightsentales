export type AudioKind = 'music' | 'effect';
export type AudioClip = { id: string; assetId: string; start: number; trimStart: number; trimEnd: number; volume: number; fadeIn: number; fadeOut: number };
export type AudioAssetInfo = { id: string; name: string; kind: AudioKind; mime: string; duration: number; size: number };
export type AudioAsset = AudioAssetInfo & { blob: Blob };
export type AudioBackupAsset = AudioAssetInfo & { data: string; sha256: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const AUDIO_MIMES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg'];
const validNumber = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
export const clipLength = (clip: AudioClip) => clip.trimEnd - clip.trimStart;

export function validAudioClip(value: unknown, limit: number): value is AudioClip {
  if (!value || typeof value !== 'object') return false;
  const c = value as AudioClip;
  return uuid.test(c.id) && uuid.test(c.assetId) && validNumber(c.start) && c.start >= 0 && c.start < limit && validNumber(c.trimStart) && c.trimStart >= 0 && validNumber(c.trimEnd) && c.trimEnd > c.trimStart && c.trimEnd <= 36000 && validNumber(c.volume) && c.volume >= 0 && c.volume <= 1 && validNumber(c.fadeIn) && c.fadeIn >= 0 && c.fadeIn <= clipLength(c) && validNumber(c.fadeOut) && c.fadeOut >= 0 && c.fadeOut <= clipLength(c);
}

export function validAudioClips(value: unknown, limit: number): value is AudioClip[] {
  return Array.isArray(value) && value.length <= 200 && value.every(item => validAudioClip(item, limit)) && new Set(value.map(item => item.id)).size === value.length;
}

export function validAudioInfo(value: unknown): value is AudioAssetInfo {
  if (!value || typeof value !== 'object') return false;
  const a = value as AudioAssetInfo;
  return uuid.test(a.id) && typeof a.name === 'string' && !!a.name.trim() && a.name === a.name.trim() && a.name.length <= 120 && (a.kind === 'music' || a.kind === 'effect') && AUDIO_MIMES.includes(a.mime) && validNumber(a.duration) && a.duration > 0 && a.duration <= 36000 && Number.isSafeInteger(a.size) && a.size > 0 && a.size <= 20_000_000;
}

export function validAudioBackup(value: unknown): value is AudioBackupAsset[] {
  if (!Array.isArray(value) || value.length > 100) return false;
  const ids = new Set<string>();
  return value.every(asset => {
    if (!validAudioInfo(asset)) return false;
    const file = asset as AudioBackupAsset;
    if (ids.has(file.id) || typeof file.data !== 'string' || file.data.length > 28_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.data) || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) return false;
    ids.add(asset.id);
    return true;
  });
}

export function effectiveVolume(clip: AudioClip, time: number, sceneMusicUnderEpisode = false): number {
  const elapsed = time - clip.start;
  if (elapsed < 0 || elapsed >= clipLength(clip)) return 0;
  const inGain = clip.fadeIn > 0 ? Math.min(1, elapsed / clip.fadeIn) : 1;
  const outGain = clip.fadeOut > 0 ? Math.min(1, (clipLength(clip) - elapsed) / clip.fadeOut) : 1;
  return clip.volume * Math.min(inGain, outGain) * (sceneMusicUnderEpisode ? .5 : 1);
}

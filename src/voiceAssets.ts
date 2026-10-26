import type { AudioAsset } from './audio';

export function createSpeechAsset(blob: Blob, duration: number, name: string, speakerId?: string): AudioAsset {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600 || !blob.size || blob.size > 20_000_000) {
    throw new Error('Voice must be under 10 minutes and 20 MB.');
  }
  return {
    id: crypto.randomUUID(), name: name.trim().slice(0, 120) || 'Untitled voice', kind: 'speech',
    mime: blob.type || 'audio/wav', duration, size: blob.size, blob,
    ...(speakerId ? { speakerId } : {}),
  };
}

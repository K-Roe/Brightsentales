/**
 * Minimal deterministic PCM WAV encoder/decoder.
 *
 * Rendered music and sound effects are stored as WAV so a composition can be
 * rendered byte-identically on demand. That determinism matters for the future
 * video exporter, which must mix the same audio again during export.
 */

export const WAV_MIME = 'audio/wav';
export const WAV_SAMPLE_RATE = 44100;

export type WavData = { sampleRate: number; channels: Float32Array[] };

/** Clamps a sample to the valid PCM range, so a loud mix cannot wrap around. */
export const clampSample = (value: number) => (value > 1 ? 1 : value < -1 ? -1 : Number.isFinite(value) ? value : 0);

export function encodeWav(channels: Float32Array[], sampleRate = WAV_SAMPLE_RATE): Uint8Array {
  const count = channels.length ? channels[0].length : 0;
  const channelCount = channels.length || 1;
  const bytes = new Uint8Array(44 + count * channelCount * 2);
  const view = new DataView(bytes.buffer);
  const writeText = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + count * channelCount * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);       // PCM chunk size
  view.setUint16(20, 1, true);        // PCM
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, count * channelCount * 2, true);
  let offset = 44;
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < channelCount; c++) {
      const sample = clampSample(channels[c][i]);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return bytes;
}

export const wavBlob = (channels: Float32Array[], sampleRate = WAV_SAMPLE_RATE) => {
  const bytes = encodeWav(channels, sampleRate);
  // Copy into a fresh ArrayBuffer so the Blob owns plain memory, never a view.
  return new Blob([bytes.slice().buffer], { type: WAV_MIME });
};

/** True when the bytes look like a PCM WAV file this app can decode. */
export function isWav(bytes: Uint8Array): boolean {
  if (bytes.length < 44) return false;
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  return tag(0) === 'RIFF' && tag(8) === 'WAVE' && tag(12) === 'fmt ' && tag(36) === 'data';
}

/** Decodes a PCM 8/16/24/32-bit WAV produced by this app or a typical recorder. */
export function decodeWav(bytes: Uint8Array): WavData | null {
  if (!isWav(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const channelCount = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bits = view.getUint16(34, true);
  if (!channelCount || channelCount > 2 || ![8, 16, 24, 32].includes(bits)) return null;
  const dataSize = view.getUint32(40, true);
  const frameSize = channelCount * (bits / 8);
  const count = Math.min(Math.floor(dataSize / frameSize), Math.floor((bytes.length - 44) / frameSize));
  const channels = Array.from({ length: channelCount }, () => new Float32Array(count));
  let offset = 44;
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < channelCount; c++) {
      let value: number;
      if (bits === 8) value = (bytes[offset] - 128) / 128;
      else if (bits === 16) value = view.getInt16(offset, true) / 32768;
      else if (bits === 24) { const raw = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16); value = (raw & 0x800000 ? raw - 0x1000000 : raw) / 8388608; }
      else value = view.getInt32(offset, true) / 2147483648;
      channels[c][i] = clampSample(value);
      offset += bits / 8;
    }
  }
  return { sampleRate, channels };
}

/** Interleaves to mono by averaging, used for waveform previews and analysis. */
export const toMono = (channels: Float32Array[]) => {
  const count = channels[0]?.length ?? 0;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (const channel of channels) sum += channel[i] ?? 0;
    out[i] = sum / channels.length;
  }
  return out;
};

/** Peak absolute level of a set of channels, used to prove audio is audible. */
export const peakLevel = (channels: Float32Array[]) => {
  let peak = 0;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) { const value = Math.abs(channel[i]); if (value > peak) peak = value; }
  return peak;
};
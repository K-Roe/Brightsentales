import type { VoiceEffect } from './voiceSettings';

export type InstalledVoice = { id: string; name: string; engine: 'Piper' | 'Kokoro'; language: string };
export type VoiceServiceStatus = { state: 'starting' | 'ready' | 'unavailable' | 'error'; detail: string };
export async function voiceServiceStatus(): Promise<VoiceServiceStatus> {
  let response: Response;
  try { response = await fetch('/voice-manager/status', { cache: 'no-store' }); }
  catch { throw new Error('BrightTales is not serving the voice engine. Close and reopen BrightTales.'); }
  if (!response.ok) throw new Error('BrightTales is not serving the voice engine. Close and reopen BrightTales.');
  const value = await response.json() as VoiceServiceStatus;
  if (!['starting', 'ready', 'unavailable', 'error'].includes(value.state) || typeof value.detail !== 'string') throw new Error('Voice service status could not be read.');
  return value;
}
export async function retryVoiceService(): Promise<void> {
  let response: Response;
  try { response = await fetch('/voice-manager/retry', { method: 'POST', headers: { 'X-BrightTales-Voice': '1' } }); }
  catch { throw new Error('Voice engine could not be restarted. Close and reopen BrightTales.'); }
  if (!response.ok) throw new Error('Voice engine could not be restarted. Close and reopen BrightTales.');
}
export async function localVoices(): Promise<InstalledVoice[]> {
  let response: Response;
  try { response = await fetch('/voice-api/voices'); }
  catch { throw new Error('Local Voice Maker service is unavailable. Select Retry voice engine.'); }
  if (!response.ok) throw new Error(await readableError(response, 'Local Voice Maker service is unavailable. Select Retry voice engine.'));
  const result = await response.json() as { voices?: InstalledVoice[] };
  if (!Array.isArray(result.voices)) throw new Error('Local Voice Maker returned an invalid voice list.');
  return result.voices;
}
const readableError = async (response: Response, fallback: string) => {
  try { const value = await response.json() as { error?: string }; return value.error || fallback; }
  catch { return fallback; }
};
const fromBase64 = (encoded: string) => {
  const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
  return new Blob([bytes], { type: 'audio/wav' });
};
const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
};
async function postVoice(path: string, body: object): Promise<Blob> {
  let response: Response;
  try { response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-BrightTales-Voice': '1' }, body: JSON.stringify(body) }); }
  catch { throw new Error('Local Voice Maker service is unavailable. Select Retry voice engine.'); }
  let result: { wav?: string; error?: string };
  try { result = await response.json() as { wav?: string; error?: string }; }
  catch { throw new Error(response.ok ? 'Voice processing failed.' : await readableError(response, 'Local Voice Maker service is unavailable. Select Retry voice engine.')); }
  if (!response.ok || typeof result.wav !== 'string') throw new Error(result.error ?? 'Voice processing failed.');
  return fromBase64(result.wav);
}
export const synthesizeVoice = (voice: string, text: string, speed: number) => postVoice('/voice-api/synthesize', { voice, text, speed });
export const processVoice = async (audio: Blob, options: VoiceEffect) => postVoice('/voice-api/process', { audio: await toBase64(audio), options });

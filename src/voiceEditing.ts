import type { VoiceEffect } from './voiceSettings';

export type TimeSelection = { start: number; end: number };

export function createRevisionGate() {
  let revision = 0;
  return { begin: () => ++revision, invalidate: () => ++revision, isCurrent: (ticket: number) => ticket === revision };
}

export function stopCapture(recorder: Pick<MediaRecorder, 'state' | 'stop'> | null, stream: Pick<MediaStream, 'getTracks'> | null): void {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  stream?.getTracks().forEach(track => track.stop());
}

export function clampSelection(start: number, end: number, duration: number): TimeSelection {
  const limit = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const left = Math.min(limit, Math.max(0, Number.isFinite(start) ? start : 0));
  const right = Math.min(limit, Math.max(0, Number.isFinite(end) ? end : limit));
  if (limit < .01) return { start: 0, end: limit };
  if (right - left >= .01) return { start: left, end: right };
  if (left + .01 <= limit) return { start: left, end: left + .01 };
  return { start: Math.max(0, limit - .01), end: limit };
}

export function timelineTime(clientX: number, left: number, width: number, duration: number): number {
  if (width <= 0 || duration <= 0) return 0;
  return Math.min(duration, Math.max(0, (clientX - left) / width * duration));
}

export function selectionForEffect(effect: VoiceEffect): TimeSelection {
  return { start: effect.trimStart, end: effect.trimEnd };
}

export function trimToSelection(effect: VoiceEffect, selection: TimeSelection, duration: number): VoiceEffect {
  const range = clampSelection(selection.start, selection.end, duration);
  return { ...effect, trimStart: range.start, trimEnd: range.end };
}

export function cutSelection(effect: VoiceEffect, selection: TimeSelection, duration: number): VoiceEffect {
  const range = clampSelection(selection.start, selection.end, duration);
  if (range.end - range.start < .01 || effect.cuts.length >= 20) return effect;
  return { ...effect, cuts: [...effect.cuts, [range.start, range.end]] };
}

export function recordingMimeType(isTypeSupported: (mime: string) => boolean): string {
  for (const mime of ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg']) {
    if (isTypeSupported(mime)) return mime;
  }
  return '';
}

export function recordedBlob(chunks: BlobPart[], mime: string): Blob {
  const blob = new Blob(chunks.filter(chunk => chunk instanceof Blob ? chunk.size > 0 : chunk instanceof ArrayBuffer ? chunk.byteLength > 0 : true), { type: mime });
  if (!blob.size) throw new Error('No audio was captured. Check your microphone and record again.');
  if (!blob.type) throw new Error('This browser did not provide a supported recording format.');
  return blob;
}

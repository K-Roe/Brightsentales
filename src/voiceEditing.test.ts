import { describe, expect, it, vi } from 'vitest';
import { clampSelection, createRevisionGate, cutSelection, recordedBlob, recordingMimeType, stopCapture, timelineTime, trimToSelection } from './voiceEditing';
import { naturalEffect, validVoiceEffect } from './voiceSettings';

describe('Voice Maker V2 editing and recording helpers', () => {
  it('clamps ranges and keeps a minimum selectable duration', () => {
    expect(clampSelection(-1, 99, 5)).toEqual({ start: 0, end: 5 });
    expect(clampSelection(4.999, 4.999, 5)).toEqual({ start: 4.99, end: 5 });
    expect(timelineTime(150, 100, 200, 10)).toBe(2.5);
    expect(timelineTime(50, 100, 0, 10)).toBe(0);
  });

  it('trims and cuts selected ranges on the original recording clock', () => {
    const original = naturalEffect(8);
    const trimmed = trimToSelection(original, { start: 1.25, end: 6.5 }, 8);
    expect(trimmed.trimStart).toBe(1.25);
    expect(trimmed.trimEnd).toBe(6.5);
    const cut = cutSelection(trimmed, { start: 2, end: 2.75 }, 8);
    expect(cut.cuts).toEqual([[2, 2.75]]);
    expect(original.cuts).toEqual([]);
    expect(validVoiceEffect({ ...cut, cuts: [[6, 2]] })).toBe(false);
  });

  it('chooses only supported recording encodings and rejects empty recordings', () => {
    expect(recordingMimeType(mime => mime === 'audio/ogg')).toBe('audio/ogg');
    expect(recordingMimeType(() => false)).toBe('');
    expect(() => recordedBlob([], 'audio/webm')).toThrow('No audio was captured');
    expect(() => recordedBlob([new Blob(['audio'])], '')).toThrow('supported recording format');
    expect(recordedBlob([new Blob(['audio'])], 'audio/webm').size).toBe(5);
  });

  it('stops the recorder once and releases every microphone track', () => {
    const stop = vi.fn();
    const trackStops = [vi.fn(), vi.fn()];
    stopCapture({ state: 'recording', stop }, { getTracks: () => trackStops.map(stopTrack => ({ stop: stopTrack }) as unknown as MediaStreamTrack) });
    stopCapture({ state: 'inactive', stop }, { getTracks: () => [] });
    expect(stop).toHaveBeenCalledTimes(1);
    trackStops.forEach(stopTrack => expect(stopTrack).toHaveBeenCalledTimes(1));
  });

  it('does not allow a stale processing response to win after edits or a newer request', () => {
    const gate = createRevisionGate();
    const first = gate.begin();
    const second = gate.begin();
    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
    gate.invalidate();
    expect(gate.isCurrent(second)).toBe(false);
  });
});

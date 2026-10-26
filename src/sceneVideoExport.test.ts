import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderTimelineVideo, validateVideoAudioReferences, verifyWebmBlob, videoFrameCount } from './sceneVideoExport';
import type { AudioAsset, AudioClip } from './audio';

const id = '11111111-1111-4111-8111-111111111111';
const clip: AudioClip = { id, assetId: id, start: 0, trimStart: 0, trimEnd: 1, volume: .8, fadeIn: 0, fadeOut: 0 };
const asset: AudioAsset = { id, name: 'cue.wav', kind: 'effect', mime: 'audio/wav', duration: 1, size: 4, blob: new Blob(['RIFF'], { type: 'audio/wav' }) };
const webmHeader = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]);
let mockEnvironment: ReturnType<typeof installExportEnvironment> | null = null;
afterEach(() => { mockEnvironment?.restore(); mockEnvironment = null; vi.unstubAllGlobals(); });

describe('episode WebM export safeguards', () => {
  it('computes bounded frame totals and keeps a sample at the exact ending time', () => {
    expect(videoFrameCount(1)).toBe(25);
    expect(videoFrameCount(2.5)).toBe(61);
    expect(() => videoFrameCount(0)).toThrow('between 0 and 3600');
    expect(() => videoFrameCount(3601)).toThrow('between 0 and 3600');
  });

  it('rejects missing, invalid and overrun audio references instead of dropping them', () => {
    expect(() => validateVideoAudioReferences(2, [clip], [])).toThrow('missing or empty');
    expect(() => validateVideoAudioReferences(2, [{ ...clip, trimEnd: 2 }], [asset])).toThrow('extends past its source');
    expect(() => validateVideoAudioReferences(2, [{ ...clip, volume: 4 }], [asset])).toThrow('invalid timing or volume');
    expect(() => validateVideoAudioReferences(2, [clip], [asset, asset])).toThrow('duplicate asset');
  });

  it('checks the encoded WebM container signature and DocType', async () => {
    await expect(verifyWebmBlob(new Blob([webmHeader], { type: 'video/webm;codecs=vp8,opus' }))).resolves.toBeUndefined();
    await expect(verifyWebmBlob(new Blob(['not video'], { type: 'video/webm' }))).rejects.toThrow('container header');
    await expect(verifyWebmBlob(new Blob([webmHeader], { type: 'video/mp4' }))).rejects.toThrow('instead of WebM');
  });

  it('honors cancellation before creating capture resources and reports validation stage', async () => {
    const abort = new AbortController(); abort.abort();
    const progress = vi.fn();
    await expect(renderTimelineVideo(1, () => undefined, [], [], progress, abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(progress).toHaveBeenCalledWith({ stage: 'validating' });
  });

  it('renders the exact final timestamp, reports frame progress and releases successful resources', async () => {
    mockEnvironment = installExportEnvironment();
    const times: number[] = []; const progress: string[] = [];
    const blob = await renderTimelineVideo(.08, (_context, time) => times.push(time), [], [], event => progress.push(event.stage));
    expect(times).toContain(.08);
    expect(progress).toEqual(expect.arrayContaining(['validating', 'preparing', 'rendering', 'encoding', 'finalising', 'complete']));
    expect(blob.size).toBeGreaterThan(0);
    expect(mockEnvironment.audioClosed()).toBe(true);
    expect(mockEnvironment.tracksStopped()).toBe(true);
  });

  it('surfaces audio decode failure and still releases the audio context and tracks', async () => {
    mockEnvironment = installExportEnvironment({ decodeFailure: true });
    await expect(renderTimelineVideo(.08, () => undefined, [clip], [asset], () => undefined)).rejects.toThrow('could not be decoded');
    expect(mockEnvironment.audioClosed()).toBe(true);
    expect(mockEnvironment.tracksStopped()).toBe(true);
  });

  it('cancels an active recording and cleans its streams', async () => {
    mockEnvironment = installExportEnvironment();
    const abort = new AbortController(); let cancelled = false;
    const pending = renderTimelineVideo(2, () => undefined, [], [], progress => {
      if (progress.stage === 'rendering' && progress.completedFrames === 1 && !cancelled) {
        cancelled = true; window.setTimeout(() => abort.abort(), 2);
      }
    }, abort.signal);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockEnvironment.audioClosed()).toBe(true);
    expect(mockEnvironment.tracksStopped()).toBe(true);
  });

  it('stops early and reports encoder errors rather than returning an incomplete file', async () => {
    mockEnvironment = installExportEnvironment({ encoderFailure: true });
    await expect(renderTimelineVideo(1, () => undefined, [], [], () => undefined)).rejects.toThrow('WebM encoding failed');
    expect(mockEnvironment.audioClosed()).toBe(true);
    expect(mockEnvironment.tracksStopped()).toBe(true);
  });
});

function installExportEnvironment(options: { decodeFailure?: boolean; encoderFailure?: boolean } = {}) {
  let audioClosed = false; let videoTrackCreated = false; let requestFrameCalls = 0;
  let recorder: MockRecorder | null = null;
  const track = { kind: 'video', stopped: false, stop() { this.stopped = true; }, requestFrame: () => {
    requestFrameCalls += 1;
    if (options.encoderFailure && recorder) window.setTimeout(() => recorder?.onerror?.({}), 0);
  } };
  const audioTrack = { kind: 'audio', stopped: false, stop() { this.stopped = true; } };
  class MockStream {
    constructor(private readonly tracks: any[]) {}
    getTracks() { return this.tracks; }
    getVideoTracks() { return this.tracks.filter(item => item.kind === 'video'); }
    getAudioTracks() { return this.tracks.filter(item => item.kind === 'audio'); }
  }
  class MockRecorder {
    static isTypeSupported() { return true; }
    state = 'inactive'; ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null; onstop: (() => void) | null = null;
    constructor(_stream: unknown, _config: unknown) { recorder = this; }
    start() { this.state = 'recording'; }
    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob([webmHeader]) }); this.onstop?.();
    }
  }
  class MockAudioContext {
    state = 'running'; currentTime = 0;
    createMediaStreamDestination() { return { stream: new MockStream([audioTrack]) }; }
    createDynamicsCompressor() { return { threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 }, connect: () => undefined, disconnect: () => undefined }; }
    async decodeAudioData() { if (options.decodeFailure) throw new Error('invalid'); return { duration: 1 }; }
    createBufferSource() { return { buffer: null as unknown, connect: (destination: unknown) => destination, start: () => undefined, stop: () => undefined }; }
    createGain() { return { gain: { setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined }, connect: () => undefined }; }
    async resume() { return; }
    async close() { audioClosed = true; this.state = 'closed'; }
  }
  const canvas = { width: 0, height: 0, getContext: () => ({}), captureStream: () => { videoTrackCreated = true; track.stopped = false; return new MockStream([track]); } };
  class FakeCanvasElement {}
  Object.defineProperty(FakeCanvasElement.prototype, 'captureStream', { value: () => undefined });
  const nextFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 1);
  const windowObject = { MediaRecorder: MockRecorder, setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis) };
  vi.stubGlobal('window', windowObject);
  vi.stubGlobal('document', { createElement: (tag: string) => tag === 'canvas' ? canvas : {} });
  vi.stubGlobal('HTMLCanvasElement', FakeCanvasElement);
  vi.stubGlobal('MediaStream', MockStream);
  vi.stubGlobal('MediaRecorder', MockRecorder);
  vi.stubGlobal('AudioContext', MockAudioContext);
  vi.stubGlobal('requestAnimationFrame', nextFrame);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  return { audioClosed: () => audioClosed, tracksStopped: () => audioTrack.stopped && (!videoTrackCreated || track.stopped), requestFrameCalls: () => requestFrameCalls, restore: () => undefined };
}

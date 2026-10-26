import type { AudioAsset, AudioClip } from './audio';
import { clipLength } from './audio';
import { HEIGHT, WIDTH } from './scene';
import { drawScenePreview, type PreviewPack } from './scenePreview';
import type { TimedScene } from './timedScenes';

export type VideoExportStage = 'validating' | 'preparing' | 'rendering' | 'encoding' | 'finalising' | 'complete';
export type VideoExportProgress = { stage: VideoExportStage; completedFrames?: number; totalFrames?: number };
export const VIDEO_EXPORT_FPS = 24;
export const MAX_EPISODE_EXPORT_SECONDS = 3600;

function abortError(): DOMException { return new DOMException('Export cancelled.', 'AbortError'); }
function checkAbort(signal?: AbortSignal): void { if (signal?.aborted) throw abortError(); }

/** Number of elapsed-time samples including an explicit final sample at the episode end. */
export function videoFrameCount(duration: number, fps = VIDEO_EXPORT_FPS): number {
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_EPISODE_EXPORT_SECONDS) throw new Error('Video must be between 0 and 3600 seconds.');
  if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error('Video frame rate is unsupported.');
  return Math.ceil(duration * fps) + 1;
}

export function validateVideoAudioReferences(duration: number, clips: AudioClip[], assets: AudioAsset[]): void {
  videoFrameCount(duration);
  if (clips.length > 200) throw new Error('Video export supports up to 200 audio clips.');
  const assetsById = new Map<string, AudioAsset>();
  for (const asset of assets) {
    if (assetsById.has(asset.id)) throw new Error(`Audio library contains a duplicate asset: ${asset.name || asset.id}.`);
    assetsById.set(asset.id, asset);
  }
  for (const clip of clips) {
    if (![clip.start, clip.trimStart, clip.trimEnd, clip.volume, clip.fadeIn, clip.fadeOut].every(Number.isFinite) ||
        clip.start < 0 || clip.trimStart < 0 || clip.trimEnd <= clip.trimStart || clip.volume < 0 || clip.volume > 1 || clip.fadeIn < 0 || clip.fadeOut < 0) {
      throw new Error('An episode audio cue has invalid timing or volume. Repair it before exporting.');
    }
    const asset = assetsById.get(clip.assetId);
    if (!asset || !asset.blob || asset.blob.size === 0) throw new Error(`Audio file for episode cue ${clip.assetId} is missing or empty.`);
    if (clip.trimEnd > asset.duration + .05) throw new Error(`Audio cue ${asset.name} extends past its source file.`);
    if (clip.start < duration && clipLength(clip) <= 0) throw new Error(`Audio cue ${asset.name} has no playable audio.`);
  }
}

/** Lightweight structural check; browser APIs do not expose the encoded WebM track table or finalized duration. */
export async function verifyWebmBlob(blob: Blob): Promise<void> {
  if (!blob.size) throw new Error('WebM encoder produced an empty file.');
  if (!/^video\/webm(?:;|$)/i.test(blob.type)) throw new Error(`The browser returned ${blob.type || 'an unknown format'} instead of WebM.`);
  const bytes = new Uint8Array(await blob.slice(0, Math.min(blob.size, 8192)).arrayBuffer());
  if (bytes.length < 8 || bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3)
    throw new Error('The encoded file is missing the WebM/EBML container header. Try exporting again in current Chrome or Edge.');
  let hasWebmDocType = false;
  for (let index = 4; index + 6 <= bytes.length; index++) {
    if (bytes[index] === 0x42 && bytes[index + 1] === 0x82) {
      const size = bytes[index + 2] & 0x7f;
      if (size > 0 && index + 3 + size <= bytes.length && new TextDecoder().decode(bytes.slice(index + 3, index + 3 + size)) === 'webm') {
        hasWebmDocType = true; break;
      }
    }
  }
  if (!hasWebmDocType) throw new Error('The encoded file does not identify itself as a WebM container. Try current Chrome or Edge.');
}

/** Shared canvas/audio recorder for scene and complete episode exports. */
export async function renderTimelineVideo(
  duration: number,
  draw: (context: CanvasRenderingContext2D, time: number) => void,
  clips: AudioClip[],
  assets: AudioAsset[],
  progress: (value: VideoExportProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const totalFrames = videoFrameCount(duration);
  progress({ stage: 'validating' });
  checkAbort(signal);
  validateVideoAudioReferences(duration, clips, assets);
  if (typeof window === 'undefined' || !window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)
    throw new Error('This browser cannot export video. Use a current version of Chrome or Edge.');
  if (typeof AudioContext === 'undefined') throw new Error('This browser cannot prepare audio for WebM. Use current Chrome or Edge; audio will not be removed.');

  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Scene drawing is unavailable. Close other graphics-heavy tabs and try again.');
  let audio: AudioContext;
  try { audio = new AudioContext(); }
  catch { throw new Error('The browser could not open its audio renderer. Check audio device access and retry; the soundtrack was not omitted.'); }
  let destination: MediaStreamAudioDestinationNode | null = null;
  let limiter: DynamicsCompressorNode | null = null;
  const sources: AudioBufferSourceNode[] = [];
  let frameRequest = 0;
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let finished: Promise<Blob> | null = null;
  let signalAbort: (() => void) | undefined;
  try {
    destination = audio.createMediaStreamDestination();
    limiter = audio.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.knee.value = 3; limiter.ratio.value = 12; limiter.attack.value = .003; limiter.release.value = .1;
    limiter.connect(destination);
    progress({ stage: 'preparing' });
    const loaded = new Map<string, AudioBuffer>();
    for (const clip of clips) {
      checkAbort(signal);
      if (clip.start >= duration) continue;
      const asset = assets.find(item => item.id === clip.assetId)!;
      if (!loaded.has(asset.id)) {
        try { loaded.set(asset.id, await audio.decodeAudioData(await asset.blob.arrayBuffer())); }
        catch { throw new Error(`Audio file ${asset.name} could not be decoded. Repair or replace it before exporting; audio was not omitted.`); }
      }
    }

    draw(context, 0);
    let manualCapture = false;
    let video: MediaStream;
    try {
      video = canvas.captureStream(0);
      const videoTrack = video.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
      manualCapture = !!videoTrack && typeof videoTrack.requestFrame === 'function';
      if (!manualCapture) { video.getTracks().forEach(track => track.stop()); video = canvas.captureStream(VIDEO_EXPORT_FPS); }
    } catch { video = canvas.captureStream(VIDEO_EXPORT_FPS); }
    stream = new MediaStream([...video.getVideoTracks(), ...destination.stream.getAudioTracks()]);
    if (!stream.getVideoTracks().length) throw new Error('The browser did not create a video track for this export.');
    if (!stream.getAudioTracks().length) throw new Error('The browser did not create an audio track. Export stopped instead of silently dropping audio.');
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(item => MediaRecorder.isTypeSupported(item));
    if (!mime) throw new Error('This browser cannot encode WebM with audio. Use current Chrome or Edge; audio will not be removed.');
    try { recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 }); }
    catch { throw new Error('The browser could not start its WebM encoder. Check codec support and available memory.'); }
    const chunks: BlobPart[] = [];
    finished = new Promise<Blob>((resolve, reject) => {
      let settled = false;
      recorder!.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder!.onerror = () => { if (!settled) { settled = true; reject(new Error('WebM encoding failed. Check free memory and browser codec support, then retry.')); } };
      recorder!.onstop = () => {
        if (settled) return;
        settled = true;
        if (!chunks.length) { reject(new Error('WebM encoder stopped without producing media data.')); return; }
        resolve(new Blob(chunks, { type: mime }));
      };
    });
    await audio.resume();
    checkAbort(signal);
    const startAt = audio.currentTime + .15;
    for (const clip of clips) {
      const buffer = loaded.get(clip.assetId);
      if (clip.start >= duration) continue;
      const asset = assets.find(item => item.id === clip.assetId)!;
      if (!buffer) throw new Error(`Audio cue ${asset.name} was not prepared for encoding.`);
      const length = Math.min(clipLength(clip), duration - clip.start, buffer.duration - clip.trimStart);
      if (length <= 0) throw new Error(`Audio cue ${asset.name} has no decodable audio in its selected trim range.`);
      const source = audio.createBufferSource(); source.buffer = buffer;
      const gain = audio.createGain(); source.connect(gain).connect(limiter!);
      const start = startAt + clip.start;
      const attack = Math.min(clip.fadeIn || .02, length / 3);
      const release = Math.min(clip.fadeOut || .02, length / 3);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(Math.min(.95, clip.volume), start + attack);
      gain.gain.setValueAtTime(Math.min(.95, clip.volume), start + length - release);
      gain.gain.linearRampToValueAtTime(0, start + length);
      source.start(start, clip.trimStart, length); sources.push(source);
    }

    progress({ stage: 'rendering', completedFrames: 0, totalFrames });
    recorder.start(250);
    const started = performance.now() + 150;
    await new Promise<void>((resolve, reject) => {
      const abort = () => { cancelAnimationFrame(frameRequest); window.clearTimeout(frameRequest); reject(abortError()); };
      signalAbort = abort;
      signal?.addEventListener('abort', abort, { once: true });
      let frameIndex = 0;
      const renderFrames = () => {
        if (signal?.aborted) { abort(); return; }
        const elapsed = Math.max(0, (performance.now() - started) / 1000);
        const finalIndex = totalFrames - 1;
        if (frameIndex <= finalIndex && elapsed + 1e-5 >= (frameIndex === finalIndex ? duration : frameIndex / VIDEO_EXPORT_FPS)) {
          const frameTime = frameIndex === finalIndex ? duration : Math.min(duration, frameIndex / VIDEO_EXPORT_FPS);
          draw(context, frameTime);
          if (manualCapture) (video.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack).requestFrame();
          frameIndex += 1;
          progress({ stage: 'rendering', completedFrames: frameIndex, totalFrames });
          if (frameIndex > finalIndex) {
            // Keep the exact-time ending frame in the stream for one encoder frame interval.
            frameRequest = window.setTimeout(resolve, Math.ceil(1000 / VIDEO_EXPORT_FPS)) as unknown as number;
            return;
          }
        }
        frameRequest = requestAnimationFrame(tick);
      };
      const tick = () => {
        if (finished) void finished.catch(error => { cancelAnimationFrame(frameRequest); reject(error); });
        renderFrames();
      };
      frameRequest = requestAnimationFrame(tick);
    });
    signal?.removeEventListener('abort', signalAbort!); signalAbort = undefined;
    checkAbort(signal);
    progress({ stage: 'encoding', completedFrames: totalFrames, totalFrames });
    recorder.stop();
    const blob = await finished;
    progress({ stage: 'finalising' });
    await verifyWebmBlob(blob);
    progress({ stage: 'complete', completedFrames: totalFrames, totalFrames });
    return blob;
  } finally {
    if (signalAbort) signal?.removeEventListener('abort', signalAbort);
    cancelAnimationFrame(frameRequest); window.clearTimeout(frameRequest);
    if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch { /* Recorder is already stopping. */ } }
    sources.forEach(source => { try { source.stop(); } catch { /* Already finished. */ } });
    const tracksToStop = new Set([...(stream?.getTracks() ?? []), ...(destination?.stream.getTracks() ?? [])]);
    tracksToStop.forEach(track => track.stop());
    limiter?.disconnect();
    if (audio.state !== 'closed') await audio.close();
  }
}

/** Scene-only WebM export using the same recorder as complete episodes. */
export async function renderSceneVideo(scene: TimedScene, room: HTMLImageElement, packs: Record<string, PreviewPack>, assets: AudioAsset[], progress: (value: VideoExportProgress) => void, signal?: AbortSignal): Promise<Blob> {
  if (scene.duration > 120) throw new Error('Scene video export is limited to 120 seconds in this version.');
  if (Object.keys(scene.characters).some(id => !packs[id])) throw new Error('A Brightling sprite is missing. Wait for the stage to load before exporting.');
  return renderTimelineVideo(scene.duration, (context, time) => drawScenePreview(context, scene, time, room, packs), scene.audio ?? [], assets, progress, signal);
}

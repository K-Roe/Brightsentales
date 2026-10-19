import type { AudioAsset, AudioClip } from './audio';
import { clipLength } from './audio';
import { HEIGHT, WIDTH } from './scene';
import { drawScenePreview, type PreviewPack } from './scenePreview';
import type { TimedScene } from './timedScenes';

/** Shared canvas/audio recorder for scene and complete episode exports. */
export async function renderTimelineVideo(duration: number, draw: (context: CanvasRenderingContext2D, time: number) => void, clips: AudioClip[], assets: AudioAsset[], progress: (value: number) => void): Promise<Blob> {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('This browser cannot export scene video. Try current Chrome or Edge.');
  if (!Number.isFinite(duration) || duration <= 0 || duration > 3600) throw new Error('Video must be between 0 and 3600 seconds.');
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Scene drawing is unavailable.');
  const audio = new AudioContext();
  const destination = audio.createMediaStreamDestination();
  const limiter = audio.createDynamicsCompressor();
  limiter.threshold.value = -6; limiter.knee.value = 3; limiter.ratio.value = 12; limiter.attack.value = .003; limiter.release.value = .1;
  limiter.connect(destination);
  const sources: AudioBufferSourceNode[] = [];
  let timer = 0;
  try {
    const loaded = new Map<string, AudioBuffer>();
    for (const clip of clips) {
      const asset = assets.find(item => item.id === clip.assetId);
      if (!asset) throw new Error(`Missing audio file for scene clip ${clip.assetId}.`);
      if (!loaded.has(asset.id)) loaded.set(asset.id, await audio.decodeAudioData(await asset.blob.arrayBuffer()));
    }
    draw(context, 0);
    const video = canvas.captureStream(24);
    const stream = new MediaStream([...video.getVideoTracks(), ...destination.stream.getAudioTracks()]);
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(item => MediaRecorder.isTypeSupported(item));
    if (!mime) throw new Error('This browser cannot encode WebM scene video.');
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    const chunks: BlobPart[] = [];
    const finished = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error('Scene video encoding failed.'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    });
    await audio.resume();
    const startAt = audio.currentTime + .15;
    for (const clip of clips) {
      const buffer = loaded.get(clip.assetId)!;
      const source = audio.createBufferSource(); source.buffer = buffer;
      const gain = audio.createGain(); source.connect(gain).connect(limiter);
      const length = Math.min(clipLength(clip), duration - clip.start, buffer.duration - clip.trimStart);
      if (length <= 0) continue;
      const start = startAt + clip.start;
      const attack = Math.min(clip.fadeIn || .02, length / 3);
      const release = Math.min(clip.fadeOut || .02, length / 3);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(Math.min(.95, clip.volume), start + attack);
      gain.gain.setValueAtTime(Math.min(.95, clip.volume), start + length - release);
      gain.gain.linearRampToValueAtTime(0, start + length);
      source.start(start, clip.trimStart, length); sources.push(source);
    }
    recorder.start(250);
    const started = performance.now() + 150;
    await new Promise<void>(resolve => {
      const tick = () => {
        const elapsed = Math.max(0, (performance.now() - started) / 1000);
        draw(context, Math.min(duration, elapsed));
        progress(Math.min(1, elapsed / duration));
        if (elapsed >= duration) resolve(); else timer = requestAnimationFrame(tick);
      };
      timer = requestAnimationFrame(tick);
    });
    recorder.stop();
    const blob = await finished;
    if (blob.size < 1000) throw new Error('Scene video was empty.');
    return blob;
  } finally {
    cancelAnimationFrame(timer);
    sources.forEach(source => { try { source.stop(); } catch { /* Already finished. */ } });
    await audio.close();
  }
}

/** Scene-only WebM export using the same recorder as complete episodes. */
export async function renderSceneVideo(scene: TimedScene, room: HTMLImageElement, packs: Record<string, PreviewPack>, assets: AudioAsset[], progress: (value: number) => void): Promise<Blob> {
  if (scene.duration > 120) throw new Error('Scene video export is limited to 120 seconds in this version.');
  if (Object.keys(scene.characters).some(id => !packs[id])) throw new Error('A Brightling sprite is missing. Wait for the stage to load before exporting.');
  return renderTimelineVideo(scene.duration, (context, time) => drawScenePreview(context, scene, time, room, packs), scene.audio ?? [], assets, progress);
}

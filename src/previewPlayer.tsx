import { useCallback, useEffect, useRef, useState } from 'react';
import type { MusicProject } from './musicProject';
import { renderMusic } from './musicRender';
import { wavBlob } from './wav';

type Props = { playing: boolean; onPlay: () => void; onStop: () => void; disabled?: boolean; canStop?: boolean; status?: string };

/** Large, friendly Play / Stop control shared by the Music Maker and Sound Effects Maker. */
export function PlayButton({ playing, onPlay, onStop, disabled, canStop = playing, status }: Props) {
  return <div className="music-play-buttons">
    <button className="music-play-main" onClick={onPlay} disabled={disabled} aria-pressed={playing}>
      <span className="music-play-icon" aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      {status === 'preparing' ? 'Preparing…' : status === 'paused' ? 'Resume' : playing ? 'Pause' : 'Play'}
    </button>
    <button className="music-stop-main" onClick={onStop} disabled={!canStop} aria-label="Stop playback">
      <span aria-hidden="true">■</span> Stop
    </button>
  </div>;
}

/**
 * Preview transport.
 *
 * The preview plays the exact rendered WAV that "Add to Audio Library" stores,
 * through an HTMLAudioElement. That is the same element type the existing audio
 * clock uses, so nothing here introduces a second, incompatible player.
 *
 * `position` only reads `currentTime` so the UI can draw a playhead. It does not
 * affect what is heard and does not touch the audio graph.
 */
export function useMusicPreview(project: MusicProject | null, onError: (message: string) => void) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState<'stopped' | 'preparing' | 'playing' | 'paused'>('stopped');
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const rafRef = useRef(0);
  const generation = useRef(0);

  const release = useCallback(() => {
    const element = elementRef.current;
    if (element) { element.pause(); element.removeAttribute('src'); elementRef.current = null; }
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
  }, []);

  const stop = useCallback(() => {
    generation.current++;
    release();
    setPlaying(false);
    setStatus('stopped');
    setPosition(0);
  }, [release]);

  const projectSignature = project ? JSON.stringify(project) : '';
  useEffect(() => { stop(); }, [projectSignature, stop]);

  useEffect(() => {
    if (!playing) return;
    // UI-only ticker for the playhead.
    const tick = () => {
      const element = elementRef.current;
      if (element) {
        setPosition(element.currentTime);
        setDuration(Number.isFinite(element.duration) ? element.duration : 0);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    release();
  }, [release]);

  const play = async () => {
    if (!project) return;
    if (elementRef.current && playing) {
      elementRef.current.pause();
      setPlaying(false);
      setStatus('paused');
      return;
    }
    if (elementRef.current && !playing) {
      try { await elementRef.current.play(); setPlaying(true); setStatus('playing'); }
      catch { onError('Playback was blocked. Press Play again after clicking the page.'); }
      return;
    }
    try {
      const ticket = ++generation.current;
      setStatus('preparing');
      const result = await renderMusic(project);
      if (ticket !== generation.current) return;
      const url = URL.createObjectURL(wavBlob(result.channels, result.sampleRate));
      const element = new Audio(url);
      element.loop = project.loop;
      elementRef.current = element;
      urlRef.current = url;
      setDuration(result.duration);
      element.onended = () => { release(); setPlaying(false); setStatus('stopped'); setPosition(0); };
      try { await element.play(); }
      catch { release(); setStatus('stopped'); onError('Playback was blocked. Press Play again after clicking the page.'); return; }
      setPlaying(true);
      setStatus('playing');
    } catch { setStatus('stopped'); onError('This song could not be previewed in this browser.'); }
  };

  return { playing, position, duration, status, play, stop };
}

/** Renders a short effect preview through the same element type. */
export async function playEffectPreview(render: () => Promise<{ channels: Float32Array[]; sampleRate: number }>) {
  const result = await render();
  const url = URL.createObjectURL(wavBlob(result.channels, result.sampleRate));
  const element = new Audio(url);
  element.onended = () => URL.revokeObjectURL(url);
  try { await element.play(); }
  catch { URL.revokeObjectURL(url); throw new Error('Playback was blocked. Press Preview again after clicking the page.'); }
  return element;
}

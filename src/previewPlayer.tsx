import type { MusicProject } from './musicProject';
import { renderMusic } from './musicRender';
import { wavBlob } from './wav';

type Props = { playing: boolean; onPlay: () => void; onStop: () => void; disabled?: boolean };

/** Play / Stop control shared by the Music Maker and the Sound Effects Maker. */
export function PlayButton({ playing, onPlay, onStop, disabled }: Props) {
  return <div className="music-play-buttons">
    <button className="play-button" onClick={onPlay} disabled={disabled}>{playing ? 'Playing…' : '▶ Play'}</button>
    <button className="reset-button" onClick={onStop} disabled={!playing}>■ Stop</button>
  </div>;
}

/**
 * Preview helper.
 *
 * The preview plays the exact same rendered WAV that "Add to Audio Library"
 * stores, through an HTMLAudioElement. That is the same element type the existing
 * audio clock uses, so nothing here introduces a second, incompatible player.
 */

export async function startMusicPreview(project: MusicProject, onEnded: () => void): Promise<HTMLAudioElement> {
  const result = await renderMusic(project);
  const url = URL.createObjectURL(wavBlob(result.channels, result.sampleRate));
  const element = new Audio(url);
  element.loop = project.loop;
  element.onended = () => { onEnded(); URL.revokeObjectURL(url); };
  try { await element.play(); }
  catch { URL.revokeObjectURL(url); throw new Error('Playback was blocked. Press Play again after clicking the page.'); }
  return element;
}
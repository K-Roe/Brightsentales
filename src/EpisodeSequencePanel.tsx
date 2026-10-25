import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { TimedLibrary } from './timedScenes';
import type { IntroLibrary } from './introductions';
import type { CreditsLibrary } from './credits';
import type { AudioAsset } from './audio';
import type { PlaybackClip } from './audioPlayback';
import { productionBlocks, type Episode } from './episodes';
import { episodeAudioSpan, episodeTimelineTicks, episodeTimelineWidth, type EpisodeZoom } from './episodeTimeline';

type Props = {
  episode: Episode;
  scenes: TimedLibrary;
  intros: IntroLibrary;
  credits: CreditsLibrary;
  time: number;
  total: number;
  playing: boolean;
  audioClips: PlaybackClip[];
  audioAssets: AudioAsset[];
  selected: number | null;
  selectedBoundary: number | null;
  onSelect: (index: number, start: number) => void;
  onBoundarySelect: (index: number, start: number) => void;
  onSeek: (time: number) => void;
  onReorder: (from: number, to: number) => void;
  placeName: (id: string) => string;
};
const clock = (time: number) => `${time.toFixed(1)}s`;

export default function EpisodeSequence({ episode, scenes, intros, credits, time, total, playing, audioClips, audioAssets, selected, selectedBoundary, onSelect, onBoundarySelect, onSeek, onReorder, placeName }: Props) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [zoom, setZoom] = useState<EpisodeZoom>(0);
  const scroll = useRef<HTMLDivElement>(null);
  const blocks = productionBlocks(episode, scenes, intros, credits);
  const sceneBlocks = blocks.filter(block => block.kind === 'scene');
  const active = blocks.find(block => time >= block.start && time < block.start + block.duration) ?? blocks.at(-1);
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    onReorder(from, to);
  };
  useEffect(() => {
    if (!playing || zoom === 0 || !scroll.current || total <= 0) return;
    const view = scroll.current;
    const marker = time / total * (view.scrollWidth - 2);
    if (marker > view.scrollLeft + view.clientWidth - 90 || marker < view.scrollLeft + 40)
      view.scrollLeft = Math.max(0, marker - view.clientWidth * .35);
  }, [playing, time, total, zoom]);
  const seekOnRuler = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(total, (event.clientX - rect.left) / rect.width * total)));
  };

  return <section className="episode-sequence" aria-label="Episode sequence editor">
    <div className="episode-section-heading"><div><h2>Scene sequence</h2><p>Drag scenes into order, or use the arrow buttons. Repeat a scene without changing its source.</p></div><strong>{clock(total)} total</strong></div>
    <div className="episode-cards">{episode.sceneIds.map((id, index) => {
      const item = scenes.scenes.find(candidate => candidate.id === id);
      const availableBefore = episode.sceneIds.slice(0, index).filter(candidate => scenes.scenes.some(scene => scene.id === candidate)).length;
      const block = item ? sceneBlocks[availableBefore] : undefined;
      return <article key={`${index}-${id}`} draggable onDragStart={event => { setDragging(index); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={event => { event.preventDefault(); const from = dragging ?? Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) reorder(from, index); setDragging(null); }} onDragEnd={() => setDragging(null)} className={`${selected === index ? 'selected' : ''} ${active?.kind === 'scene' && active.occurrenceIndex === index ? 'active' : ''}`}>
        <span className="episode-number">{index + 1}</span>
        <button className="episode-card-select" aria-label={`Select scene ${index + 1}: ${item?.name ?? 'Missing scene'}`} aria-pressed={selected === index} onClick={() => onSelect(index, block?.start ?? 0)}><strong>{item?.name ?? 'Missing scene'}</strong><small>{item ? `${placeName(item.placeId)} · ${clock(block?.duration ?? item.duration)}` : `Scene ID ${id} is unavailable`}</small></button>
        <div className="episode-card-actions">{index > 0 && block && <button className={selectedBoundary === index ? 'selected' : ''} aria-label={`Transition before scene ${index + 1}`} aria-pressed={selectedBoundary === index} onClick={() => onBoundarySelect(index, block.start)}>Transition</button>}<button aria-label={`Move scene ${index + 1} left`} disabled={index === 0} onClick={() => reorder(index, index - 1)}>←</button><button aria-label={`Move scene ${index + 1} right`} disabled={index === episode.sceneIds.length - 1} onClick={() => reorder(index, index + 1)}>→</button></div>
      </article>;
    })}</div>
    {episode.sceneIds.length === 0 && <p className="episode-empty">Choose a saved scene from the library to start the sequence.</p>}
    <div className="episode-timeline-head"><h3>Episode timeline</h3><div className="episode-timeline-tools"><a href="#episode-audio-editor">Edit audio</a><label>Zoom <select aria-label="Episode timeline zoom" value={zoom} onChange={event => setZoom(Number(event.target.value) as EpisodeZoom)}><option value={0}>Fit</option><option value={1}>1x</option><option value={2}>2x</option><option value={4}>4x</option></select></label><span>{clock(time)} / {clock(total)}</span></div></div>
    <div className="episode-timeline-scroll" ref={scroll}><div className="episode-timeline-content" style={{ width: episodeTimelineWidth(total, zoom) }}>
    <div className="episode-timeline-ruler" aria-label="Episode time ruler" onPointerDown={seekOnRuler}>{episodeTimelineTicks(total, zoom).map(tick => <span key={tick} style={{ left: `${total ? tick / total * 100 : 0}%` }}>{clock(tick)}</span>)}</div>
    <input className="episode-timeline-scrub" aria-label="Scrub episode timeline" type="range" min="0" max={total || 1} step="0.1" value={time} disabled={total <= 0} onChange={event => onSeek(Number(event.target.value))} />
    <div className="episode-timeline-track" aria-label="Episode timeline">
      {blocks.map(block => {
        const index = block.occurrenceIndex ?? null;
        return <button key={`${block.kind}-${block.index}-${block.scene.id}`} className={`${active?.index === block.index ? 'active' : ''} ${index !== null && selected === index ? 'selected' : ''}`} style={{ width: `${block.duration / Math.max(total, 1) * 100}%` }} onClick={() => { if (index !== null) onSelect(index, block.start); else onSelect(-1, block.start); }} title={`${block.scene.name}, ${clock(block.start)} to ${clock(block.start + block.duration)}`}><strong>{block.kind === 'scene' ? block.scene.name : block.kind === 'intro' ? 'Intro' : 'Credits'}</strong><small>{clock(block.duration)}</small></button>;
      })}
      {sceneBlocks.filter(block => block.occurrenceIndex && block.occurrenceIndex > 0).map(block => <button key={`boundary-${block.occurrenceIndex}`} className={`episode-boundary ${selectedBoundary === block.occurrenceIndex ? 'selected' : ''}`} style={{ left: `${block.start / Math.max(total, 1) * 100}%` }} aria-label={`Transition before scene ${block.occurrenceIndex! + 1}`} aria-pressed={selectedBoundary === block.occurrenceIndex} title={`Transition before scene ${block.occurrenceIndex! + 1}: ${episode.sceneSettings?.[block.occurrenceIndex!]?.transition ? 'Fade Through Black' : 'Hard Cut'}`} onClick={() => onBoundarySelect(block.occurrenceIndex!, block.start)}>◆</button>)}
      {total > 0 && <span className="episode-playhead" style={{ left: `${Math.min(100, Math.max(0, time / total * 100))}%` }} aria-hidden="true" />}
    </div>
    {audioClips.length > 0 && <div className="episode-audio-lanes" aria-label="Episode audio positions">{audioClips.map(clip => {
      const span = episodeAudioSpan(clip, total);
      if (!span) return null;
      const asset = audioAssets.find(item => item.id === clip.assetId);
      return <div className="episode-audio-row" key={clip.key}><span>{clip.source === 'episode' ? 'Episode' : 'Scene'} {asset?.kind === 'speech' ? 'voice' : asset?.kind ?? 'audio'}</span><button className={`episode-audio-clip ${asset?.kind ?? 'missing'}`} style={{ left: `${span.left}%`, width: `${span.width}%` }} title={`${asset?.name ?? 'Missing audio'} at ${clock(clip.start)}`} onClick={() => onSeek(clip.start)}>{asset?.name ?? 'Missing audio'}</button></div>;
    })}<span className="episode-audio-playhead" style={{ left: `${Math.min(100, Math.max(0, total ? time / total * 100 : 0))}%` }} aria-hidden="true" /></div>}
    </div></div>
  </section>;
}

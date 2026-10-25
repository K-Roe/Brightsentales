import { useState } from 'react';
import type { TimedLibrary } from './timedScenes';
import type { IntroLibrary } from './introductions';
import type { CreditsLibrary } from './credits';
import { productionBlocks, type Episode } from './episodes';
import { moveSceneOccurrence } from './episodeSequence';

type Props = {
  episode: Episode;
  scenes: TimedLibrary;
  intros: IntroLibrary;
  credits: CreditsLibrary;
  time: number;
  total: number;
  selected: number | null;
  onSelect: (index: number, start: number) => void;
  onReorder: (ids: string[], selected: number) => void;
  placeName: (id: string) => string;
};
const clock = (time: number) => `${time.toFixed(1)}s`;

export default function EpisodeSequence({ episode, scenes, intros, credits, time, total, selected, onSelect, onReorder, placeName }: Props) {
  const [dragging, setDragging] = useState<number | null>(null);
  const blocks = productionBlocks(episode, scenes, intros, credits);
  const offset = episode.introId && intros.intros.some(item => item.id === episode.introId) ? 1 : 0;
  const sceneBlocks = blocks.filter(block => block.kind === 'scene');
  const active = blocks.find(block => time >= block.start && time < block.start + block.scene.duration) ?? blocks.at(-1);
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    onReorder(moveSceneOccurrence(episode.sceneIds, from, to), to);
  };

  return <section className="episode-sequence" aria-label="Episode sequence editor">
    <div className="episode-section-heading"><div><h2>Scene sequence</h2><p>Drag scenes into order, or use the arrow buttons. Repeat a scene without changing its source.</p></div><strong>{clock(total)} total</strong></div>
    <div className="episode-cards">{episode.sceneIds.map((id, index) => {
      const item = scenes.scenes.find(candidate => candidate.id === id);
      const availableBefore = episode.sceneIds.slice(0, index).filter(candidate => scenes.scenes.some(scene => scene.id === candidate)).length;
      const block = item ? sceneBlocks[availableBefore] : undefined;
      return <article key={`${index}-${id}`} draggable onDragStart={event => { setDragging(index); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={event => { event.preventDefault(); const from = dragging ?? Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) reorder(from, index); setDragging(null); }} onDragEnd={() => setDragging(null)} className={`${selected === index ? 'selected' : ''} ${active?.kind === 'scene' && active.index === index + offset ? 'active' : ''}`}>
        <span className="episode-number">{index + 1}</span>
        <button className="episode-card-select" aria-label={`Select scene ${index + 1}: ${item?.name ?? 'Missing scene'}`} aria-pressed={selected === index} onClick={() => onSelect(index, block?.start ?? 0)}><strong>{item?.name ?? 'Missing scene'}</strong><small>{item ? `${placeName(item.placeId)} · ${clock(item.duration)}` : `Scene ID ${id} is unavailable`}</small></button>
        <div className="episode-card-actions"><button aria-label={`Move scene ${index + 1} left`} disabled={index === 0} onClick={() => reorder(index, index - 1)}>←</button><button aria-label={`Move scene ${index + 1} right`} disabled={index === episode.sceneIds.length - 1} onClick={() => reorder(index, index + 1)}>→</button></div>
      </article>;
    })}</div>
    {episode.sceneIds.length === 0 && <p className="episode-empty">Choose a saved scene from the library to start the sequence.</p>}
    <div className="episode-timeline-head"><h3>Episode timeline</h3><span>{clock(time)} / {clock(total)}</span></div>
    <div className="episode-timeline-ruler" aria-hidden="true"><span>0s</span><span>{clock(total / 4)}</span><span>{clock(total / 2)}</span><span>{clock(total * .75)}</span><span>{clock(total)}</span></div>
    <div className="episode-timeline-track" aria-label="Episode timeline">
      {blocks.map(block => {
        const index = block.kind === 'scene' ? block.index - offset : null;
        return <button key={`${block.kind}-${block.index}-${block.scene.id}`} className={`${active?.index === block.index ? 'active' : ''} ${index !== null && selected === index ? 'selected' : ''}`} style={{ width: `${block.scene.duration / Math.max(total, 1) * 100}%` }} onClick={() => { if (index !== null) onSelect(index, block.start); else onSelect(-1, block.start); }} title={`${block.scene.name}, ${clock(block.start)} to ${clock(block.start + block.scene.duration)}`}><strong>{block.kind === 'scene' ? block.scene.name : block.kind === 'intro' ? 'Intro' : 'Credits'}</strong><small>{clock(block.scene.duration)}</small></button>;
      })}
      {total > 0 && <span className="episode-playhead" style={{ left: `${Math.min(100, Math.max(0, time / total * 100))}%` }} aria-hidden="true" />}
    </div>
  </section>;
}

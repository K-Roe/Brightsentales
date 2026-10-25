import { productionBlocks, type Episode } from './episodes';
import type { TimedLibrary } from './timedScenes';
import type { IntroLibrary } from './introductions';
import type { CreditsLibrary } from './credits';
import { duplicateEpisodeOccurrence, moveEpisodeOccurrence, removeEpisodeOccurrence, updateEpisodeOccurrence } from './episodeSequence';

type Props = {
  episode: Episode;
  scenes: TimedLibrary;
  intros: IntroLibrary;
  credits: CreditsLibrary;
  selectedScene: number | null;
  selectedBoundary: number | null;
  onChange: (next: Episode) => void;
  onSelectScene: (index: number | null) => void;
  onEditSource: (id: string) => void;
};
const clock = (time: number) => `${time.toFixed(1)}s`;

export default function EpisodeInspector({ episode, scenes, intros, credits, selectedScene, selectedBoundary, onChange, onSelectScene, onEditSource }: Props) {
  const blocks = productionBlocks(episode, scenes, intros, credits);
  const sceneBlock = blocks.find(block => block.kind === 'scene' && block.occurrenceIndex === selectedScene);
  const incoming = blocks.find(block => block.kind === 'scene' && block.occurrenceIndex === selectedBoundary);
  const outgoing = blocks.find(block => block.kind === 'scene' && block.occurrenceIndex === (selectedBoundary ?? 0) - 1);
  const transition = selectedBoundary === null ? undefined : episode.sceneSettings?.[selectedBoundary]?.transition;
  const maximumFade = Math.min(2, incoming?.duration ?? 0, outgoing?.duration ?? 0);

  return <section className="episode-inspector" aria-label="Episode properties">
    <h2>{selectedBoundary !== null ? 'Transition properties' : 'Scene properties'}</h2>
    {selectedBoundary !== null && incoming && outgoing ? <>
      <p className="episode-inspector-kicker">Boundary before scene {selectedBoundary + 1}</p>
      <h3>{outgoing.scene.name} → {incoming.scene.name}</h3>
      <label className="episode-timing-field">Transition
        <select aria-label="Episode transition" value={transition?.type ?? 'cut'} onChange={event => onChange(updateEpisodeOccurrence(episode, selectedBoundary, { transition: event.target.value === 'fade-black' ? { type: 'fade-black', duration: Math.min(.6, maximumFade) } : undefined }))}>
          <option value="cut">Hard Cut</option><option value="fade-black">Fade Through Black</option>
        </select>
      </label>
      {transition && <label className="episode-timing-field">Fade duration (seconds)
        <input aria-label="Fade duration" type="number" min="0.2" max={maximumFade} step="0.1" value={transition.duration} onChange={event => { const duration = Number(event.target.value); if (duration >= .2 && duration <= maximumFade) onChange(updateEpisodeOccurrence(episode, selectedBoundary, { transition: { type: 'fade-black', duration } })); }} />
        <small>0.2–{clock(maximumFade)}. Half fades out before the cut; half fades in after it.</small>
      </label>}
      <p className="episode-transition-hint">Episode music stays continuous. Scene audio changes at the scene boundary.</p>
    </> : sceneBlock && selectedScene !== null ? <>
      <p className="episode-inspector-kicker">Occurrence {selectedScene + 1} of {episode.sceneIds.length}</p>
      <h3>{sceneBlock.scene.name}</h3>
      <dl><div><dt>Starts</dt><dd>{clock(sceneBlock.start)}</dd></div><div><dt>Ends</dt><dd>{clock(sceneBlock.start + sceneBlock.duration)}</dd></div></dl>
      <label className="episode-timing-field">Episode duration (seconds)
        <input aria-label="Episode scene duration" type="number" min="0.2" max="3600" step="0.1" value={sceneBlock.duration} onChange={event => { const duration = Number(event.target.value); if (duration >= .2 && duration <= 3600) onChange(updateEpisodeOccurrence(episode, selectedScene, { duration })); }} />
        <small>Source scene: {clock(sceneBlock.scene.duration)}. Shorter clips stop early; longer clips hold the last pose.</small>
      </label>
      <button onClick={() => onChange(updateEpisodeOccurrence(episode, selectedScene, { duration: undefined }))} disabled={episode.sceneSettings?.[selectedScene]?.duration === undefined}>Use source duration</button>
      <div className="episode-inspector-actions"><button disabled={selectedScene === 0} onClick={() => { onChange(moveEpisodeOccurrence(episode, selectedScene, selectedScene - 1)); onSelectScene(selectedScene - 1); }}>Move earlier</button><button disabled={selectedScene === episode.sceneIds.length - 1} onClick={() => { onChange(moveEpisodeOccurrence(episode, selectedScene, selectedScene + 1)); onSelectScene(selectedScene + 1); }}>Move later</button><button onClick={() => { onChange(duplicateEpisodeOccurrence(episode, selectedScene)); onSelectScene(selectedScene + 1); }}>Duplicate in episode</button><button onClick={() => { onChange(removeEpisodeOccurrence(episode, selectedScene)); onSelectScene(null); }}>Remove from episode</button><button onClick={() => onEditSource(sceneBlock.scene.id)}>Edit source scene</button></div>
    </> : selectedScene !== null ? <><p role="alert">This saved scene is missing. Restore it from a backup or remove this occurrence.</p><button onClick={() => { onChange(removeEpisodeOccurrence(episode, selectedScene)); onSelectScene(null); }}>Remove missing scene</button></> : <p>Select a scene or a transition marker in the timeline to edit its episode settings.</p>}
  </section>;
}

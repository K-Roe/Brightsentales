import { productionBlocks, productionDuration, type Episode, type EpisodeCameraShot } from './episodes';
import type { TimedLibrary } from './timedScenes';
import type { IntroLibrary } from './introductions';
import type { CreditsLibrary } from './credits';
import { duplicateEpisodeOccurrence, moveEpisodeOccurrence, removeEpisodeOccurrence, updateEpisodeOccurrence } from './episodeSequence';
import { cameraMovementName, cameraShotName, episodeCameraIssue, episodeCameraTargets, removeEpisodeCameraShot, updateEpisodeCameraShot } from './episodeCamera';

type Props = {
  episode: Episode;
  scenes: TimedLibrary;
  intros: IntroLibrary;
  credits: CreditsLibrary;
  selectedScene: number | null;
  selectedBoundary: number | null;
  selectedCamera: string | null;
  onChange: (next: Episode) => void;
  onSelectScene: (index: number | null) => void;
  onSelectCamera: (id: string | null) => void;
  onEditSource: (id: string) => void;
  onPreviewTransition: (start: number, duration: number) => void;
};
const clock = (time: number) => `${time.toFixed(1)}s`;

export default function EpisodeInspector({ episode, scenes, intros, credits, selectedScene, selectedBoundary, selectedCamera, onChange, onSelectScene, onSelectCamera, onEditSource, onPreviewTransition }: Props) {
  const blocks = productionBlocks(episode, scenes, intros, credits);
  const sceneBlock = blocks.find(block => block.kind === 'scene' && block.occurrenceIndex === selectedScene);
  const incoming = blocks.find(block => block.kind === 'scene' && block.occurrenceIndex === selectedBoundary);
  const outgoing = blocks.find(block => block.kind === 'scene' && block.occurrenceIndex === (selectedBoundary ?? 0) - 1);
  const transition = selectedBoundary === null ? undefined : episode.sceneSettings?.[selectedBoundary]?.transition;
  const maximumFade = Math.min(2, incoming?.duration ?? 0, outgoing?.duration ?? 0);
  const minimumDuration = selectedScene === null ? .2 : Math.max(.2, episode.sceneSettings?.[selectedScene]?.transition?.duration ?? 0, episode.sceneSettings?.[selectedScene + 1]?.transition?.duration ?? 0);
  const nudgeDuration = (delta: number) => {
    if (!sceneBlock || selectedScene === null) return;
    const duration = Math.min(3600, Math.max(minimumDuration, Math.round((sceneBlock.duration + delta) * 10) / 10));
    if (duration !== sceneBlock.duration) onChange(updateEpisodeOccurrence(episode, selectedScene, { duration }));
  };
  const total = productionDuration(episode, scenes, intros, credits);
  const camera = episode.camera?.find(shot => shot.id === selectedCamera) ?? null;
  const targets = episodeCameraTargets(episode, scenes);
  const cameraError = episodeCameraIssue(episode, scenes, total);
  const editCamera = (patch: Partial<EpisodeCameraShot>) => { if (camera) onChange(updateEpisodeCameraShot(episode, camera.id, patch)); };
  const changeShot = (shot: EpisodeCameraShot['shot']) => {
    if (!camera) return;
    if (shot === 'wide') editCamera({ shot, target: 'point', x: camera.x ?? 836, y: camera.y ?? 470, zoom: undefined, movement: camera.movement === 'follow' ? 'static' : camera.movement });
    else editCamera({ shot, ...(shot === 'custom' ? { zoom: camera.zoom ?? 2 } : { zoom: undefined }) });
  };
  const changeTarget = (target: string) => {
    if (!camera) return;
    if (target === 'point') editCamera({ target, x: camera.x ?? 836, y: camera.y ?? 470, movement: camera.movement === 'follow' ? 'static' : camera.movement });
    else editCamera({ target, x: undefined, y: undefined });
  };
  const changeMovement = (movement: EpisodeCameraShot['movement']) => {
    if (!camera) return;
    if (movement === 'follow' && (camera.shot === 'wide' || camera.target === 'point')) editCamera({ movement, shot: camera.shot === 'wide' ? 'medium' : camera.shot, target: camera.target === 'point' ? targets[0]?.id ?? 'point' : camera.target, x: undefined, y: undefined });
    else editCamera({ movement });
  };

  return <section className="episode-inspector" aria-label="Episode properties">
    <h2>{selectedCamera !== null ? 'Camera shot' : selectedBoundary !== null ? 'Transition properties' : 'Scene properties'}</h2>
    {camera ? <>
      <p className="episode-inspector-kicker">Camera {cameraShotName(camera.shot)} · starts {clock(camera.start)}</p>
      <h3>{camera.target === 'point' ? 'Fixed position' : targets.find(target => target.id === camera.target)?.name ?? camera.target}</h3>
      <label className="episode-timing-field">Shot
        <select aria-label="Episode camera shot" value={camera.shot} onChange={event => changeShot(event.target.value as EpisodeCameraShot['shot'])}><option value="wide">Wide Shot</option><option value="medium">Medium Shot</option><option value="close-up">Close-Up</option><option value="custom">Custom Shot</option></select>
        <small>{camera.shot === 'wide' ? 'Shows the whole Living Room.' : camera.shot === 'medium' ? 'Frames the Brightling with some room around them.' : camera.shot === 'close-up' ? 'Frames the Brightling closely.' : 'Manual framing with your own zoom.'}</small>
      </label>
      {camera.shot !== 'wide' && <label className="episode-timing-field">Target
        <select aria-label="Episode camera target" value={camera.target} onChange={event => changeTarget(event.target.value)}>{targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}<option value="point">Fixed position</option></select>
        <small>Only Brightlings in this episode are listed. A missing target is never replaced automatically.</small>
      </label>}
      {camera.shot !== 'wide' && camera.target === 'point' && <div className="episode-camera-point"><label>Position X<input aria-label="Camera position X" type="number" min="0" max="1672" step="10" value={camera.x ?? 836} onChange={event => editCamera({ x: Math.max(0, Math.min(1672, Number(event.target.value))) })} /></label><label>Position Y<input aria-label="Camera position Y" type="number" min="0" max="941" step="10" value={camera.y ?? 470} onChange={event => editCamera({ y: Math.max(0, Math.min(941, Number(event.target.value))) })} /></label></div>}
      {camera.shot === 'custom' && camera.target !== 'point' && <label className="episode-timing-field">Zoom<input aria-label="Camera zoom" type="number" min="1" max="4" step="0.1" value={camera.zoom ?? 2} onChange={event => editCamera({ zoom: Math.max(1, Math.min(4, Number(event.target.value))) })} /><small>1x shows more room. 4x is the tightest framing.</small></label>}
      <label className="episode-timing-field">Movement
        <select aria-label="Episode camera movement" value={camera.movement} onChange={event => changeMovement(event.target.value as EpisodeCameraShot['movement'])}><option value="static">Static</option><option value="pan">Pan</option><option value="follow">Follow</option></select>
        <small>{camera.movement === 'static' ? 'The camera stays on this shot.' : camera.movement === 'pan' ? 'The camera glides here from the previous shot.' : 'The camera keeps tracking this Brightling.'}</small>
      </label>
      <div className="episode-camera-timing"><label>Start (seconds)<input aria-label="Camera start time" type="number" min="0" max={Math.max(0, total - .5)} step="0.1" value={camera.start} onChange={event => editCamera({ start: Math.max(0, Math.min(total - .5, Number(event.target.value))) })} /></label><label>Duration (seconds)<input aria-label="Camera shot duration" type="number" min="0.5" max={Math.max(.5, total - camera.start)} step="0.1" value={camera.duration} onChange={event => editCamera({ duration: Math.max(.5, Math.min(total - camera.start, Number(event.target.value))) })} /></label></div>
      <div className="episode-camera-preview"><span>{cameraMovementName(camera.movement)}</span><strong>{cameraShotName(camera.shot)}</strong><span>{clock(camera.start)}–{clock(camera.start + camera.duration)}</span></div>
      {cameraError && <p role="alert" className="episode-warning">{cameraError}</p>}
      <div className="episode-inspector-actions"><button onClick={() => { onChange(removeEpisodeCameraShot(episode, camera.id)); onSelectCamera(null); }}>Remove camera shot</button></div>
    </> : selectedBoundary !== null && incoming && outgoing ? <>
      <p className="episode-inspector-kicker">Boundary before scene {selectedBoundary + 1}</p>
      <h3>{outgoing.scene.name} → {incoming.scene.name}</h3>
      <label className="episode-timing-field">Transition
        <select aria-label="Episode transition" value={transition?.type ?? 'cut'} onChange={event => onChange(updateEpisodeOccurrence(episode, selectedBoundary, { transition: event.target.value === 'fade-black' ? { type: 'fade-black', duration: Math.min(.6, maximumFade) } : undefined }))}>
          <option value="cut">Hard Cut</option><option value="fade-black" disabled={maximumFade < .2}>Fade Through Black</option>
        </select>
      </label>
      {transition && <label className="episode-timing-field">Fade duration (seconds)
        <input aria-label="Fade duration" type="number" min="0.2" max={maximumFade} step="0.1" value={transition.duration} onChange={event => { const duration = Number(event.target.value); if (duration >= .2 && duration <= maximumFade) onChange(updateEpisodeOccurrence(episode, selectedBoundary, { transition: { type: 'fade-black', duration } })); }} />
        <small>0.2–{clock(maximumFade)}. Half fades out before the cut; half fades in after it.</small>
      </label>}
      <div className="episode-transition-preview"><span>{outgoing.scene.name}</span><strong>{transition ? `Fade ${clock(transition.duration)}` : 'Cut'}</strong><span>{incoming.scene.name}</span></div>
      <button onClick={() => onPreviewTransition(incoming.start, transition?.duration ?? .6)}>Play across boundary</button>
      <p className="episode-transition-hint">Episode music stays continuous. Scene audio changes at the scene boundary.</p>
    </> : sceneBlock && selectedScene !== null ? <>
      <p className="episode-inspector-kicker">Occurrence {selectedScene + 1} of {episode.sceneIds.length}</p>
      <h3>{sceneBlock.scene.name}</h3>
      <dl><div><dt>Starts</dt><dd>{clock(sceneBlock.start)}</dd></div><div><dt>Ends</dt><dd>{clock(sceneBlock.start + sceneBlock.duration)}</dd></div></dl>
      <label className="episode-timing-field">Episode duration (seconds)
        <input aria-label="Episode scene duration" type="number" min={minimumDuration} max="3600" step="0.1" value={sceneBlock.duration} onChange={event => { const duration = Number(event.target.value); if (duration >= minimumDuration && duration <= 3600) onChange(updateEpisodeOccurrence(episode, selectedScene, { duration })); }} />
        <small>Source scene: {clock(sceneBlock.scene.duration)}. Shorter clips stop early; longer clips hold the last pose.</small>
      </label>
      <div className="episode-duration-steps"><button aria-label="Shorten occurrence by half a second" disabled={sceneBlock.duration <= minimumDuration} onClick={() => nudgeDuration(-.5)}>-0.5s</button><button aria-label="Lengthen occurrence by half a second" disabled={sceneBlock.duration >= 3600} onClick={() => nudgeDuration(.5)}>+0.5s</button></div>
      <button onClick={() => onChange(updateEpisodeOccurrence(episode, selectedScene, { duration: undefined }))} disabled={episode.sceneSettings?.[selectedScene]?.duration === undefined}>Use source duration</button>
      <div className="episode-inspector-actions"><button disabled={selectedScene === 0} onClick={() => { onChange(moveEpisodeOccurrence(episode, selectedScene, selectedScene - 1)); onSelectScene(selectedScene - 1); }}>Move earlier</button><button disabled={selectedScene === episode.sceneIds.length - 1} onClick={() => { onChange(moveEpisodeOccurrence(episode, selectedScene, selectedScene + 1)); onSelectScene(selectedScene + 1); }}>Move later</button><button onClick={() => { onChange(duplicateEpisodeOccurrence(episode, selectedScene)); onSelectScene(selectedScene + 1); }}>Duplicate in episode</button><button onClick={() => { onChange(removeEpisodeOccurrence(episode, selectedScene)); onSelectScene(null); }}>Remove from episode</button><button onClick={() => onEditSource(sceneBlock.scene.id)}>Edit source scene</button></div>
    </> : selectedScene !== null ? <><p role="alert">This saved scene is missing. Restore it from a backup or remove this occurrence.</p><button onClick={() => { onChange(removeEpisodeOccurrence(episode, selectedScene)); onSelectScene(null); }}>Remove missing scene</button></> : <><p>Select a scene, transition marker or camera shot in the timeline to edit it here.</p><p className="episode-transition-hint">Camera shots direct the whole episode. If an episode has no camera shots, each saved scene keeps its own camera keyframes.</p></>}
  </section>;
}

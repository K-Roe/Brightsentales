import { useEffect, useRef, useState } from 'react';
import type { Brightling } from './maker';
import { advanceSceneTime, type TimedLibrary } from './timedScenes';
import { HEIGHT, WIDTH } from './scene';
import { placesIn, type PlaceOrganisation } from './placeFolders';
import { type MaxOutfit, type MaxineOutfit } from './outfit';
import { drawScenePreview, previewPack, type PreviewPack } from './scenePreview';
import { episodeDuration, episodePosition, missingSceneIds, type Episode, type EpisodeLibrary } from './episodes';

type Props = { library: EpisodeLibrary; scenes: TimedLibrary; characters: Brightling[]; places: PlaceOrganisation; maxOutfit: MaxOutfit; maxineOutfit: MaxineOutfit; issue: string | null; onSave: (next: EpisodeLibrary) => boolean; onEditScene: (id: string) => void };
const clock = (time: number) => `${time.toFixed(1)}s`;

export default function EpisodeMaker({ library, scenes, characters, places, maxOutfit, maxineOutfit, issue, onSave, onEditScene }: Props) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('Choose an episode or create one.');
  const [room, setRoom] = useState<HTMLImageElement | null>(null);
  const [packs, setPacks] = useState<Record<string, PreviewPack>>({});
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef(0);
  const total = episode ? episodeDuration(episode, scenes) : 0;
  const missing = episode ? missingSceneIds(episode, scenes) : [];
  const position = episode && missing.length === 0 ? episodePosition(episode, scenes, time) : null;
  const scene = position?.scene;
  const placeName = (id: string) => placesIn(places).find(place => place.id === id)?.name ?? 'Place unavailable';
  const readyPlace = scene && placesIn(places).find(place => place.id === scene.placeId && place.artworkAvailable && place.background);
  const open = (item: Episode) => { setEpisode(structuredClone(item)); setTime(0); setPlaying(false); setMessage('Add scenes from the library, then press Play.'); };
  const change = (next: Episode) => { setPlaying(false); setEpisode(next); setTime(Math.min(time, episodeDuration(next, scenes))); };
  const save = () => {
    if (!episode || issue) return;
    const next = { version: 1 as const, episodes: library.episodes.some(item => item.id === episode.id) ? library.episodes.map(item => item.id === episode.id ? episode : item) : [...library.episodes, episode] };
    setMessage(onSave(next) ? 'Episode saved in this browser.' : 'Episode could not be saved. Existing episodes were kept.');
  };

  useEffect(() => {
    if (!readyPlace?.background) { setRoom(null); return; }
    let live = true;
    const image = new Image();
    image.onload = () => { if (live) setRoom(image); };
    image.onerror = () => { if (live) { setRoom(null); setMessage('Scene background could not load.'); } };
    setRoom(null); image.src = readyPlace.background;
    return () => { live = false; };
  }, [readyPlace?.background]);

  useEffect(() => {
    if (!scene) { setPacks({}); return; }
    let live = true;
    setPacks({});
    Promise.all(Object.keys(scene.characters).map(async id => [id, await previewPack(id, characters, maxOutfit, maxineOutfit)] as const))
      .then(entries => { if (live) setPacks(Object.fromEntries(entries.filter((entry): entry is readonly [string, PreviewPack] => entry[1] !== null))); })
      .catch(() => { if (live) setMessage('A Brightling sprite could not load.'); });
    return () => { live = false; };
  }, [scene?.id, characters, maxOutfit, maxineOutfit]);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    if (scene && room) drawScenePreview(context, scene, position!.localTime, room, packs);
  }, [scene, room, packs, position?.localTime]);

  useEffect(() => {
    if (!playing || !episode || missing.length || total <= 0) return;
    let frame = 0;
    last.current = 0;
    const tick = (now: number) => {
      const elapsed = last.current ? (now - last.current) / 1000 : 0;
      last.current = now;
      if (elapsed > 0) setTime(value => { const next = advanceSceneTime(value, elapsed, total); if (next >= total) setPlaying(false); return next; });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, episode?.id, total, missing.length]);

  return <section className="episode-maker scene-maker">
    {!episode ? <><div className="scene-heading"><div><p className="eyebrow">EPISODE LIBRARY</p><h1>Your episodes</h1><p>Put saved scenes together and watch the whole cartoon.</p></div><button className="scene-primary" disabled={!!issue} onClick={() => open({ id: crypto.randomUUID(), name: 'My Episode', sceneIds: [] })}>Create Episode</button></div>
      {issue && <p role="alert" className="storage-alert">{issue}</p>}
      <div className="scene-library">{library.episodes.map(item => <article key={item.id}><h2>{item.name}</h2><p>{item.sceneIds.length} scenes · {clock(episodeDuration(item, scenes))}</p>{missingSceneIds(item, scenes).length > 0 && <p role="alert" className="episode-warning">Missing saved scene. Open to repair the sequence.</p>}<div className="scene-actions"><button onClick={() => open(item)}>Open</button><button onClick={() => { open({ ...item, id: crypto.randomUUID(), name: `${item.name} copy` }); setMessage('Duplicate opened. Save to keep it.'); }}>Duplicate</button><button onClick={() => { if (window.confirm(`Delete “${item.name}”? The saved scenes will stay in your library.`)) setMessage(onSave({ version: 1, episodes: library.episodes.filter(other => other.id !== item.id) }) ? 'Episode deleted. Its scenes were kept.' : 'Episode could not be deleted.'); }}>Delete</button></div></article>)}</div>
      {library.episodes.length === 0 && <p className="scene-empty">No episodes yet. Create one to add your saved scenes.</p>}
    </> : <><div className="scene-heading"><div><p className="eyebrow">EPISODE EDITOR</p><h1>{episode.name}</h1><p>{episode.sceneIds.length} scenes · Total duration <strong>{clock(total)}</strong></p></div><div className="scene-actions"><button onClick={() => { setEpisode(null); setPlaying(false); }}>Back to Episodes</button><button className="scene-primary" onClick={save} disabled={!!issue}>Save Episode</button></div></div>
      <label className="episode-name">Episode name<input aria-label="Episode name" maxLength={80} value={episode.name} onChange={event => change({ ...episode, name: event.target.value })} /></label>
      {missing.length > 0 && <p role="alert" className="episode-warning">This episode refers to {missing.length} missing scene{missing.length === 1 ? '' : 's'}. Playback is paused until you remove the missing block or restore the scene from a backup.</p>}
      <div className="episode-workspace"><div className="episode-main"><section className="scene-stage episode-preview"><div className="scene-stage-caption"><strong>{scene ? scene.name : 'EPISODE PREVIEW'}</strong><span>{scene ? `${placeName(scene.placeId)} · Scene ${position!.index + 1} of ${episode.sceneIds.length} · ${clock(position!.localTime)} / ${clock(scene.duration)}` : 'Add a saved scene to start'}</span></div><canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label="Episode cartoon preview" />
        <div className="scene-playback"><button onClick={() => { setPlaying(false); setTime(0); }}>Restart</button><button className="scene-primary" disabled={!!missing.length || total <= 0 || !readyPlace || !room || Object.keys(scene?.characters ?? {}).some(id => !packs[id])} onClick={() => { if (time >= total) setTime(0); setPlaying(!playing); }}>{playing ? 'Pause' : 'Play'}</button><input aria-label="Episode time" type="range" min="0" max={total || 1} step="0.1" value={time} disabled={total <= 0 || !!missing.length} onChange={event => { setPlaying(false); setTime(Number(event.target.value)); }} /><strong>{clock(time)} / {clock(total)}</strong></div></section>
        <section className="episode-sequence"><div className="episode-section-heading"><div><h2>Episode sequence</h2><p>Scenes play from left to right. Add the same scene again whenever you like.</p></div><strong>{clock(total)} total</strong></div><div className="episode-cards">{episode.sceneIds.map((id, index) => { const item = scenes.scenes.find(candidate => candidate.id === id); return <article key={`${index}-${id}`} className={position?.index === index ? 'active' : ''}><span className="episode-number">{index + 1}</span><div><h3>{item?.name ?? 'Missing scene'}</h3><p>{item ? `${placeName(item.placeId)} · ${clock(item.duration)}` : `Scene ID ${id} is unavailable. Remove it or restore a backup.`}</p></div><div className="episode-card-actions"><button aria-label={`Move scene ${index + 1} left`} disabled={index === 0} onClick={() => { const ids = [...episode.sceneIds]; [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; change({ ...episode, sceneIds: ids }); }}>←</button><button aria-label={`Move scene ${index + 1} right`} disabled={index === episode.sceneIds.length - 1} onClick={() => { const ids = [...episode.sceneIds]; [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]]; change({ ...episode, sceneIds: ids }); }}>→</button>{item && <button onClick={() => onEditScene(item.id)}>Edit Scene</button>}<button onClick={() => change({ ...episode, sceneIds: episode.sceneIds.filter((_, position) => position !== index) })}>Remove</button></div></article>; })}</div>{episode.sceneIds.length === 0 && <p>Choose a saved scene from the library.</p>}
        <div className="episode-timeline" aria-label="Episode timeline">{episode.sceneIds.map((id, index) => { const item = scenes.scenes.find(candidate => candidate.id === id); if (!item) return null; const start = episode.sceneIds.slice(0, index).reduce((sum, before) => sum + (scenes.scenes.find(candidate => candidate.id === before)?.duration ?? 0), 0); return <button key={`${id}-${index}`} className={position?.index === index ? 'active' : ''} style={{ width: `${item.duration / Math.max(total, 1) * 100}%` }} onClick={() => { setPlaying(false); setTime(start); }} title={`Seek to ${item.name} at ${clock(start)}`}>{item.name}</button>; })}</div></section></div>
      <aside className="episode-scene-library"><h2>Saved scenes</h2><p>Add a scene to the end of your episode.</p>{scenes.scenes.map(item => <article key={item.id}><strong>{item.name}</strong><span>{placeName(item.placeId)} · {clock(item.duration)}</span><div><button onClick={() => change({ ...episode, sceneIds: [...episode.sceneIds, item.id] })}>Add Scene</button><button onClick={() => onEditScene(item.id)}>Edit Scene</button></div></article>)}{scenes.scenes.length === 0 && <p>Create a scene in Scene Maker first.</p>}</aside></div>
      <p role="status" className="scene-status">{message}</p>
    </>}
  </section>;
}

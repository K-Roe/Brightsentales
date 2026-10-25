import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Brightling } from './maker';
import { advanceSceneTime, gestureFramesForScene, needsGreetingSideWave, type TimedLibrary } from './timedScenes';
import { HEIGHT, WIDTH } from './scene';
import { placesIn, type PlaceOrganisation } from './placeFolders';
import { type MaxOutfit, type MaxineOutfit } from './outfit';
import { drawCreditsPreview, drawIntroPreview, drawScenePreview, previewPack, type PreviewPack } from './scenePreview';
import { episodeFadeAt, episodeTimingIssue, missingSceneIds, productionBlocks, productionDuration, productionPosition, speechFitsEpisode, type Episode, type EpisodeLibrary } from './episodes';
import AudioPanel from './AudioPanel';
import type { AudioAsset } from './audio';
import { episodePlaybackClips, useAudioPlayback } from './audioPlayback';
import { episodeHasUnsavedChanges, episodeSnapshot } from './episodeDraft';
import { introTitleOpacity, type IntroLibrary } from './introductions';
import { type CreditsLibrary } from './credits';
import { renderTimelineVideo } from './sceneVideoExport';
import EpisodeUnityPreview from './EpisodeUnityPreview';
import EpisodeSequence from './EpisodeSequencePanel';
import EpisodeInspector from './EpisodeInspector';
import { appendEpisodeScene, moveEpisodeOccurrence } from './episodeSequence';

export type EpisodeLeaveGuard = (proceed: () => void) => void;
type Props = { library: EpisodeLibrary; scenes: TimedLibrary; intros: IntroLibrary; credits: CreditsLibrary; characters: Brightling[]; places: PlaceOrganisation; maxOutfit: MaxOutfit; maxineOutfit: MaxineOutfit; issue: string | null; onSave: (next: EpisodeLibrary) => boolean; onEditScene: (id: string) => void; leaveGuardRef: RefObject<EpisodeLeaveGuard | null>; audioAssets?: AudioAsset[] };
const clock = (time: number) => `${time.toFixed(1)}s`;
const drawEpisodeFade = (context: CanvasRenderingContext2D, opacity: number) => { if (opacity <= 0) return; context.save(); context.globalAlpha = opacity; context.fillStyle = '#000'; context.fillRect(0, 0, WIDTH, HEIGHT); context.restore(); };
const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Artwork could not load: ${url.slice(0, 80)}`)); image.src = url; });

export default function EpisodeMaker({ library, scenes, intros, credits, characters, places, maxOutfit, maxineOutfit, issue, onSave, onEditScene, leaveGuardRef, audioAssets = [] }: Props) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [pendingLeave, setPendingLeave] = useState<{ proceed: () => void; destination: string } | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);
  const [selectedBoundary, setSelectedBoundary] = useState<number | null>(null);
  const [message, setMessage] = useState('Choose an episode or create one.');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [room, setRoom] = useState<HTMLImageElement | null>(null);
  const [packs, setPacks] = useState<Record<string, PreviewPack>>({});
  const canvas = useRef<HTMLCanvasElement>(null);
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const cancelLeave = useRef<HTMLButtonElement>(null);
  const last = useRef(0);
  const total = episode ? productionDuration(episode, scenes, intros, credits) : 0;
  const dirty = episodeHasUnsavedChanges(episode, savedSnapshot);
  const missing = episode ? missingSceneIds(episode, scenes) : [];
  const missingIntro = !!episode?.introId && !intros.intros.some(item => item.id === episode.introId);
  const missingCredits = !!episode?.creditsId && !credits.credits.some(item => item.id === episode.creditsId);
  const timingIssue = episode ? episodeTimingIssue(episode, scenes) : null;
  const position = episode && missing.length === 0 ? productionPosition(episode, scenes, intros, credits, time) : null;
  const scene = position?.scene;
  const audio = useAudioPlayback(episode ? episodePlaybackClips(episode, scenes, intros, credits) : [], audioAssets, time, playing, setMessage);
  const placeName = (id: string) => placesIn(places).find(place => place.id === id)?.name ?? 'Place unavailable';
  const readyPlace = scene && placesIn(places).find(place => place.id === scene.placeId && place.artworkAvailable && place.background);
  const requestLeave = (proceed: () => void, destination: string) => {
    if (dirty) setPendingLeave({ proceed, destination });
    else proceed();
  };
  const open = (item: Episode) => requestLeave(() => {
    setEpisode(structuredClone(item));
    setSelectedSceneIndex(null);
    setSelectedBoundary(null);
    setSavedSnapshot(library.episodes.some(saved => saved.id === item.id) ? episodeSnapshot(item) : null);
    setTime(0); setPlaying(false); setMessage('Add scenes from the library, then press Play.');
  }, 'open another episode');
  const change = (next: Episode) => { setPlaying(false); setEpisode(next); setTime(Math.min(time, productionDuration(next, scenes, intros, credits))); };
  const save = (): boolean => {
    if (!episode || issue) { setMessage(issue ?? 'Episode could not be saved.'); return false; }
    if (timingIssue) { setMessage(timingIssue); return false; }
    if (!speechFitsEpisode(episode, scenes, intros, credits)) { setMessage('A voice clip runs past the episode end. Move or trim it before saving.'); return false; }
    const next = { version: 1 as const, episodes: library.episodes.some(item => item.id === episode.id) ? library.episodes.map(item => item.id === episode.id ? episode : item) : [...library.episodes, episode] };
    const saved = onSave(next);
    if (saved) setSavedSnapshot(episodeSnapshot(episode));
    setMessage(saved ? 'Episode saved in this browser.' : 'Episode could not be saved. Existing episodes were kept.');
    return saved;
  };
  const exportVideo = async () => {
    if (!episode || dirty || missing.length || missingIntro || missingCredits || timingIssue || exporting) return;
    setPlaying(false); setExporting(true); setExportProgress(0);
    try {
      const blocks = productionBlocks(episode, scenes, intros, credits);
      if (!blocks.length) throw new Error('Add an intro, scene or credits before exporting.');
      const placesById = new Map(placesIn(places).map(place => [place.id, place]));
      const rooms = new Map<string, HTMLImageElement>();
      for (const block of blocks) {
        const place = placesById.get(block.scene.placeId);
        if (!place?.artworkAvailable || !place.background) throw new Error(`Artwork is missing for ${place?.name ?? block.scene.placeId}.`);
        if (!rooms.has(block.scene.placeId)) rooms.set(block.scene.placeId, await loadImage(place.background));
      }
      const cast = [...new Set(blocks.flatMap(block => Object.keys(block.scene.characters)))];
      const loaded = await Promise.all(cast.map(async id => [id, await previewPack(id, characters, maxOutfit, maxineOutfit, [...new Set(blocks.flatMap(block => gestureFramesForScene(block.scene, id)))], blocks.some(block => needsGreetingSideWave(block.scene, id)), blocks.some(block => block.scene.life?.mode === 'v2' || block.scene.livingWorld?.enabled) ? 'v2' : blocks.some(block => !!block.scene.life?.enabled))] as const));
      const packsById = Object.fromEntries(loaded.filter((entry): entry is readonly [string, PreviewPack] => entry[1] !== null));
      if (cast.some(id => !packsById[id])) throw new Error('A Brightling sprite is missing.');
      if (blocks.some(block => Object.keys(block.scene.characters).some(id => needsGreetingSideWave(block.scene, id) && !packsById[id]?.sideWave))) throw new Error('Greeting V2 side-wave artwork requires Max and Maxine in their original outfits.');
      const draw = (context: CanvasRenderingContext2D, at: number) => {
        const block = blocks.find((item, index) => at < item.start + item.duration || index === blocks.length - 1)!;
        const local = at - block.start;
        const room = rooms.get(block.scene.placeId)!;
        if (block.intro) drawIntroPreview(context, block.scene, block.intro.seriesTitle, block.intro.episodeTitle, block.intro.titleStyle, introTitleOpacity(block.intro, local), local, room, packsById);
        else if (block.credits) drawCreditsPreview(context, block.scene, block.credits.title, block.credits.lines, block.credits.mode, block.credits.scrollSpeed, local, room);
        else drawScenePreview(context, block.scene, Math.min(local, block.scene.duration), room, packsById);
        drawEpisodeFade(context, episodeFadeAt(episode, scenes, at, intros, credits));
      };
      const blob = await renderTimelineVideo(total, draw, episodePlaybackClips(episode, scenes, intros, credits), audioAssets, setExportProgress);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `${episode.name.replace(/[^a-z0-9_-]/gi, '_') || 'episode'}.webm`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage(`Complete episode exported (${(blob.size / 1_000_000).toFixed(1)} MB). Check the downloaded video.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Episode export failed.'); }
    finally { setExporting(false); }
  };

  useEffect(() => {
    leaveGuardRef.current = proceed => requestLeave(proceed, 'switch Studio section');
    return () => { leaveGuardRef.current = null; };
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (pendingLeave && !leaveDialog.current?.open) { leaveDialog.current?.showModal(); cancelLeave.current?.focus(); }
    else if (!pendingLeave && leaveDialog.current?.open) leaveDialog.current.close();
  }, [pendingLeave]);

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
    Promise.all(Object.keys(scene.characters).map(async id => [id, await previewPack(id, characters, maxOutfit, maxineOutfit, gestureFramesForScene(scene, id), needsGreetingSideWave(scene, id), scene.life?.mode === 'v2' || scene.livingWorld?.enabled ? 'v2' : !!scene.life?.enabled)] as const))
      .then(entries => { if (live) setPacks(Object.fromEntries(entries.filter((entry): entry is readonly [string, PreviewPack] => entry[1] !== null))); })
      .catch(() => { if (live) setMessage('A Brightling sprite could not load.'); });
    return () => { live = false; };
  }, [scene?.id, scene?.actions, scene?.life?.enabled, scene?.life?.mode, scene?.livingWorld?.enabled, characters, maxOutfit, maxineOutfit]);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    if (scene && room && position) {
      if (position.intro) drawIntroPreview(context, scene, position.intro.seriesTitle, position.intro.episodeTitle, position.intro.titleStyle, introTitleOpacity(position.intro, position.localTime), position.localTime, room, packs);
      else if (position.credits) drawCreditsPreview(context, scene, position.credits.title, position.credits.lines, position.credits.mode, position.credits.scrollSpeed, position.localTime, room);
      else drawScenePreview(context, scene, Math.min(position.localTime, scene.duration), room, packs);
      drawEpisodeFade(context, episodeFadeAt(episode!, scenes, time, intros, credits));
    }
  }, [scene, room, packs, position?.localTime, time, episode, scenes, intros, credits]);

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
    <dialog ref={leaveDialog} className="episode-leave-dialog" aria-labelledby="episode-leave-title" aria-describedby="episode-leave-description" onCancel={event => { event.preventDefault(); setPendingLeave(null); }}>
      <h2 id="episode-leave-title">Unsaved episode changes</h2>
      <p id="episode-leave-description">Save changes to {episode?.name || 'this episode'} before you {pendingLeave?.destination}?</p>
      {(issue || message.startsWith('Episode could not be saved')) && <p role="alert" className="episode-save-error">{issue ?? message}</p>}
      <div className="episode-leave-actions"><button ref={cancelLeave} onClick={() => setPendingLeave(null)}>Cancel</button><button onClick={() => { const next = pendingLeave?.proceed; setPendingLeave(null); next?.(); }}>Discard Changes</button><button className="scene-primary" onClick={() => { if (save()) { const next = pendingLeave?.proceed; setPendingLeave(null); next?.(); } }}>Save and Continue</button></div>
    </dialog>
    {!episode ? <><div className="scene-heading"><div><p className="eyebrow">EPISODE LIBRARY</p><h1>Your episodes</h1><p>Put saved scenes together and watch the whole cartoon.</p></div><button className="scene-primary" disabled={!!issue} onClick={() => open({ id: crypto.randomUUID(), name: 'My Episode', sceneIds: [] })}>Create Episode</button></div>
      {issue && <p role="alert" className="storage-alert">{issue}</p>}
      <div className="scene-library">{library.episodes.map(item => <article key={item.id}><h2>{item.name}</h2><p>{item.sceneIds.length} scenes · {clock(productionDuration(item, scenes, intros, credits))}</p>{missingSceneIds(item, scenes).length > 0 && <p role="alert" className="episode-warning">Missing saved scene. Open to repair the sequence.</p>}<div className="scene-actions"><button onClick={() => open(item)}>Open</button><button onClick={() => { open({ ...item, id: crypto.randomUUID(), name: `${item.name} copy` }); setMessage('Duplicate opened. Save to keep it.'); }}>Duplicate</button><button onClick={() => { if (window.confirm(`Delete “${item.name}”? The saved scenes will stay in your library.`)) setMessage(onSave({ version: 1, episodes: library.episodes.filter(other => other.id !== item.id) }) ? 'Episode deleted. Its scenes were kept.' : 'Episode could not be deleted.'); }}>Delete</button></div></article>)}</div>
      {library.episodes.length === 0 && <p className="scene-empty">No episodes yet. Create one to add your saved scenes.</p>}
    </> : <><div className="scene-heading"><div><p className="eyebrow">EPISODE EDITOR</p><h1>{episode.name}</h1><p>{episode.sceneIds.length} scenes · Total duration <strong>{clock(total)}</strong></p><span className={`episode-save-indicator ${dirty ? 'unsaved' : 'saved'}`} role="status">{dirty ? 'Unsaved changes' : 'Saved'}</span></div><div className="scene-actions"><button onClick={() => requestLeave(() => { setEpisode(null); setPlaying(false); }, 'return to Episodes')}>Back to Episodes</button><button className="scene-primary" onClick={save} disabled={!!issue}>Save Episode</button><button disabled={!!missing.length || missingIntro || missingCredits || !!timingIssue || total <= 0 || !room || Object.keys(scene?.characters ?? {}).some(id => !packs[id])} onClick={() => { audio.startAt(0); setTime(0); setPlaying(true); }}>Preview Episode</button></div></div>
      <label className="episode-name">Episode name<input aria-label="Episode name" maxLength={80} value={episode.name} onChange={event => change({ ...episode, name: event.target.value })} /></label>
      <div className="voice-fields"><label>Opening intro<select aria-label="Episode intro" value={episode.introId ?? ''} onChange={event => change({ ...episode, introId: event.target.value || undefined })}><option value="">No intro</option>{intros.intros.map(item => <option key={item.id} value={item.id}>{item.name} · {clock(item.duration)}</option>)}</select></label><label>Ending credits<select aria-label="Episode credits" value={episode.creditsId ?? ''} onChange={event => change({ ...episode, creditsId: event.target.value || undefined })}><option value="">No credits</option>{credits.credits.map(item => <option key={item.id} value={item.id}>{item.name} · {clock(item.duration)}</option>)}</select></label></div>
      {missing.length > 0 && <p role="alert" className="episode-warning">This episode refers to {missing.length} missing scene{missing.length === 1 ? '' : 's'}. Playback is paused until you remove the missing block or restore the scene from a backup.</p>}
      {(missingIntro || missingCredits) && <p role="alert" className="episode-warning">The selected intro or credits are missing. Choose another saved item before playback or export.</p>}
      {timingIssue && <p role="alert" className="episode-warning">{timingIssue}</p>}
      {scene?.actions.some(action => action.artwork === 'provisional-v1' && (action.characterId === 'max' && maxOutfit !== 'original' || action.characterId === 'maxine' && maxineOutfit !== 'original')) && <p role="status" className="episode-warning">Provisional gestures need Max and Maxine's original outfits. The current outfit shows its standing pose instead.</p>}
      {scene?.actions.some(action => action.artwork === 'greeting-side-v2' && (action.characterId === 'max' && maxOutfit !== 'original' || action.characterId === 'maxine' && maxineOutfit !== 'original')) && <p role="alert" className="episode-warning">Greeting V2 side waves require Max and Maxine's original outfits. Restore those outfits before export.</p>}
      <div className="episode-workspace"><div className="episode-main"><section className="scene-stage episode-preview"><div className="scene-stage-caption"><strong>{scene ? scene.name : 'EPISODE PREVIEW'}</strong><span>{scene ? `${placeName(scene.placeId)} · ${position!.kind === 'scene' ? `Scene ${position!.index + 1 - (episode.introId ? 1 : 0)} of ${episode.sceneIds.length}` : position!.kind === 'intro' ? 'Intro' : 'Credits'} · ${clock(position!.localTime)} / ${clock(position!.duration)}` : 'Add a saved scene to start'}</span></div><canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label="Episode cartoon preview" />
        <div className="scene-playback episode-transport"><button aria-label="Restart episode" onClick={() => { setPlaying(false); setTime(0); }}>Restart</button><button className="scene-primary" disabled={!!missing.length || missingIntro || missingCredits || !!timingIssue || total <= 0 || !readyPlace || !room || Object.keys(scene?.characters ?? {}).some(id => !packs[id])} onClick={() => { if (!playing) audio.startAt(time >= total ? 0 : time); if (time >= total) setTime(0); setPlaying(!playing); }}>{playing ? 'Pause' : 'Play'}</button><button disabled={!playing && time === 0} onClick={() => { setPlaying(false); setTime(0); }}>Stop</button><input aria-label="Episode time" type="range" min="0" max={total || 1} step="0.1" value={time} disabled={total <= 0 || !!missing.length || missingIntro || missingCredits || !!timingIssue} onChange={event => { setPlaying(false); setTime(Number(event.target.value)); }} /><strong>{clock(time)} / {clock(total)}</strong></div></section>
        <EpisodeSequence episode={episode} scenes={scenes} intros={intros} credits={credits} time={time} total={total} selected={selectedSceneIndex} selectedBoundary={selectedBoundary} placeName={placeName} onSelect={(index, start) => { setSelectedSceneIndex(index >= 0 ? index : null); setSelectedBoundary(null); setPlaying(false); setTime(start); }} onBoundarySelect={(index, start) => { setSelectedBoundary(index); setSelectedSceneIndex(null); setPlaying(false); setTime(start); }} onReorder={(from, to) => { change(moveEpisodeOccurrence(episode, from, to)); setSelectedSceneIndex(to); setSelectedBoundary(null); }} />
        <AudioPanel label="Episode" clips={episode.audio ?? []} assets={audioAssets} speakers={[{ id: 'max', name: 'Max' }, { id: 'maxine', name: 'Maxine' }, ...characters.map(item => ({ id: item.id, name: item.name }))]} duration={total} time={time} onChange={clips => change({ ...episode, audio: clips })} onSeek={value => { setPlaying(false); setTime(value); }} />
        <EpisodeUnityPreview episode={episode} scenes={scenes} audioAssets={audioAssets} saved={!dirty && library.episodes.some(item => item.id === episode.id)} /></div>
      <aside className="episode-production-sidebar"><EpisodeInspector episode={episode} scenes={scenes} intros={intros} credits={credits} selectedScene={selectedSceneIndex} selectedBoundary={selectedBoundary} onChange={change} onSelectScene={setSelectedSceneIndex} onEditSource={id => requestLeave(() => onEditScene(id), 'open Scene Maker')} /><section className="episode-scene-library"><h2>Saved scenes</h2><p>Add a scene to the end of your episode.</p>{scenes.scenes.map(item => <article key={item.id}>{placesIn(places).find(place => place.id === item.placeId)?.background && <img src={placesIn(places).find(place => place.id === item.placeId)?.background ?? undefined} alt="" loading="lazy" />}<strong>{item.name}</strong><span>{placeName(item.placeId)} · {clock(item.duration)}</span><div><button onClick={() => { change(appendEpisodeScene(episode, item.id)); setSelectedSceneIndex(episode.sceneIds.length); }}>Add Scene</button><button onClick={() => requestLeave(() => onEditScene(item.id), 'open Scene Maker')}>Edit Scene</button></div></article>)}{scenes.scenes.length === 0 && <p>Create a scene in Cartoon Editor first.</p>}</section></aside></div>
      <details className="episode-export-tools"><summary>Export episode video</summary><div className="scene-actions"><button disabled={dirty || exporting || total <= 0 || !!missing.length || missingIntro || missingCredits || !!timingIssue} onClick={() => void exportVideo()}>{exporting ? `Exporting ${Math.round(exportProgress * 100)}%` : 'Export Episode Video'}</button><span>Save first. Export downloads a WebM with the full soundtrack.</span></div></details>
      <p role="status" className="scene-status">{message}</p>
    </>}
  </section>;
}

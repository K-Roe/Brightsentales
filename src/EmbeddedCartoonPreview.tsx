import { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioAsset } from './audio';
import { scenePlaybackClips, useAudioPlayback } from './audioPlayback';
import { embeddedPreviewIssue } from './embeddedCartoonPreviewValidation';
import type { Brightling } from './maker';
import { placesIn, type PlaceOrganisation } from './placeFolders';
import { HEIGHT, WIDTH } from './scene';
import { drawScenePreview, previewPack, type PreviewPack } from './scenePreview';
import { advanceSceneTime, gestureFramesForScene, needsGreetingSideWave, type TimedLibrary } from './timedScenes';
import type { MaxOutfit, MaxineOutfit } from './outfit';

const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('The scene location artwork could not be loaded.')); image.src = url;
});
const formatTime = (value: number) => `${Math.floor(value / 60)}:${(value % 60).toFixed(1).padStart(4, '0')}`;

type Props = { scenes: TimedLibrary; characters: Brightling[]; places: PlaceOrganisation; audioAssets: AudioAsset[]; maxOutfit: MaxOutfit; maxineOutfit: MaxineOutfit; requestedSceneId?: string | null };

export default function EmbeddedCartoonPreview({ scenes, characters, places, audioAssets, maxOutfit, maxineOutfit, requestedSceneId }: Props) {
  const readyPlaces = useMemo(() => placesIn(places).filter(place => place.artworkAvailable && place.background), [places]);
  const [selectedId, setSelectedId] = useState(() => scenes.scenes.find(scene => scene.id === requestedSceneId)?.id ?? scenes.scenes[0]?.id ?? '');
  const scene = scenes.scenes.find(item => item.id === selectedId) ?? null;
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef(0);
  const last = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [room, setRoom] = useState<HTMLImageElement | null>(null);
  const [packs, setPacks] = useState<Record<string, PreviewPack>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const issue = scene ? embeddedPreviewIssue(scene, characters, places, audioAssets) : null;
  useAudioPlayback(scenePlaybackClips(scene?.audio), audioAssets, time, playing && !issue && !loadError, setPlaybackError);

  useEffect(() => {
    setPlaying(false); setTime(0); setPlaybackError(null); setLoadError(null); setRoom(null); setPacks({});
  }, [selectedId]);
  useEffect(() => {
    const requested = scenes.scenes.find(item => item.id === requestedSceneId);
    if (requested) setSelectedId(requested.id);
  }, [requestedSceneId, scenes.scenes]);
  useEffect(() => {
    if (selectedId && !scenes.scenes.some(item => item.id === selectedId)) {
      setSelectedId(scenes.scenes.find(item => item.id === requestedSceneId)?.id ?? scenes.scenes[0]?.id ?? '');
    }
  }, [selectedId, scenes.scenes, requestedSceneId]);

  useEffect(() => {
    if (!scene || issue) { setLoading(false); setRoom(null); setPacks({}); return; }
    let live = true;
    setLoading(true); setLoadError(null); setRoom(null); setPacks({});
    const place = readyPlaces.find(item => item.id === scene.placeId);
    if (!place?.background) { setLoading(false); setLoadError('The saved location artwork is unavailable.'); return; }
    Promise.all([
      loadImage(place.background),
      ...Object.keys(scene.characters).map(async id => {
        const pack = await previewPack(id, characters, maxOutfit, maxineOutfit, gestureFramesForScene(scene, id), needsGreetingSideWave(scene, id), scene.life?.mode === 'v2' || scene.livingWorld?.enabled ? 'v2' : !!scene.life?.enabled);
        if (!pack) throw new Error(`${id} does not have a supported saved Brightling artwork pack.`);
        return [id, pack] as const;
      }),
    ]).then(([image, ...entries]) => {
      if (!live) return;
      setRoom(image as HTMLImageElement);
      setPacks(Object.fromEntries(entries as (readonly [string, PreviewPack])[]));
      setLoading(false);
    }).catch(error => { if (live) { setLoading(false); setLoadError(error instanceof Error ? error.message : 'Scene artwork could not be prepared.'); } });
    return () => { live = false; };
  }, [scene, issue, readyPlaces, characters, maxOutfit, maxineOutfit]);

  useEffect(() => {
    if (!scene || !room || !canvas.current || issue || loadError) return;
    const context = canvas.current.getContext('2d');
    if (context) drawScenePreview(context, scene, time, room, packs);
  }, [scene, time, room, packs, issue, loadError]);

  useEffect(() => {
    if (!playing || !scene || issue || loadError) return;
    last.current = 0;
    const tick = (now: number) => {
      const elapsed = last.current ? Math.max(0, (now - last.current) / 1000) : 0;
      last.current = now;
      if (elapsed) setTime(current => {
        const next = advanceSceneTime(current, elapsed, scene.duration);
        if (next >= scene.duration) setPlaying(false);
        return next;
      });
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [playing, scene, issue, loadError]);

  const ready = !!scene && !issue && !loading && !loadError && !!room;
  const selectScene = (id: string) => { setPlaying(false); setSelectedId(id); setTime(0); };
  const play = () => {
    if (!ready || !scene) return;
    setPlaybackError(null);
    if (time >= scene.duration) setTime(0);
    setPlaying(true);
  };
  const restart = () => { setPlaybackError(null); setTime(0); setPlaying(ready); };
  const seek = (value: number) => { setPlaying(false); setTime(Math.max(0, Math.min(scene?.duration ?? 0, value))); };

  return <section className="embedded-cartoon-preview" aria-labelledby="embedded-preview-heading">
    <p className="eyebrow">CARTOON PREVIEW</p>
    <h2 id="embedded-preview-heading">Watch your scene</h2>
    {scenes.scenes.length ? <label className="embedded-preview-scene">Saved scene
      <select value={scene?.id ?? ''} onChange={event => selectScene(event.target.value)} aria-label="Select a saved scene">
        {scenes.scenes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label> : <p role="status">No saved scenes yet. Create and save a scene in Scene Maker first.</p>}
    <div className="embedded-preview-stage" aria-busy={loading}>
      <canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label={scene ? `Cartoon preview: ${scene.name}` : 'Cartoon scene preview'} />
      {(!scene || loading || issue || loadError) && <div className="embedded-preview-overlay" role="status">
        {loading ? 'Loading scene artwork…' : issue ?? loadError ?? 'Choose a saved scene'}
      </div>}
    </div>
    {scene && <>
      <div className="embedded-preview-controls">
        <button type="button" onClick={() => playing ? setPlaying(false) : play()} disabled={!ready}>{playing ? 'Pause' : 'Play'}</button>
        <button type="button" onClick={restart} disabled={!ready}>Restart</button>
        <span aria-live="polite">{playing ? 'Playing' : ready ? 'Ready' : loading ? 'Loading' : issue || loadError ? 'Unavailable' : 'Preparing'}</span>
        <span className="embedded-preview-clock">{formatTime(time)} / {formatTime(scene.duration)}</span>
      </div>
      <label className="embedded-preview-scrubber">Scene position
        <input type="range" min="0" max={scene.duration} step="0.05" value={Math.min(time, scene.duration)} disabled={!ready} onChange={event => seek(Number(event.target.value))} aria-label="Scrub scene preview" />
      </label>
    </>}
    {playbackError && <p role="alert" className="embedded-preview-error">{playbackError}</p>}
    {issue && <p role="alert" className="embedded-preview-error">{issue}</p>}
    {loadError && <p role="alert" className="embedded-preview-error">{loadError}</p>}
  </section>;
}

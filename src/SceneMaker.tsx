import { useEffect, useRef, useState } from 'react';
import type { Brightling } from './maker';
import { makePack } from './maker';
import SceneTimeline from './SceneTimeline';
import AudioPanel from './AudioPanel';
import type { AudioAsset } from './audio';
import { scenePlaybackClips, useAudioPlayback } from './audioPlayback';
import { HEIGHT, Point, WIDTH } from './scene';
import { maxSpriteSource, maxineSpriteSource, type MaxOutfit, type MaxineOutfit } from './outfit';
import { placesIn, type PlaceOrganisation } from './placeFolders';
import { advanceSceneTime, stateAt, validateTimedLibrary, waveDurationSeconds, type ActionType, type TimedAction, type TimedLibrary, type TimedScene } from './timedScenes';

type Sprite = HTMLImageElement | HTMLCanvasElement;
type Pack = { idle: Sprite; side: Sprite[]; wave: Sprite[] };
type Props = { library: TimedLibrary; characters: Brightling[]; places: PlaceOrganisation; maxOutfit: MaxOutfit; maxineOutfit: MaxineOutfit; issue: string | null; onSave: (next: TimedLibrary) => boolean; requestedSceneId?: string | null; audioAssets?: AudioAsset[] };
const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
const builtInPack = async (id: 'max' | 'maxine', max: MaxOutfit, maxine: MaxineOutfit): Promise<Pack> => {
  const source = (pose: 'idle' | 'side' | 'wave', frame = 0) => id === 'max' ? maxSpriteSource(max, pose, frame) : maxineSpriteSource(maxine, pose, frame);
  return { idle: await loadImage(source('idle')), side: await Promise.all(Array.from({ length: 5 }, (_, i) => loadImage(source('side', i)))), wave: await Promise.all(Array.from({ length: 3 }, (_, i) => loadImage(source('wave', i)))) };
};
const initialPoint = (index: number): Point => ({ x: 520 + index * 230, y: 790 });
const clone = (scene: TimedScene): TimedScene => structuredClone(scene);
const newScene = (placeId: string): TimedScene => ({ id: crypto.randomUUID(), name: 'My Scene', duration: 30, placeId, characters: {}, actions: [] });
const actionNames: Record<ActionType, string> = { appear: 'Appear', walk: 'Walk To', wait: 'Wait', wave: 'Wave', disappear: 'Disappear' };
const fmt = (time: number) => `${time.toFixed(1)}s`;
const stagePoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => { const box = event.currentTarget.getBoundingClientRect(); return { x: Math.round((event.clientX - box.left) * WIDTH / box.width), y: Math.round((event.clientY - box.top) * HEIGHT / box.height) }; };

export default function SceneMaker({ library, characters, places, maxOutfit, maxineOutfit, issue, onSave, requestedSceneId, audioAssets = [] }: Props) {
  const readyPlaces = placesIn(places).filter(place => place.artworkAvailable && place.background);
  const [scene, setScene] = useState<TimedScene | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('Choose a scene or create one.');
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [targetAction, setTargetAction] = useState<string | null>(null);
  const [packs, setPacks] = useState<Record<string, Pack>>({});
  const [room, setRoom] = useState<HTMLImageElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: string; down: Point; moved: boolean } | null>(null);
  const last = useRef(0);
  const cast = [{ id: 'max', name: 'Max' }, { id: 'maxine', name: 'Maxine' }, ...characters.map(({ id, name }) => ({ id, name }))];
  const characterName = (id: string) => cast.find(item => item.id === id)?.name ?? 'Missing Brightling';
  const update = (change: (current: TimedScene) => TimedScene) => { setPlaying(false); setScene(current => current ? change(current) : null); };
  const validation = scene ? validateTimedLibrary({ version: 1, scenes: [scene] }, readyPlaces.map(place => place.id)) : null;
  const activeAction = scene?.actions.find(action => action.id === selectedAction) ?? null;
  const audio = useAudioPlayback(scenePlaybackClips(scene?.audio), audioAssets, time, playing, setMessage);

  useEffect(() => {
    if (!scene) return;
    let live = true;
    const place = readyPlaces.find(item => item.id === scene.placeId);
    if (!place?.background) { setRoom(null); return; }
    loadImage(place.background).then(image => { if (live) setRoom(image); }).catch(() => { if (live) setMessage('Place artwork could not load.'); });
    return () => { live = false; };
  }, [scene?.placeId, places]);

  useEffect(() => {
    if (!scene) return;
    let live = true;
    Promise.all(Object.keys(scene.characters).map(async id => {
      const custom = characters.find(item => item.id === id);
      const pack = custom ? await makePack(custom) : id === 'max' || id === 'maxine' ? await builtInPack(id, maxOutfit, maxineOutfit) : null;
      return [id, pack] as const;
    })).then(entries => { if (live) setPacks(Object.fromEntries(entries.filter((entry): entry is readonly [string, Pack] => entry[1] !== null))); }).catch(() => { if (live) setMessage('A Brightling sprite could not load.'); });
    return () => { live = false; };
  }, [scene && Object.keys(scene.characters).join('|'), characters, maxOutfit, maxineOutfit]);

  useEffect(() => {
    if (!scene || !room || !canvas.current) return;
    const context = canvas.current.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.drawImage(room, 0, 0, WIDTH, HEIGHT);
    if (activeAction?.type === 'walk' && activeAction.point) {
      const start = stateAt(scene, activeAction.characterId, activeAction.start).point;
      const end = activeAction.point;
      const edge = { x: Math.max(18, Math.min(WIDTH - 18, end.x)), y: Math.max(370, Math.min(HEIGHT - 18, end.y)) };
      context.save(); context.strokeStyle = '#744cdb'; context.fillStyle = '#744cdb'; context.lineWidth = 8; context.setLineDash([20, 13]);
      context.beginPath(); context.moveTo(start.x, start.y - 20); context.lineTo(edge.x, edge.y - 20); context.stroke(); context.setLineDash([]);
      context.beginPath(); context.arc(edge.x, edge.y - 20, 19, 0, Math.PI * 2); context.fill();
      if (end.x !== edge.x || end.y !== edge.y) { context.font = 'bold 27px Segoe UI'; context.fillText('Exit', Math.max(12, edge.x - 28), edge.y - 47); }
      context.restore();
    }
    const states = Object.keys(scene.characters).map(id => ({ id, state: stateAt(scene, id, time) })).filter(item => item.state.visible && packs[item.id]);
    states.sort((a, b) => a.state.point.y - b.state.point.y);
    for (const { id, state } of states) {
      const { x, y } = state.point;
      const pack = packs[id];
      context.save();
      context.fillStyle = 'rgba(68, 42, 75, .22)'; context.beginPath(); context.ellipse(x, y - 3, 87, 17, 0, 0, Math.PI * 2); context.fill();
      if (id === selectedCharacter) { context.strokeStyle = '#705bdf'; context.lineWidth = 6; context.beginPath(); context.ellipse(x, y - 3, 92, 23, 0, 0, Math.PI * 2); context.stroke(); }
      if (state.pose === 'side') {
        const width = state.frame === 0 ? 213 : 239;
        context.translate(x, y); context.scale(state.direction, 1);
        context.drawImage(pack.side[state.frame], -width / 2, -355 - (state.frame > 0 && state.frame % 2 === 0 ? 3 : 0), width, 355);
      } else if (state.pose === 'wave') context.drawImage(pack.wave[state.frame - 1], x - 245 / 2, y - 355, 245, 355);
      else context.drawImage(pack.idle, x - 213 / 2, y - 355, 213, 355);
      context.restore();
    }
  }, [scene, time, room, packs, selectedCharacter, selectedAction]);

  useEffect(() => {
    if (!playing || !scene) return;
    let frame = 0;
    last.current = 0;
    const tick = (now: number) => {
      const elapsed = last.current ? (now - last.current) / 1000 : 0;
      last.current = now;
      if (elapsed > 0) setTime(value => { const next = advanceSceneTime(value, elapsed, scene.duration); if (next >= scene.duration) setPlaying(false); return next; });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, scene?.duration]);

  const openScene = (next: TimedScene) => { setPlaying(false); setScene(clone(next)); setTime(0); setSelectedAction(null); setSelectedCharacter(null); setTargetAction(null); setMessage('Select a Brightling on the stage or below it.'); };
  useEffect(() => { const requested = library.scenes.find(item => item.id === requestedSceneId); if (requested) openScene(requested); }, [requestedSceneId]);
  const save = () => {
    if (!scene || !validation?.ok) { setMessage(validation && !validation.ok ? validation.error : 'Scene is not ready.'); return; }
    const exists = library.scenes.some(item => item.id === scene.id);
    const next = { version: 1 as const, scenes: exists ? library.scenes.map(item => item.id === scene.id ? scene : item) : [...library.scenes, scene] };
    setMessage(onSave(next) ? 'Scene saved in this browser.' : 'Scene could not be saved. Existing scenes were kept.');
  };
  const changeAction = (id: string, patch: Partial<TimedAction>) => update(value => ({ ...value, actions: value.actions.map(action => action.id === id ? { ...action, ...patch } : action) }));
  const placeInitial = (id: string, next: Point) => update(value => {
    const previous = value.characters[id];
    return { ...value, characters: { ...value.characters, [id]: next }, actions: value.actions.map(action => action.characterId === id && action.type === 'appear' && action.start === 0 && action.point?.x === previous.x && action.point?.y === previous.y ? { ...action, point: next } : action) };
  });
  const addAction = (type: ActionType) => {
    if (!scene || !selectedCharacter) return;
    const actions = scene.actions.filter(item => item.characterId === selectedCharacter);
    const start = Math.min(scene.duration, Math.max(time, 0, ...actions.map(item => item.start + item.duration)));
    const current = stateAt(scene, selectedCharacter, start);
    const duration = type === 'appear' || type === 'disappear' ? 0 : Math.min(type === 'wave' ? waveDurationSeconds : 2, Math.max(0, scene.duration - start));
    if (type === 'wave' && duration < waveDurationSeconds || (type === 'walk' || type === 'wait') && duration <= 0) { setMessage('Move the playhead earlier or extend the scene to make room.'); return; }
    const action: TimedAction = { id: crypto.randomUUID(), characterId: selectedCharacter, type, start, duration, ...(type === 'walk' || type === 'appear' ? { point: type === 'walk' ? { x: Math.min(WIDTH + 200, current.point.x + 250), y: current.point.y } : current.point } : {}) };
    update(value => ({ ...value, actions: [...value.actions, action] }));
    setSelectedAction(action.id); setTime(start);
    if (type === 'walk' || type === 'appear') { setTargetAction(action.id); setMessage('Click the stage to choose a position. Use an edge button for an entrance or exit.'); }
    else setMessage(`${actionNames[type]} added. Drag its block on the timeline to change when it happens.`);
  };
  const selectAction = (id: string) => { const action = scene?.actions.find(item => item.id === id); if (!action) return; setSelectedCharacter(action.characterId); setSelectedAction(id); setTargetAction(null); setPlaying(false); setTime(action.start); };
  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!scene || playing) return;
    const p = stagePoint(event);
    if (targetAction) { if (p.y >= 350) { changeAction(targetAction, { point: p }); setTargetAction(null); setMessage('Position set. The path now shows the destination.'); } return; }
    const hit = Object.keys(scene.characters).filter(id => stateAt(scene, id, time).visible).sort((a, b) => stateAt(scene, b, time).point.y - stateAt(scene, a, time).point.y).find(id => { const q = stateAt(scene, id, time).point; return Math.abs(p.x - q.x) < 107 && p.y >= q.y - 335 && p.y <= q.y + 12; });
    if (!hit) return;
    setSelectedCharacter(hit); setSelectedAction(null);
    if (time <= .001) { drag.current = { id: hit, down: p, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }
  };
  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    if (!current || !scene) return;
    const p = stagePoint(event);
    if (Math.hypot(p.x - current.down.x, p.y - current.down.y) > 5) current.moved = true;
    if (current.moved) placeInitial(current.id, { x: Math.max(0, Math.min(WIDTH, p.x)), y: Math.max(350, Math.min(HEIGHT, p.y)) });
  };
  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => { if (drag.current?.moved) setMessage('Starting position updated. Save the scene to keep it.'); drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };

  if (!scene) return <section className="scene-maker"><div className="intro"><div><p className="eyebrow">SCENE STUDIO</p><h1>Make a timed scene.</h1><p>Choose when each Brightling appears, walks and waves.</p></div></div>
    {issue && <p role="alert" className="storage-alert">{issue}</p>}
    <button className="scene-primary" disabled={!!issue || readyPlaces.length === 0} onClick={() => openScene(newScene(readyPlaces[0].id))}>Create Scene</button>
    {readyPlaces.length === 0 && <p>No places with artwork are available.</p>}
    <div className="scene-library">{library.scenes.map(item => <article key={item.id}><h2>{item.name}</h2><p>{fmt(item.duration)} · {placesIn(places).find(place => place.id === item.placeId)?.name ?? 'Place unavailable'} · {Object.keys(item.characters).length} Brightlings</p><div className="scene-actions"><button onClick={() => openScene(item)}>Open</button><button onClick={() => { openScene({ ...clone(item), id: crypto.randomUUID(), name: `${item.name} copy` }); setMessage('Duplicate opened. Save to keep it.'); }}>Duplicate</button><button onClick={() => { if (window.confirm(`Delete “${item.name}”? This cannot be undone.`)) setMessage(onSave({ version: 1, scenes: library.scenes.filter(other => other.id !== item.id) }) ? 'Scene deleted.' : 'Could not delete scene.'); }}>Delete</button></div></article>)}</div>
    {library.scenes.length === 0 && <p className="scene-empty">No timed scenes yet. Create one to begin.</p>}<p role="status">{message}</p></section>;

  const selectedPosition = selectedCharacter ? scene.characters[selectedCharacter] : null;
  return <section className="scene-maker scene-visual"><div className="scene-heading"><button onClick={() => { setPlaying(false); setScene(null); }}>← All scenes</button><h1>{scene.name}</h1><button className="scene-primary" disabled={!!issue || !validation?.ok} onClick={save}>Save Scene</button></div>
    <div className="scene-setup"><label>Scene name<input aria-label="Scene name" maxLength={80} value={scene.name} onChange={event => update(value => ({ ...value, name: event.target.value }))} /></label><label>Place<select aria-label="Scene place" value={scene.placeId} onChange={event => update(value => ({ ...value, placeId: event.target.value }))}>{readyPlaces.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label><label>Duration (seconds)<input aria-label="Scene duration" type="number" min="1" max="3600" step="1" value={scene.duration} onChange={event => update(value => ({ ...value, duration: Number(event.target.value) }))} /></label></div>
    <div className="scene-stage-main"><div className="scene-stage"><div className="scene-stage-caption"><strong>{readyPlaces.find(place => place.id === scene.placeId)?.name ?? 'Scene'}</strong><span>{targetAction ? 'Click the stage to set the position' : time === 0 ? 'Click a Brightling, then drag to place' : 'Select a Brightling or scrub to a new time'}</span></div><canvas ref={canvas} width={WIDTH} height={HEIGHT} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label="Timed scene stage: select Brightlings, drag at zero seconds, or click a walking destination" />
      <div className="scene-playback"><button onClick={() => { if (!playing) audio.startAt(time); setPlaying(value => !value); }} disabled={!validation?.ok || time >= scene.duration && !playing}>{playing ? 'Pause' : 'Play'}</button><button onClick={() => { setPlaying(false); setTime(0); }}>Restart</button><strong>{fmt(time)} / {fmt(scene.duration)}</strong></div></div>
      <aside className="scene-director"><h2>Direct your Brightlings</h2><label>Add Brightling<select aria-label="Add Brightling" value="" onChange={event => { const id = event.target.value; if (!id) return; const point = initialPoint(Object.keys(scene.characters).length); update(value => ({ ...value, characters: { ...value.characters, [id]: point }, actions: [...value.actions, { id: crypto.randomUUID(), characterId: id, type: 'appear', start: 0, duration: 0, point }] })); setSelectedCharacter(id); setSelectedAction(null); setTime(0); setMessage(`Drag ${characterName(id)} on the stage to set the starting position.`); }}><option value="">Choose a Brightling…</option>{cast.filter(item => !Object.hasOwn(scene.characters, item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="director-cast">{Object.keys(scene.characters).map(id => <button key={id} className={selectedCharacter === id ? 'active' : ''} onClick={() => { setSelectedCharacter(id); setSelectedAction(null); setTargetAction(null); }}>{characterName(id)}</button>)}</div>
        {selectedCharacter ? <><p className="director-tip">{time === 0 ? `Drag ${characterName(selectedCharacter)} on the stage to place them.` : `Direct ${characterName(selectedCharacter)} at ${fmt(time)}.`}</p><div className="director-actions">{(Object.keys(actionNames) as ActionType[]).map(type => <button key={type} onClick={() => addAction(type)}>{actionNames[type]}</button>)}</div>
          <button className="director-remove" onClick={() => { if (!window.confirm(`Remove ${characterName(selectedCharacter)} from this scene?`)) return; const id = selectedCharacter; update(value => { const next = clone(value); delete next.characters[id]; next.actions = next.actions.filter(action => action.characterId !== id); return next; }); setSelectedCharacter(null); setSelectedAction(null); }}>Remove Brightling</button>
        </> : <p className="director-tip">Choose a Brightling here or tap one on the stage.</p>}
      </aside></div>
    {activeAction && <section className="scene-inspector" aria-label="Selected action"><div className="inspector-heading"><div><p className="eyebrow">SELECTED ACTION</p><h2>{characterName(activeAction.characterId)} · {actionNames[activeAction.type]}</h2></div><button onClick={() => { update(value => ({ ...value, actions: value.actions.filter(item => item.id !== activeAction.id) })); setSelectedAction(null); setTargetAction(null); }}>Remove action</button></div>
      <div className="inspector-fields"><label>Action<select aria-label="Selected action type" value={activeAction.type} onChange={event => { const type = event.target.value as ActionType; changeAction(activeAction.id, { type, duration: type === 'appear' || type === 'disappear' ? 0 : type === 'wave' ? Math.max(activeAction.duration, waveDurationSeconds) : activeAction.duration || 2, point: type === 'appear' || type === 'walk' ? activeAction.point ?? scene.characters[activeAction.characterId] : undefined }); }}>{Object.entries(actionNames).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label><label>Start at (seconds)<input aria-label="Action start time" type="number" min="0" max={scene.duration} step="0.1" value={activeAction.start} onChange={event => changeAction(activeAction.id, { start: Number(event.target.value) })} /></label>{activeAction.duration > 0 && <label>Length (seconds)<input aria-label="Selected action duration" type="number" min="0.1" step="0.1" value={activeAction.duration} onChange={event => changeAction(activeAction.id, { duration: Number(event.target.value) })} /></label>}
        {activeAction.point && <button className={targetAction === activeAction.id ? 'active' : ''} onClick={() => { setTargetAction(activeAction.id); setMessage('Click a floor position on the stage.'); }}>Choose position on stage</button>}</div>
      {activeAction.point && <div className="inspector-edges"><span>Entrance or exit:</span><button onClick={() => changeAction(activeAction.id, { point: { x: -150, y: activeAction.point!.y } })}>← Left edge</button><button onClick={() => changeAction(activeAction.id, { point: { x: WIDTH + 150, y: activeAction.point!.y } })}>Right edge →</button></div>}
      {activeAction.point && <details className="advanced-position"><summary>Advanced position</summary><div><label>X<input aria-label="Destination X" type="number" min="-250" max={WIDTH + 250} value={activeAction.point.x} onChange={event => changeAction(activeAction.id, { point: { ...activeAction.point!, x: Number(event.target.value) } })} /></label><label>Y<input aria-label="Destination Y" type="number" min="350" max={HEIGHT + 150} value={activeAction.point.y} onChange={event => changeAction(activeAction.id, { point: { ...activeAction.point!, y: Number(event.target.value) } })} /></label></div></details>}
    </section>}
    {selectedPosition && !activeAction && <details className="advanced-position scene-initial-advanced"><summary>Advanced starting position for {characterName(selectedCharacter!)}</summary><div><label>X<input aria-label={`${characterName(selectedCharacter!)} initial X`} type="number" value={selectedPosition.x} onChange={event => placeInitial(selectedCharacter!, { ...selectedPosition, x: Number(event.target.value) })} /></label><label>Y<input aria-label={`${characterName(selectedCharacter!)} initial Y`} type="number" value={selectedPosition.y} onChange={event => placeInitial(selectedCharacter!, { ...selectedPosition, y: Number(event.target.value) })} /></label></div></details>}
    <SceneTimeline scene={scene} time={time} selectedCharacter={selectedCharacter} selectedAction={selectedAction} name={characterName} onSeek={value => { setPlaying(false); setTime(value); }} onSelectCharacter={id => { setSelectedCharacter(id); setSelectedAction(null); }} onSelectAction={selectAction} onTiming={action => changeAction(action.id, action)} />
    <AudioPanel label="Scene" clips={scene.audio ?? []} assets={audioAssets} duration={scene.duration} time={time} onChange={clips => update(value => ({ ...value, audio: clips }))} onSeek={value => { setPlaying(false); setTime(value); }} />
    {validation && !validation.ok && <p role="alert" className="storage-alert">{validation.error}</p>}<p role="status" className="scene-status">{message}</p>
  </section>;
}

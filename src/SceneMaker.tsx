import { useEffect, useRef, useState } from 'react';
import type { Brightling } from './maker';
import SceneTimeline from './SceneTimeline';
import AudioPanel from './AudioPanel';
import type { AudioAsset } from './audio';
import { scenePlaybackClips, useAudioPlayback } from './audioPlayback';
import { HEIGHT, Point, WIDTH } from './scene';
import { type MaxOutfit, type MaxineOutfit } from './outfit';
import { placesIn, type PlaceOrganisation } from './placeFolders';
import { advanceSceneTime, stateAt, validateTimedLibrary, waveDurationSeconds, type ActionType, type TimedAction, type TimedLibrary, type TimedScene } from './timedScenes';
import { renderSceneVideo } from './sceneVideoExport';
import { drawScenePreview, previewPack, type PreviewPack } from './scenePreview';
import { PHONE_MESSAGES, PHONE_POSITIONS, PHONE_RAISE_SECONDS, PHONE_SYMBOLS, PHONE_TAP_SECONDS, phoneActionNames, phoneStateAt, syncPhoneClip, type PhoneAction, type PhoneActionType, type PhoneHand } from './phone';

type Props = { library: TimedLibrary; characters: Brightling[]; places: PlaceOrganisation; maxOutfit: MaxOutfit; maxineOutfit: MaxineOutfit; issue: string | null; onSave: (next: TimedLibrary) => boolean; requestedSceneId?: string | null; audioAssets?: AudioAsset[] };
const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
const initialPoint = (index: number): Point => ({ x: 520 + index * 230, y: 790 });
const clone = (scene: TimedScene): TimedScene => structuredClone(scene);
const newScene = (placeId: string): TimedScene => ({ id: crypto.randomUUID(), name: 'My Scene', duration: 30, placeId, characters: {}, actions: [] });
const actionNames: Record<ActionType, string> = {
  appear: 'Appear', walk: 'Walk To', wait: 'Wait', wave: 'Wave', disappear: 'Disappear',
  breathe: 'Breathe', point: 'Point', nod: 'Nod', shake: 'Shake head', smile: 'Smile',
  surprise: 'Surprise', clap: 'Clap', react: 'React', turn: 'Turn', jump: 'Jump', excited: 'Excited bounce',
};
const fmt = (time: number) => `${time.toFixed(1)}s`;
const stagePoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => { const box = event.currentTarget.getBoundingClientRect(); return { x: Math.round((event.clientX - box.left) * WIDTH / box.width), y: Math.round((event.clientY - box.top) * HEIGHT / box.height) }; };

export default function SceneMaker({ library, characters, places, maxOutfit, maxineOutfit, issue, onSave, requestedSceneId, audioAssets = [] }: Props) {
  const readyPlaces = placesIn(places).filter(place => place.artworkAvailable && place.background);
  const [scene, setScene] = useState<TimedScene | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [message, setMessage] = useState('Choose a scene or create one.');
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [targetAction, setTargetAction] = useState<string | null>(null);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const [packs, setPacks] = useState<Record<string, PreviewPack>>({});
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
      const pack = await previewPack(id, characters, maxOutfit, maxineOutfit);
      return [id, pack] as const;
    })).then(entries => { if (live) setPacks(Object.fromEntries(entries.filter((entry): entry is readonly [string, PreviewPack] => entry[1] !== null))); }).catch(() => { if (live) setMessage('A Brightling sprite could not load.'); });
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
    // The editor uses the one shared scene renderer, so what you direct is exactly what plays
    // back and what the WebM export records. Only the selection ring is added on top.
    drawScenePreview(context, scene, time, room, packs);
    if (selectedCharacter) {
      const selected = stateAt(scene, selectedCharacter, time);
      if (selected.visible && packs[selectedCharacter]) {
        context.strokeStyle = '#705bdf'; context.lineWidth = 6;
        context.beginPath(); context.ellipse(selected.point.x, selected.point.y - 3, 92, 23, 0, 0, Math.PI * 2); context.stroke();
      }
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
  const exportVideo = async () => {
    if (!scene || !room || !validation?.ok || exporting) return;
    setPlaying(false); setExporting(true); setExportProgress(0);
    try {
      const blob = await renderSceneVideo(scene, room, packs, audioAssets, setExportProgress);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `${scene.name.replace(/[^a-z0-9_-]/gi, '_') || 'scene'}.webm`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage('Scene video exported with its saved voice, music and sound-effect clips.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Scene export failed.'); }
    finally { setExporting(false); }
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
    const defaultDuration = type === 'wave' ? waveDurationSeconds : type === 'turn' ? 0.4 : type === 'react' || type === 'surprise' ? 0.8 : type === 'clap' || type === 'jump' ? 1 : 1.5;
    const duration = type === 'appear' || type === 'disappear' ? 0 : Math.min(defaultDuration, Math.max(0, scene.duration - start));
    if ((type === 'wave' && duration < waveDurationSeconds) || (type !== 'appear' && type !== 'disappear' && duration <= 0)) { setMessage('Move the playhead earlier or extend the scene to make room.'); return; }
    const action: TimedAction = { id: crypto.randomUUID(), characterId: selectedCharacter, type, start, duration, ...(type === 'walk' || type === 'appear' ? { point: type === 'walk' ? { x: Math.min(WIDTH + 200, current.point.x + 250), y: current.point.y } : current.point } : {}) };
    update(value => ({ ...value, actions: [...value.actions, action] }));
    setSelectedAction(action.id); setTime(start);
    if (type === 'walk' || type === 'appear') { setTargetAction(action.id); setMessage('Click the stage to choose a position. Use an edge button for an entrance or exit.'); }
    else setMessage(`${actionNames[type]} added. Drag its block on the timeline to change when it happens.`);
  };
  const selectAction = (id: string) => { const action = scene?.actions.find(item => item.id === id); if (!action) return; setSelectedCharacter(action.characterId); setSelectedAction(id); setTargetAction(null); setPlaying(false); setTime(action.start); };
  const speechAssets = audioAssets.filter(asset => asset.kind === 'speech');
  const selectedPhone = scene?.phone?.find(action => action.id === selectedPhoneId) ?? null;
  const phoneNow = selectedCharacter && scene ? phoneStateAt(scene, selectedCharacter, time) : null;
  const phoneActions = scene && selectedCharacter ? (scene.phone ?? []).filter(action => action.characterId === selectedCharacter).sort((a, b) => a.start - b.start) : [];

  const commitPhone = (change: (current: TimedScene) => TimedScene) => update(current => {
    const before = current;
    const next = change(current);
    // Keep each communication's speech clip aligned with its own interaction time, and drop
    // the clip of an interaction that was deleted so no silent orphan audio is left behind.
    let audioClips = next.audio ?? [];
    const keptClipIds = new Set((next.phone ?? []).map(action => action.clipId).filter(Boolean));
    const removed = (before.phone ?? []).filter(action => action.clipId && !keptClipIds.has(action.clipId));
    for (const gone of removed) audioClips = syncPhoneClip({ duration: next.duration, audio: audioClips }, gone, null, gone.clipId);
    for (const action of next.phone ?? []) {
      const asset = action.assetId ? audioAssets.find(item => item.id === action.assetId) ?? null : null;
      audioClips = syncPhoneClip({ duration: next.duration, audio: audioClips }, action, asset);
    }
    return { ...next, audio: audioClips };
  });

  const removePhoneAction = (id: string) => {
    const target = scene?.phone?.find(action => action.id === id);
    if (!target) return;
    commitPhone(value => ({ ...value, phone: (value.phone ?? []).filter(item => item.id !== id) }));
    setSelectedPhoneId(null);
    setMessage(`${phoneActionNames[target.type]} removed.`);
  };

  const addPhoneAction = (type: PhoneActionType) => {
    if (!scene || !selectedCharacter) return;
    const existing = phoneActions;
    const hand = (existing.find(item => item.hand)?.hand ?? (selectedCharacter === 'max' && maxOutfit === 'original' ? 'left' : 'right')) as PhoneHand;
    const held = phoneStateAt(scene, selectedCharacter, time).held;
    if ((type === 'hold' || type === 'tap' || type === 'communicate') && !held) { setMessage(`Take out ${characterName(selectedCharacter)}'s Bright Speak first.`); return; }
    if (type === 'take-out' && held) { setMessage(`${characterName(selectedCharacter)} is already holding Bright Speak.`); return; }
    if (type === 'put-away' && !held) { setMessage('Bright Speak is already put away.'); return; }
    const start = Math.min(scene.duration, Math.max(time, 0, ...existing.map(item => item.start + item.duration)));
    const duration = type === 'take-out' || type === 'put-away' ? Math.min(PHONE_RAISE_SECONDS, Math.max(0.1, scene.duration - start)) : type === 'tap' ? Math.min(PHONE_TAP_SECONDS, Math.max(0.1, scene.duration - start)) : type === 'communicate' ? Math.min(3, Math.max(0.8, scene.duration - start)) : Math.min(2, Math.max(0.3, scene.duration - start));
    if (duration <= 0) { setMessage('Move the playhead earlier or extend the scene to make room.'); return; }
    const action: PhoneAction = {
      id: crypto.randomUUID(), characterId: selectedCharacter, type, start, duration,
      ...(type === 'take-out' ? { hand } : {}),
      ...(type === 'communicate' ? { message: PHONE_MESSAGES[0], symbol: 'food', position: 'above-right', clipId: crypto.randomUUID() } : {}),
    };
    commitPhone(value => ({ ...value, phone: [...(value.phone ?? []), action] }));
    setSelectedPhoneId(action.id); setSelectedAction(null); setTime(start);
    setMessage(`${phoneActionNames[type]} added at ${fmt(start)}. The phone speaks for the Brightling; they never speak it themselves.`);
  };

  const changePhone = (id: string, patch: Partial<PhoneAction>) => commitPhone(value => ({ ...value, phone: (value.phone ?? []).map(action => action.id === id ? { ...action, ...patch } : action) }));
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
  return <section className="scene-maker scene-visual"><div className="scene-heading"><button onClick={() => { setPlaying(false); setScene(null); }}>← All scenes</button><h1>{scene.name}</h1><button className="scene-primary" disabled={!!issue || !validation?.ok} onClick={save}>Save Scene</button><button disabled={!!issue || !validation?.ok || !room || exporting} onClick={() => void exportVideo()}>{exporting ? `Exporting ${Math.round(exportProgress * 100)}%` : 'Export scene video (WebM)'}</button></div>
    <div className="scene-setup"><label>Scene name<input aria-label="Scene name" maxLength={80} value={scene.name} onChange={event => update(value => ({ ...value, name: event.target.value }))} /></label><label>Place<select aria-label="Scene place" value={scene.placeId} onChange={event => update(value => ({ ...value, placeId: event.target.value }))}>{readyPlaces.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label><label>Duration (seconds)<input aria-label="Scene duration" type="number" min="1" max="3600" step="1" value={scene.duration} onChange={event => update(value => ({ ...value, duration: Number(event.target.value) }))} /></label></div>
    <div className="scene-stage-main"><div className="scene-stage"><div className="scene-stage-caption"><strong>{readyPlaces.find(place => place.id === scene.placeId)?.name ?? 'Scene'}</strong><span>{targetAction ? 'Click the stage to set the position' : time === 0 ? 'Click a Brightling, then drag to place' : 'Select a Brightling or scrub to a new time'}</span></div><canvas ref={canvas} width={WIDTH} height={HEIGHT} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label="Timed scene stage: select Brightlings, drag at zero seconds, or click a walking destination" />
      <div className="scene-playback"><button onClick={() => { if (!playing) audio.startAt(time); setPlaying(value => !value); }} disabled={!validation?.ok || time >= scene.duration && !playing}>{playing ? 'Pause' : 'Play'}</button><button onClick={() => { setPlaying(false); setTime(0); }}>Restart</button><strong>{fmt(time)} / {fmt(scene.duration)}</strong></div></div>
      <aside className="scene-director"><h2>Direct your Brightlings</h2><label>Add Brightling<select aria-label="Add Brightling" value="" onChange={event => { const id = event.target.value; if (!id) return; const point = initialPoint(Object.keys(scene.characters).length); update(value => ({ ...value, characters: { ...value.characters, [id]: point }, actions: [...value.actions, { id: crypto.randomUUID(), characterId: id, type: 'appear', start: 0, duration: 0, point }] })); setSelectedCharacter(id); setSelectedAction(null); setTime(0); setMessage(`Drag ${characterName(id)} on the stage to set the starting position.`); }}><option value="">Choose a Brightling…</option>{cast.filter(item => !Object.hasOwn(scene.characters, item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="director-cast">{Object.keys(scene.characters).map(id => <button key={id} className={selectedCharacter === id ? 'active' : ''} onClick={() => { setSelectedCharacter(id); setSelectedAction(null); setTargetAction(null); }}>{characterName(id)}</button>)}</div>
        {selectedCharacter ? <><p className="director-tip">{time === 0 ? `Drag ${characterName(selectedCharacter)} on the stage to place them.` : `Direct ${characterName(selectedCharacter)} at ${fmt(time)}.`}</p><div className="director-actions">{(Object.keys(actionNames) as ActionType[]).map(type => <button key={type} onClick={() => addAction(type)}>{actionNames[type]}</button>)}</div>
          <div className="director-phone" aria-label="Bright Speak">
            <p className="eyebrow">BRIGHT SPEAK</p>
            <p className="director-tip">{phoneNow?.held ? `${characterName(selectedCharacter)} is holding Bright Speak in the ${phoneNow.hand} hand.` : `${characterName(selectedCharacter)} is not holding Bright Speak.`}</p>
            <div className="director-actions">{(['take-out', 'hold', 'tap', 'communicate', 'put-away'] as PhoneActionType[]).map(type => <button key={type} onClick={() => addPhoneAction(type)}>{phoneActionNames[type]}</button>)}</div>
            <label className="phone-carry">Start this shot with the phone already in hand<select aria-label="Phone already in hand" value={scene.phoneIn ?? ''} onChange={event => update(value => ({ ...value, phoneIn: event.target.value === '' ? null : event.target.value as PhoneHand }))}><option value="">No — put it away</option><option value="right">Yes — right hand</option><option value="left">Yes — left hand</option></select></label>
            <p className="director-tip">Illustrated holding and tapping is available for Max in his original hoodie, standing still, with Bright Speak in his left hand. Other poses use the existing Bright Speak prop.</p>
            {phoneActions.length > 0 && <ul className="phone-list" aria-label="Phone interactions">{phoneActions.map(action => <li key={action.id}><button className={selectedPhoneId === action.id ? 'active' : ''} onClick={() => { setSelectedPhoneId(action.id); setTime(action.start); setPlaying(false); }}>{phoneActionNames[action.type]} · {fmt(action.start)}</button></li>)}</ul>}
          </div>
          <button className="director-remove" onClick={() => { if (!window.confirm(`Remove ${characterName(selectedCharacter)} from this scene?`)) return; const id = selectedCharacter; update(value => { const next = clone(value); delete next.characters[id]; next.actions = next.actions.filter(action => action.characterId !== id); next.phone = (next.phone ?? []).filter(action => action.characterId !== id); return next; }); setSelectedCharacter(null); setSelectedAction(null); }}>Remove Brightling</button>
        </> : <p className="director-tip">Choose a Brightling here or tap one on the stage.</p>}
      </aside></div>
    {activeAction && <section className="scene-inspector" aria-label="Selected action"><div className="inspector-heading"><div><p className="eyebrow">SELECTED ACTION</p><h2>{characterName(activeAction.characterId)} · {actionNames[activeAction.type]}</h2></div><button onClick={() => { update(value => ({ ...value, actions: value.actions.filter(item => item.id !== activeAction.id) })); setSelectedAction(null); setTargetAction(null); }}>Remove action</button></div>
      <div className="inspector-fields"><label>Action<select aria-label="Selected action type" value={activeAction.type} onChange={event => { const type = event.target.value as ActionType; const defaultDuration = type === 'wave' ? waveDurationSeconds : type === 'turn' ? 0.4 : type === 'react' || type === 'surprise' ? 0.8 : type === 'clap' || type === 'jump' ? 1 : 1.5; changeAction(activeAction.id, { type, duration: type === 'appear' || type === 'disappear' ? 0 : type === 'wave' ? Math.max(activeAction.duration, waveDurationSeconds) : activeAction.duration || defaultDuration, point: type === 'appear' || type === 'walk' ? activeAction.point ?? scene.characters[activeAction.characterId] : undefined }); }}>{Object.entries(actionNames).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label><label>Start at (seconds)<input aria-label="Action start time" type="number" min="0" max={scene.duration} step="0.1" value={activeAction.start} onChange={event => changeAction(activeAction.id, { start: Number(event.target.value) })} /></label>{activeAction.duration > 0 && <label>Length (seconds)<input aria-label="Selected action duration" type="number" min="0.1" step="0.1" value={activeAction.duration} onChange={event => changeAction(activeAction.id, { duration: Number(event.target.value) })} /></label>}
        {activeAction.point && <button className={targetAction === activeAction.id ? 'active' : ''} onClick={() => { setTargetAction(activeAction.id); setMessage('Click a floor position on the stage.'); }}>Choose position on stage</button>}</div>
      {activeAction.point && <div className="inspector-edges"><span>Entrance or exit:</span><button onClick={() => changeAction(activeAction.id, { point: { x: -150, y: activeAction.point!.y } })}>← Left edge</button><button onClick={() => changeAction(activeAction.id, { point: { x: WIDTH + 150, y: activeAction.point!.y } })}>Right edge →</button></div>}
      {activeAction.point && <details className="advanced-position"><summary>Advanced position</summary><div><label>X<input aria-label="Destination X" type="number" min="-250" max={WIDTH + 250} value={activeAction.point.x} onChange={event => changeAction(activeAction.id, { point: { ...activeAction.point!, x: Number(event.target.value) } })} /></label><label>Y<input aria-label="Destination Y" type="number" min="350" max={HEIGHT + 150} value={activeAction.point.y} onChange={event => changeAction(activeAction.id, { point: { ...activeAction.point!, y: Number(event.target.value) } })} /></label></div></details>}
    </section>}
    {selectedPosition && !activeAction && <details className="advanced-position scene-initial-advanced"><summary>Advanced starting position for {characterName(selectedCharacter!)}</summary><div><label>X<input aria-label={`${characterName(selectedCharacter!)} initial X`} type="number" value={selectedPosition.x} onChange={event => placeInitial(selectedCharacter!, { ...selectedPosition, x: Number(event.target.value) })} /></label><label>Y<input aria-label={`${characterName(selectedCharacter!)} initial Y`} type="number" value={selectedPosition.y} onChange={event => placeInitial(selectedCharacter!, { ...selectedPosition, y: Number(event.target.value) })} /></label></div></details>}
    {selectedPhone && <section className="scene-inspector" aria-label="Selected phone interaction"><div className="inspector-heading"><div><p className="eyebrow">SELECTED PHONE INTERACTION</p><h2>{characterName(selectedPhone.characterId)} · {phoneActionNames[selectedPhone.type]}</h2></div><button onClick={() => removePhoneAction(selectedPhone.id)}>Remove interaction</button></div>
      <div className="inspector-fields">
        <label>Start at (seconds)<input aria-label="Phone interaction start time" type="number" min="0" max={scene.duration} step="0.1" value={selectedPhone.start} onChange={event => changePhone(selectedPhone.id, { start: Number(event.target.value) })} /></label>
        {selectedPhone.type !== 'tap' && <label>Length (seconds)<input aria-label="Phone interaction duration" type="number" min={selectedPhone.type === 'communicate' ? 0.8 : 0.1} max={selectedPhone.type === 'communicate' ? 12 : 3} step="0.1" value={selectedPhone.duration} onChange={event => changePhone(selectedPhone.id, { duration: Number(event.target.value) })} /></label>}
        {selectedPhone.type === 'take-out' && <label>Which hand<select aria-label="Phone hand" value={selectedPhone.hand ?? 'right'} onChange={event => changePhone(selectedPhone.id, { hand: event.target.value as PhoneHand })}><option value="right">Right hand</option><option value="left">Left hand</option></select></label>}
        {selectedPhone.type === 'communicate' && <>
          <label>Message<input aria-label="Communication message" maxLength={80} value={selectedPhone.message ?? ''} onChange={event => changePhone(selectedPhone.id, { message: event.target.value })} /></label>
          <label>Quick messages<select aria-label="Quick communication messages" value="" onChange={event => event.target.value && changePhone(selectedPhone.id, { message: event.target.value })}><option value="">Choose a message…</option>{PHONE_MESSAGES.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Symbol<select aria-label="Communication symbol" value={selectedPhone.symbol ?? 'food'} onChange={event => changePhone(selectedPhone.id, { symbol: event.target.value as PhoneAction['symbol'] })}>{PHONE_SYMBOLS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>Pop-up position<select aria-label="Communication pop-up position" value={selectedPhone.position ?? 'above-right'} onChange={event => changePhone(selectedPhone.id, { position: event.target.value as PhoneAction['position'] })}>{PHONE_POSITIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>Phone voice<select aria-label="Phone voice" value={selectedPhone.assetId ?? ''} onChange={event => changePhone(selectedPhone.id, { assetId: event.target.value || undefined, clipId: event.target.value ? selectedPhone.clipId ?? crypto.randomUUID() : undefined })}><option value="">Silent — text only</option>{speechAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
          <p className="director-tip">Generate the line in Voice Maker (AI Voices or Record Voice), save it, then choose it here. The device speaks it — {characterName(selectedPhone.characterId)} stays silent.</p>
        </>}
      </div>
    </section>}
    <SceneTimeline scene={scene} time={time} selectedCharacter={selectedCharacter} selectedAction={selectedAction} name={characterName} onSeek={value => { setPlaying(false); setTime(value); }} onSelectCharacter={id => { setSelectedCharacter(id); setSelectedAction(null); }} onSelectAction={selectAction} onTiming={action => changeAction(action.id, action)} />
    <AudioPanel label="Scene" clips={scene.audio ?? []} assets={audioAssets} speakers={Object.keys(scene.characters).map(id => ({ id, name: characterName(id) }))} duration={scene.duration} time={time} onChange={clips => update(value => ({ ...value, audio: clips }))} onExtendDuration={seconds => update(value => ({ ...value, duration: Math.max(value.duration, Math.min(3600, seconds)) }))} onSeek={value => { setPlaying(false); setTime(value); }} />
    {validation && !validation.ok && <p role="alert" className="storage-alert">{validation.error}</p>}<p role="status" className="scene-status">{message}</p>
  </section>;
}

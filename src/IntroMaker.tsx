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
import { advanceSceneTime, stateAt, waveDurationSeconds, type ActionType, type TimedAction } from './timedScenes';
import { drawIntroPreview } from './scenePreview';
import { INTRO_MAX_DURATION, INTRO_MIN_DURATION, INTRO_TITLE_LIMIT, INTRO_TITLE_STYLES, introTitleOpacity, newIntro, validateIntro, type Intro, type IntroLibrary, type IntroTitleStyle } from './introductions';

type Sprite = HTMLImageElement | HTMLCanvasElement;
type Pack = { idle: Sprite; side: Sprite[]; wave: Sprite[] };
type Props = { library: IntroLibrary; characters: Brightling[]; places: PlaceOrganisation; maxOutfit: MaxOutfit; maxineOutfit: MaxineOutfit; issue: string | null; onSave: (next: IntroLibrary) => boolean; audioAssets?: AudioAsset[] };

const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
const builtInPack = async (id: 'max' | 'maxine', max: MaxOutfit, maxine: MaxineOutfit): Promise<Pack> => {
  const source = (pose: 'idle' | 'side' | 'wave', frame = 0) => id === 'max' ? maxSpriteSource(max, pose, frame) : maxineSpriteSource(maxine, pose, frame);
  return { idle: await loadImage(source('idle')), side: await Promise.all(Array.from({ length: 5 }, (_, i) => loadImage(source('side', i)))), wave: await Promise.all(Array.from({ length: 3 }, (_, i) => loadImage(source('wave', i)))) };
};
const clone = (intro: Intro): Intro => structuredClone(intro);
const fmt = (time: number) => `${time.toFixed(1)}s`;
const stagePoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => { const box = event.currentTarget.getBoundingClientRect(); return { x: Math.round((event.clientX - box.left) * WIDTH / box.width), y: Math.round((event.clientY - box.top) * HEIGHT / box.height) }; };
// Intros stay deliberately gentle: entrance, walk, wave and wait only. No looped action vocabulary.
const introActionNames: Record<string, string> = { appear: 'Appear', walk: 'Walk In', wait: 'Wait', wave: 'Wave' };

export default function IntroMaker({ library, characters, places, maxOutfit, maxineOutfit, issue, onSave, audioAssets = [] }: Props) {
  const readyPlaces = placesIn(places).filter(place => place.artworkAvailable && place.background);
  const placeIds = readyPlaces.map(place => place.id);
  const [intro, setIntro] = useState<Intro | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('Open an intro or create a new one.');
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [targetAction, setTargetAction] = useState<string | null>(null);
  const [packs, setPacks] = useState<Record<string, Pack>>({});
  const [room, setRoom] = useState<HTMLImageElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: string; down: Point; moved: boolean } | null>(null);
  const cast = [{ id: 'max', name: 'Max' }, { id: 'maxine', name: 'Maxine' }, ...characters.map(({ id, name }) => ({ id, name }))];
  const characterName = (id: string) => cast.find(item => item.id === id)?.name ?? 'Missing Brightling';
  const update = (change: (current: Intro) => Intro) => { setPlaying(false); setIntro(current => current ? change(current) : null); };
  const validation = intro ? validateIntro(intro, placeIds) : null;
  const activeAction = intro?.actions.find(action => action.id === selectedAction) ?? null;
  const audio = useAudioPlayback(scenePlaybackClips(intro?.audio), audioAssets, time, playing, setMessage);

  useEffect(() => {
    if (!intro) return;
    let live = true;
    const place = readyPlaces.find(item => item.id === intro.placeId);
    if (!place?.background) { setRoom(null); return; }
    loadImage(place.background).then(image => { if (live) setRoom(image); }).catch(() => { if (live) setMessage('Place artwork could not load.'); });
    return () => { live = false; };
  }, [intro?.placeId, places]);

  useEffect(() => {
    if (!intro) return;
    let live = true;
    Promise.all(Object.keys(intro.characters).map(async id => {
      const custom = characters.find(item => item.id === id);
      const pack = custom ? await makePack(custom) : id === 'max' || id === 'maxine' ? await builtInPack(id, maxOutfit, maxineOutfit) : null;
      return [id, pack] as const;
    })).then(entries => { if (live) setPacks(Object.fromEntries(entries.filter((entry): entry is readonly [string, Pack] => entry[1] !== null))); }).catch(() => { if (live) setMessage('A Brightling sprite could not load.'); });
    return () => { live = false; };
  }, [intro && Object.keys(intro.characters).join('|'), characters, maxOutfit, maxineOutfit]);

  useEffect(() => {
    if (!intro || !room || !canvas.current) return;
    const context = canvas.current.getContext('2d');
    if (!context) return;
    drawIntroPreview(context, intro, intro.seriesTitle, intro.episodeTitle, intro.titleStyle, introTitleOpacity(intro, time), time, room, packs);
    if (targetAction && activeAction?.type === 'walk' && activeAction.point) {
      const start = stateAt(intro, activeAction.characterId, activeAction.start).point;
      context.save();
      context.strokeStyle = '#744cdb'; context.fillStyle = '#744cdb'; context.lineWidth = 8; context.setLineDash([20, 13]);
      context.beginPath(); context.moveTo(start.x, start.y - 20); context.lineTo(activeAction.point.x, activeAction.point.y - 20); context.stroke(); context.setLineDash([]);
      context.beginPath(); context.arc(activeAction.point.x, activeAction.point.y - 20, 19, 0, Math.PI * 2); context.fill();
      context.restore();
    }
    if (selectedCharacter && !selectedAction) {
      const state = stateAt(intro, selectedCharacter, time);
      if (state.visible && packs[selectedCharacter]) {
        context.save(); context.strokeStyle = '#705bdf'; context.lineWidth = 6;
        context.beginPath(); context.ellipse(state.point.x, state.point.y - 3, 92, 23, 0, 0, Math.PI * 2); context.stroke(); context.restore();
      }
    }
  }, [intro, time, room, packs, selectedCharacter, selectedAction, targetAction]);

  useEffect(() => {
    if (!playing || !intro) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const elapsed = last ? (now - last) / 1000 : 0;
      last = now;
      if (elapsed > 0) setTime(value => { const next = advanceSceneTime(value, elapsed, intro.duration); if (next >= intro.duration) setPlaying(false); return next; });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, intro?.duration]);

  const openIntro = (next: Intro) => { setPlaying(false); setIntro(clone(next)); setTime(0); setSelectedAction(null); setSelectedCharacter(null); setTargetAction(null); setMessage('Set your titles, then preview.'); };
  const save = () => {
    if (!intro) return;
    const result = validateIntro(intro, placeIds);
    if (typeof result === 'string') { setMessage(result); return; }
    const exists = library.intros.some(item => item.id === result.id);
    const next = { version: 1 as const, intros: exists ? library.intros.map(item => item.id === result.id ? result : item) : [...library.intros, result] };
    setMessage(onSave(next) ? 'Intro saved in this browser. Reuse it in any episode.' : 'Intro could not be saved. Existing intros were kept.');
  };
  const changeAction = (id: string, patch: Partial<TimedAction>) => update(value => ({ ...value, actions: value.actions.map(action => action.id === id ? { ...action, ...patch } : action) }));
  const placeInitial = (id: string, next: Point) => update(value => {
    const previous = value.characters[id];
    return { ...value, characters: { ...value.characters, [id]: next }, actions: value.actions.map(action => action.characterId === id && action.type === 'appear' && action.start === 0 && action.point?.x === previous.x && action.point?.y === previous.y ? { ...action, point: next } : action) };
  });
  const addAction = (type: ActionType) => {
    if (!intro || !selectedCharacter) return;
    const existing = intro.actions.filter(item => item.characterId === selectedCharacter);
    const start = Math.min(intro.duration, Math.max(time, 0, ...existing.map(item => item.start + item.duration)));
    const current = stateAt(intro, selectedCharacter, start);
    const duration = type === 'appear' ? 0 : type === 'wave' ? waveDurationSeconds : Math.min(2, Math.max(0, intro.duration - start));
    if (type === 'wave' && start + waveDurationSeconds > intro.duration + 1e-7 || (type === 'walk' || type === 'wait') && duration <= 0) { setMessage('Move the playhead earlier or extend the intro to make room.'); return; }
    const action: TimedAction = { id: crypto.randomUUID(), characterId: selectedCharacter, type, start, duration, ...(type === 'walk' ? { point: { x: Math.max(0, Math.min(WIDTH, current.point.x + 220)), y: current.point.y } } : type === 'appear' ? { point: { ...current.point } } : {}) };
    update(value => ({ ...value, actions: [...value.actions, action] }));
    setSelectedAction(action.id); setTime(start);
    if (type === 'walk') { setTargetAction(action.id); setMessage('Click the stage to choose where the walk ends.'); }
    else setMessage(`${introActionNames[type] ?? type} added.`);
  };
  const selectAction = (id: string) => { const action = intro?.actions.find(item => item.id === id); if (!action) return; setSelectedCharacter(action.characterId); setSelectedAction(id); setTargetAction(null); setPlaying(false); setTime(action.start); };
  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!intro || playing) return;
    const p = stagePoint(event);
    if (targetAction) { if (p.y >= 350) { changeAction(targetAction, { point: { x: Math.max(0, Math.min(WIDTH, p.x)), y: Math.max(350, Math.min(HEIGHT, p.y)) } }); setTargetAction(null); setMessage('Walk destination set.'); } return; }
    const hit = Object.keys(intro.characters).filter(id => stateAt(intro, id, time).visible).sort((a, b) => stateAt(intro, b, time).point.y - stateAt(intro, a, time).point.y).find(id => { const q = stateAt(intro, id, time).point; return Math.abs(p.x - q.x) < 107 && p.y >= q.y - 335 && p.y <= q.y + 12; });
    if (!hit) return;
    setSelectedCharacter(hit); setSelectedAction(null);
    if (time <= .001) { drag.current = { id: hit, down: p, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }
  };
  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    if (!current || !intro) return;
    const p = stagePoint(event);
    if (Math.hypot(p.x - current.down.x, p.y - current.down.y) > 5) current.moved = true;
    if (current.moved) placeInitial(current.id, { x: Math.max(0, Math.min(WIDTH, p.x)), y: Math.max(350, Math.min(HEIGHT, p.y)) });
  };
  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };

  if (!intro) return <section className="scene-maker intro-maker"><div className="intro"><div><p className="eyebrow">INTRO STUDIO</p><h1>Make a reusable intro.</h1><p>Series title, episode title, a place, your Brightlings and music.</p></div></div>
    {issue && <p role="alert" className="storage-alert">{issue}</p>}
    <button className="scene-primary" disabled={!!issue || readyPlaces.length === 0} onClick={() => openIntro(newIntro(readyPlaces[0].id))}>Create Intro</button>
    {readyPlaces.length === 0 && <p>No places with artwork are available. Add place artwork in Places first.</p>}
    <div className="scene-library">{library.intros.map(item => <article key={item.id}><h2>{item.name}</h2><p>{item.episodeTitle} · {item.seriesTitle} · {fmt(item.duration)} · {Object.keys(item.characters).length} Brightlings</p><div className="scene-actions"><button onClick={() => openIntro(item)}>Open</button><button onClick={() => { openIntro({ ...clone(item), id: crypto.randomUUID(), name: `${item.name} copy` }); setMessage('Duplicate opened. Save to keep it.'); }}>Duplicate</button><button onClick={() => { if (window.confirm(`Delete “${item.name}”? This cannot be undone.`)) setMessage(onSave({ version: 1, intros: library.intros.filter(other => other.id !== item.id) }) ? 'Intro deleted.' : 'Could not delete intro.'); }}>Delete</button></div></article>)}</div>
    {library.intros.length === 0 && <p className="scene-empty">No intros yet. Create one to begin.</p>}<p role="status">{message}</p></section>;

  const problem = validation && typeof validation !== 'string' ? null : validation;
  return <section className="scene-maker scene-visual intro-maker">
    <div className="scene-heading"><button onClick={() => { setPlaying(false); setIntro(null); }}>← All intros</button><h1>{intro.name}</h1><button className="scene-primary" disabled={!!issue || !!problem} onClick={save}>Save Intro</button></div>
    <div className="scene-setup">
      <label>Intro name<input aria-label="Intro name" maxLength={80} value={intro.name} onChange={event => update(value => ({ ...value, name: event.target.value }))} /></label>
      <label>Series title<input aria-label="Intro series title" maxLength={INTRO_TITLE_LIMIT} value={intro.seriesTitle} onChange={event => update(value => ({ ...value, seriesTitle: event.target.value }))} /></label>
      <label>Episode title<input aria-label="Intro episode title" maxLength={INTRO_TITLE_LIMIT} value={intro.episodeTitle} onChange={event => update(value => ({ ...value, episodeTitle: event.target.value }))} /></label>
      <label>Title style<select aria-label="Intro title style" value={intro.titleStyle} onChange={event => update(value => ({ ...value, titleStyle: event.target.value as IntroTitleStyle }))}>{Object.entries(INTRO_TITLE_STYLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Place<select aria-label="Intro place" value={intro.placeId} onChange={event => update(value => ({ ...value, placeId: event.target.value }))}>{readyPlaces.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
      <label>Length (seconds)<input aria-label="Intro duration" type="number" min={INTRO_MIN_DURATION} max={INTRO_MAX_DURATION} step="1" value={intro.duration} onChange={event => update(value => ({ ...value, duration: Number(event.target.value) }))} /></label>
    </div>
    <div className="scene-stage-main"><div className="scene-stage"><div className="scene-stage-caption"><strong>Intro preview</strong><span>{targetAction ? 'Click the stage to set the walk destination' : 'Add a Brightling to bring them on screen'}</span></div><canvas ref={canvas} width={WIDTH} height={HEIGHT} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label="Intro preview stage with titles" />
      <div className="scene-playback"><button onClick={() => { if (!playing) audio.startAt(time); setPlaying(value => !value); }} disabled={!!problem || time >= intro.duration && !playing}>{playing ? 'Pause' : 'Play'}</button><button onClick={() => { setPlaying(false); setTime(0); }}>Restart</button><strong>{fmt(time)} / {fmt(intro.duration)}</strong></div></div>
      <aside className="scene-director"><h2>Who appears</h2><label>Add Brightling<select aria-label="Add Brightling" value="" onChange={event => { const id = event.target.value; if (!id) return; const index = Object.keys(intro.characters).length; const point = { x: 420 + index * 300, y: 790 }; update(value => ({ ...value, characters: { ...value.characters, [id]: point }, actions: [...value.actions, { id: crypto.randomUUID(), characterId: id, type: 'appear', start: 0, duration: 0, point }] })); setSelectedCharacter(id); setSelectedAction(null); setTime(0); setMessage(`${characterName(id)} added. Drag them at 0.0s to set the starting position.`); }}><option value="">Choose a Brightling…</option>{cast.filter(item => !Object.hasOwn(intro.characters, item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="director-cast">{Object.keys(intro.characters).map(id => <button key={id} className={selectedCharacter === id ? 'active' : ''} onClick={() => { setSelectedCharacter(id); setSelectedAction(null); setTargetAction(null); }}>{characterName(id)}</button>)}</div>
        {selectedCharacter ? <><div className="director-actions">{(['appear', 'walk', 'wait', 'wave'] as ActionType[]).map(type => <button key={type} onClick={() => addAction(type)}>{introActionNames[type]}</button>)}</div>
          <button className="director-remove" onClick={() => { if (!window.confirm(`Remove ${characterName(selectedCharacter)} from this intro?`)) return; const id = selectedCharacter; update(value => { const next = clone(value); delete next.characters[id]; next.actions = next.actions.filter(action => action.characterId !== id); return next; }); setSelectedCharacter(null); setSelectedAction(null); }}>Remove Brightling</button></> : <p className="director-tip">Add a Brightling, then choose when they walk in or wave.</p>}
      </aside></div>
    {activeAction && <section className="scene-inspector" aria-label="Selected intro action"><div className="inspector-heading"><div><p className="eyebrow">SELECTED ACTION</p><h2>{characterName(activeAction.characterId)} · {introActionNames[activeAction.type] ?? activeAction.type}</h2></div><button onClick={() => { update(value => ({ ...value, actions: value.actions.filter(item => item.id !== activeAction.id) })); setSelectedAction(null); setTargetAction(null); }}>Remove action</button></div>
      <div className="inspector-fields"><label>Start at (seconds)<input aria-label="Action start time" type="number" min="0" max={intro.duration} step="0.1" value={activeAction.start} onChange={event => changeAction(activeAction.id, { start: Number(event.target.value) })} /></label>{activeAction.duration > 0 && <label>Length (seconds)<input aria-label="Selected action duration" type="number" min="0.1" step="0.1" value={activeAction.duration} onChange={event => changeAction(activeAction.id, { duration: Number(event.target.value) })} /></label>}</div>
    </section>}
    <SceneTimeline scene={intro} time={time} selectedCharacter={selectedCharacter} selectedAction={selectedAction} name={characterName} onSeek={value => { setPlaying(false); setTime(value); }} onSelectCharacter={id => { setSelectedCharacter(id); setSelectedAction(null); }} onSelectAction={selectAction} onTiming={action => changeAction(action.id, action)} />
    <AudioPanel label="Intro" clips={intro.audio ?? []} assets={audioAssets} speakers={Object.keys(intro.characters).map(id => ({ id, name: characterName(id) }))} duration={intro.duration} time={time} onChange={clips => update(value => ({ ...value, audio: clips }))} onSeek={value => { setPlaying(false); setTime(value); }} />
    {problem && <p role="alert" className="storage-alert">{problem}</p>}<p role="status" className="scene-status">{message}</p>
  </section>;
}
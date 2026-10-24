import { useEffect, useRef, useState } from 'react';
import { ACTION_PARTS, newAction, poseAt, validateActionLibrary, type ActionLibrary, type SavedAction } from './actions';
import { drawMaxActionRig, loadMaxActionRig, MAX_RIG_EDITABLE, type MaxActionRig } from './actionRig';
import type { Brightling } from './maker';

type Props = { library: ActionLibrary; characters: Brightling[]; issue: string | null; onSave: (next: ActionLibrary) => boolean };
const copy = (action: SavedAction) => structuredClone(action);
const download = (action: SavedAction) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(action, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `${action.name.replace(/[^a-z0-9_-]/gi, '_') || 'action'}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export default function ActionCreator({ library, characters, issue, onSave }: Props) {
  const [characterId, setCharacterId] = useState('max');
  const [draft, setDraft] = useState<SavedAction>(() => newAction());
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState(draft.keyframes[0].id);
  const [history, setHistory] = useState<SavedAction[]>([]);
  const [future, setFuture] = useState<SavedAction[]>([]);
  const [rig, setRig] = useState<MaxActionRig | null>(null);
  const [message, setMessage] = useState('Max’s approved standing sprite is shown. Existing action data is preserved while rig editing is unavailable.');
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef(0);
  const compatible = characterId === 'max';
  const canEdit = compatible && MAX_RIG_EDITABLE;
  const frame = draft.keyframes.find(item => item.id === selected) ?? draft.keyframes[0];
  const change = (next: SavedAction) => { setPlaying(false); setHistory(items => [...items.slice(-49), copy(draft)]); setFuture([]); setDraft(next); };
  useEffect(() => { if (!draft.keyframes.some(item => item.id === selected)) setSelected(draft.keyframes[0].id); }, [draft, selected]);
  useEffect(() => { let live = true; loadMaxActionRig().then(value => { if (live) setRig(value); }).catch(error => { if (live) setMessage(error instanceof Error ? error.message : 'Rig artwork unavailable.'); }); return () => { live = false; }; }, []);
  useEffect(() => {
    if (!canvas.current || !rig) return;
    const context = canvas.current.getContext('2d'); if (!context) return;
    context.clearRect(0, 0, 434, 724);
    context.fillStyle = '#d9d4e9'; context.fillRect(0, 697, 434, 2);
    context.fillStyle = 'rgba(68,42,75,.2)'; context.beginPath(); context.ellipse(217, 694, 102, 14, 0, 0, Math.PI * 2); context.fill();
    drawMaxActionRig(context, rig, 0, 0, 434, 724);
  }, [rig, draft, time, compatible]);
  useEffect(() => {
    if (!playing) return;
    let handle = 0; last.current = 0;
    const tick = (now: number) => {
      const elapsed = last.current ? (now - last.current) / 1000 : 0; last.current = now;
      setTime(current => { const next = current + elapsed * speed; if (next >= draft.duration) { if (!loop) setPlaying(false); return loop ? next % draft.duration : draft.duration; } return next; });
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick); return () => cancelAnimationFrame(handle);
  }, [playing, loop, speed, draft.duration]);
  const editFrame = (part: typeof ACTION_PARTS[number], angle: number) => change({ ...draft, keyframes: draft.keyframes.map(item => item.id === selected ? { ...item, pose: { ...item.pose, [part]: angle } } : item) });
  const addFrame = () => {
    const at = Math.round(time * 100) / 100;
    if (at <= 0 || at >= draft.duration || draft.keyframes.some(item => Math.abs(item.time - at) < .01)) { setMessage('Choose a new time between the first and last keyframes.'); return; }
    const id = crypto.randomUUID();
    change({ ...draft, keyframes: [...draft.keyframes, { id, time: at, pose: poseAt(draft, at) }].sort((a, b) => a.time - b.time) }); setSelected(id);
  };
  const save = () => {
    const next = { version: 1 as const, actions: [...library.actions.filter(item => item.id !== draft.id), draft] };
    const checked = validateActionLibrary(next);
    if (!checked.ok) { setMessage(checked.error); return; }
    setMessage(onSave(next) ? `Saved “${draft.name}”.` : 'Action could not be saved. Existing actions were kept.');
  };
  const importFile = async (file: File) => {
    try {
      const value = JSON.parse(await file.text());
      const checked = validateActionLibrary({ version: 1, actions: [value] });
      if (!checked.ok) { setMessage(checked.error); return; }
      const imported = { ...checked.library.actions[0], id: crypto.randomUUID() };
      const next = { version: 1 as const, actions: [...library.actions, imported] };
      if (onSave(next)) { setDraft(imported); setSelected(imported.keyframes[0].id); setTime(0); setMessage('Action imported and saved.'); }
      else setMessage('Action import could not be saved.');
    } catch { setMessage('Action file is not valid JSON.'); }
  };
  return <section className="action-creator">
    <header><p className="eyebrow">ACTION CREATOR</p><h1>Action Creator · visual repair needed</h1><p>The original sprites and existing walking, waving and Bright Speak animation stay in place.</p></header>
    <p role="alert" className="storage-alert">AC-01 visual acceptance failed. The available Max cut-outs leave gaps and original-arm fragments when rotated. Pose editing and playback are disabled until a properly separated rig is approved. Saved action definitions are kept; the stage shows Max’s approved neutral artwork.</p>
    {issue && <p role="alert" className="storage-alert">{issue}</p>}
    <div className="action-layout">
      <aside className="action-controls">
        <label>Brightling<select value={characterId} onChange={event => setCharacterId(event.target.value)}><option value="max">Max · original outfit</option><option value="maxine">Maxine · no editable rig</option>{characters.map(item => <option key={item.id} value={item.id}>{item.name} · no editable rig</option>)}</select></label>
        {!compatible && <p role="status">This Brightling has approved whole-body frames only. Part editing and applying this rig are unavailable.</p>}
        <label>Saved action<select value={library.actions.some(item => item.id === draft.id) ? draft.id : ''} onChange={event => { const action = library.actions.find(item => item.id === event.target.value); if (action) { setDraft(copy(action)); setSelected(action.keyframes[0].id); setTime(0); setHistory([]); setFuture([]); } }}><option value="">New unsaved action</option>{library.actions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="action-buttons"><button disabled={!canEdit} onClick={() => { const action = newAction(); setDraft(action); setSelected(action.keyframes[0].id); setTime(0); setHistory([]); setFuture([]); }}>New</button><button disabled={!canEdit} onClick={() => { const next = copy(draft); next.id = crypto.randomUUID(); next.name = `${next.name} copy`; next.keyframes.forEach(item => { item.id = crypto.randomUUID(); }); setDraft(next); setSelected(next.keyframes[0].id); setHistory([]); setFuture([]); }}>Duplicate</button></div>
        <label>Action name<input value={draft.name} maxLength={80} onChange={event => change({ ...draft, name: event.target.value })} disabled={!canEdit} /></label>
        <label>Category<select value={draft.category} onChange={event => change({ ...draft, category: event.target.value as SavedAction['category'] })} disabled={!canEdit}><option value="movement">Movement</option><option value="emotions">Emotions</option><option value="interactions">Interactions</option><option value="daily">Daily activities</option></select></label>
        <label>Duration (seconds)<input type="number" min="0.2" max="60" step="0.1" value={draft.duration} disabled={!canEdit} onChange={event => { const duration = Number(event.target.value); if (duration < .2 || duration > 60) return; change({ ...draft, duration, keyframes: draft.keyframes.map((item, index) => index === draft.keyframes.length - 1 ? { ...item, time: duration } : item) }); setTime(Math.min(time, duration)); }} /></label>
        <h2>Selected keyframe · {frame.time.toFixed(2)}s</h2>
        {ACTION_PARTS.map(part => <label key={part}>{part.replace('-', ' ')} · {Math.round(frame.pose[part])}°<input type="range" min="-70" max="70" value={frame.pose[part]} disabled={!canEdit} onChange={event => editFrame(part, Number(event.target.value))} /></label>)}
        <div className="action-buttons"><button disabled={!canEdit || !history.length} onClick={() => { setFuture(items => [copy(draft), ...items]); setDraft(history.at(-1)!); setHistory(items => items.slice(0, -1)); }}>Undo</button><button disabled={!canEdit || !future.length} onClick={() => { setHistory(items => [...items, copy(draft)]); setDraft(future[0]); setFuture(items => items.slice(1)); }}>Redo</button></div>
        <div className="action-buttons"><button disabled={!canEdit || !!issue} onClick={save}>Save action</button><button disabled={!library.actions.some(item => item.id === draft.id)} onClick={() => { if (!window.confirm(`Delete saved action “${draft.name}”? This cannot be undone.`)) return; if (onSave({ version: 1, actions: library.actions.filter(item => item.id !== draft.id) })) { const next = newAction(); setDraft(next); setSelected(next.keyframes[0].id); setTime(0); } }}>Delete</button></div>
        <div className="action-buttons"><button disabled={!library.actions.some(item => item.id === draft.id)} onClick={() => download(draft)}>Export JSON</button><label className="action-import">Import JSON<input type="file" accept="application/json,.json" disabled={!canEdit} onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ''; }} /></label></div>
      </aside>
      <div className="action-stage">{compatible ? <canvas ref={canvas} width={434} height={724} aria-label="Approved Max neutral artwork; animation editing unavailable" /> : <p role="status">No articulated cut-out is available for this Brightling. Their approved whole-body sprites remain available in Scene Maker.</p>}<p role="status">{message}</p></div>
    </div>
    <section className="action-timeline" aria-label="Action keyframe timeline"><h2>Keyframes</h2><div className="action-buttons"><button onClick={() => setPlaying(value => !value)} disabled={!canEdit}>{playing ? 'Pause' : 'Play'}</button><label><input type="checkbox" checked={loop} disabled={!canEdit} onChange={event => setLoop(event.target.checked)} /> Loop</label><label>Speed<select value={speed} disabled={!canEdit} onChange={event => setSpeed(Number(event.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></div>
      <input type="range" min="0" max={draft.duration} step="0.01" value={time} disabled={!canEdit} onChange={event => { setPlaying(false); setTime(Number(event.target.value)); }} aria-label="Scrub animation" /><span>{time.toFixed(2)} / {draft.duration.toFixed(2)}s</span>
      <div className="action-keys">{draft.keyframes.map(item => <button key={item.id} disabled={!canEdit} className={selected === item.id ? 'active' : ''} onClick={() => { setSelected(item.id); setTime(item.time); setPlaying(false); }} style={{ left: `${item.time / draft.duration * 100}%` }} aria-label={`Keyframe at ${item.time.toFixed(2)} seconds`}>◆</button>)}</div>
      <div className="action-buttons"><button disabled={!canEdit} onClick={addFrame}>Add keyframe at playhead</button><button disabled={!canEdit || draft.keyframes.length <= 2 || frame.time === 0 || frame.time === draft.duration} onClick={() => { change({ ...draft, keyframes: draft.keyframes.filter(item => item.id !== selected) }); setSelected(draft.keyframes[0].id); }}>Remove selected keyframe</button></div>
    </section>
  </section>;
}

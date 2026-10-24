import { useEffect, useState } from 'react';
import { HEIGHT, WIDTH } from './scene';
import type { TimedScene } from './timedScenes';
import type { CameraFocus, CameraKeyframe, CameraShot } from './camera';

type Props = { scene: TimedScene; time: number; selectedId: string | null; onSelect: (id: string | null) => void; onChange: (camera: CameraKeyframe[]) => void; onPreview: (key: CameraKeyframe | null) => void };
const initial = (time: number): CameraKeyframe => ({ id: crypto.randomUUID(), shot: 'wide', focus: 'point', point: { x: WIDTH / 2, y: HEIGHT / 2 }, start: time, duration: 1.5 });

export default function CameraPanel({ scene, time, selectedId, onSelect, onChange, onPreview }: Props) {
  const [draft, setDraft] = useState<CameraKeyframe>(() => initial(0));
  const selected = scene.camera?.find(key => key.id === selectedId);
  useEffect(() => { if (selected) { setDraft(selected); onPreview(null); } }, [selected]);
  const edit = (patch: Partial<CameraKeyframe>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (selected) onChange((scene.camera ?? []).map(key => key.id === selectedId ? next : key));
    else onPreview(next);
  };
  const add = () => {
    const key = { ...draft, id: crypto.randomUUID(), start: time, duration: Math.min(draft.duration, Math.max(0, scene.duration - time)) };
    onChange([...(scene.camera ?? []), key].sort((a, b) => a.start - b.start));
    onSelect(key.id);
    onPreview(null);
  };
  const focusOptions = [<option key="point" value="point">Custom point</option>, ...(['max', 'maxine'] as const).filter(id => scene.characters[id]).map(id => <option key={id} value={id}>{id === 'max' ? 'Max' : 'Maxine'}</option>), ...(draft.shot === 'medium' && Object.keys(scene.characters).length > 0 ? [<option key="group" value="group">All Brightlings</option>] : [])];
  return <section className="camera-panel" aria-label="Camera"><div className="inspector-heading"><div><p className="eyebrow">CAMERA</p><h2>{selected ? 'Edit camera keyframe' : 'Choose a camera shot'}</h2></div><button onClick={() => { onSelect(null); setDraft(initial(time)); onPreview(null); }}>New shot</button></div>
    <div className="inspector-fields">
      <label>Shot<select aria-label="Camera shot" value={draft.shot} onChange={event => edit({ shot: event.target.value as CameraShot, focus: event.target.value === 'wide' ? 'point' : draft.focus === 'group' && event.target.value === 'close-up' ? 'point' : draft.focus, follow: event.target.value === 'wide' ? false : draft.follow, point: event.target.value === 'wide' ? { x: WIDTH / 2, y: HEIGHT / 2 } : draft.point })}><option value="wide">Wide Shot</option><option value="medium">Medium Shot</option><option value="close-up">Close-Up</option></select></label>
      {draft.shot !== 'wide' && <label>Focus<select aria-label="Camera focus" value={draft.focus} onChange={event => edit({ focus: event.target.value as CameraFocus, point: event.target.value === 'point' ? draft.point ?? { x: WIDTH / 2, y: HEIGHT / 2 } : undefined, follow: event.target.value === 'point' ? false : draft.follow })}>{focusOptions}</select></label>}
      {draft.shot !== 'wide' && draft.focus === 'point' && <><label>Focus X<input aria-label="Camera focus X" type="number" min="0" max={WIDTH} value={draft.point?.x ?? WIDTH / 2} onChange={event => edit({ point: { x: Number(event.target.value), y: draft.point?.y ?? HEIGHT / 2 } })} /></label><label>Focus Y<input aria-label="Camera focus Y" type="number" min="0" max={HEIGHT} value={draft.point?.y ?? HEIGHT / 2} onChange={event => edit({ point: { x: draft.point?.x ?? WIDTH / 2, y: Number(event.target.value) } })} /></label></>}
      {draft.shot !== 'wide' && draft.focus !== 'point' && <label>Follow character movement<input aria-label="Follow character movement" type="checkbox" checked={!!draft.follow} onChange={event => edit({ follow: event.target.checked })} /></label>}
      {selected && <label>Transition starts (seconds)<input aria-label="Camera start time" type="number" min="0" max={scene.duration} step="0.1" value={draft.start} onChange={event => edit({ start: Number(event.target.value) })} /></label>}
      <label>Transition duration (seconds)<input aria-label="Camera transition duration" type="number" min={selected?.start === 0 ? 0 : 0.6} max="15" step="0.1" value={draft.duration} onChange={event => edit({ duration: Number(event.target.value) })} /></label>
    </div>
    {selected ? <button onClick={() => { onChange((scene.camera ?? []).filter(key => key.id !== selectedId)); onSelect(null); onPreview(null); }}>Remove keyframe</button> : <button disabled={time > 0 && (scene.duration - time < .6 || draft.duration < .6)} onClick={add}>Add camera keyframe at {time.toFixed(1)}s</button>}
    <button disabled={time > 0 && scene.duration - time < .6} onClick={() => { const key = { ...initial(time), duration: Math.min(1.5, scene.duration - time) }; onChange([...(scene.camera ?? []), key].sort((a, b) => a.start - b.start)); onSelect(key.id); onPreview(null); }}>Return to Wide Shot</button>
    <p className="director-tip">Changes preview on the stage. Add a keyframe to save a shot; select its block on the timeline to edit timing.</p>
  </section>;
}

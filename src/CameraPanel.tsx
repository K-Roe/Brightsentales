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
  const focusOptions = [<option key="point" value="point">Fixed position</option>, ...Object.keys(scene.characters).filter(id => id !== 'point').map(id => <option key={id} value={id}>{id === 'max' ? 'Max' : id === 'maxine' ? 'Maxine' : id}</option>), ...(draft.shot === 'medium' && Object.keys(scene.characters).length > 0 ? [<option key="group" value="group">All Brightlings</option>] : [])];
  const movement = draft.follow ? 'follow' : draft.duration > 0 ? 'pan' : 'static';
  const setMovement = (value: 'static' | 'pan' | 'follow') => {
    if (value === 'follow') {
      const first = Object.keys(scene.characters).find(id => id !== 'point');
      if (!first) return;
      const focus = draft.focus === 'point' || draft.shot === 'wide' || draft.focus === 'group' ? first : draft.focus;
      edit({ follow: true, shot: draft.shot === 'wide' ? 'medium' : draft.shot, duration: Math.max(.6, draft.duration), focus, point: undefined });
      return;
    }
    edit({ follow: false, duration: value === 'static' ? 0 : Math.max(.6, draft.duration) });
  };
  const changeShot = (shot: CameraShot) => {
    const patch: Partial<CameraKeyframe> = { shot };
    if (shot === 'wide') Object.assign(patch, { focus: 'point', follow: false, point: { x: WIDTH / 2, y: HEIGHT / 2 }, zoom: undefined });
    else if (shot === 'custom') Object.assign(patch, { zoom: draft.zoom ?? 2, ...(draft.focus === 'group' ? { focus: Object.keys(scene.characters)[0] || 'point' } : {}) });
    else Object.assign(patch, { zoom: undefined, ...(draft.focus === 'group' && shot === 'close-up' ? { focus: Object.keys(scene.characters)[0] || 'point' } : {}) });
    edit(patch);
  };
  return <section className="camera-panel" aria-label="Camera"><div className="inspector-heading"><div><p className="eyebrow">CAMERA</p><h2>{selected ? 'Edit camera shot' : 'Choose a camera shot'}</h2></div><button onClick={() => { onSelect(null); setDraft(initial(time)); onPreview(null); }}>New shot</button></div>
    <div className="inspector-fields">
      <label>Shot<select aria-label="Camera shot" value={draft.shot} onChange={event => changeShot(event.target.value as CameraShot)}><option value="wide">Wide Shot</option><option value="medium">Medium Shot</option><option value="close-up">Close-Up</option><option value="custom">Custom Shot</option></select><small>{draft.shot === 'wide' ? 'Shows the whole Living Room.' : draft.shot === 'medium' ? 'Frames the Brightling with some room.' : draft.shot === 'close-up' ? 'Frames the Brightling closely.' : 'Manual framing with your own zoom.'}</small></label>
      {draft.shot !== 'wide' && <label>Focus<select aria-label="Camera focus" value={draft.focus} onChange={event => edit({ focus: event.target.value as CameraFocus, point: event.target.value === 'point' ? draft.point ?? { x: WIDTH / 2, y: HEIGHT / 2 } : undefined, follow: event.target.value === 'point' ? false : draft.follow })}>{focusOptions}</select></label>}
      {draft.shot === 'custom' && draft.focus !== 'point' && <label>Zoom<input aria-label="Camera zoom" type="number" min="1" max="4" step="0.1" value={draft.zoom ?? 2} onChange={event => edit({ zoom: Math.max(1, Math.min(4, Number(event.target.value))) })} /><small>1x shows more room. 4x is the tightest.</small></label>}
      {draft.shot !== 'wide' && draft.focus === 'point' && <><label>Focus X<input aria-label="Camera focus X" type="number" min="0" max={WIDTH} value={draft.point?.x ?? WIDTH / 2} onChange={event => edit({ point: { x: Number(event.target.value), y: draft.point?.y ?? HEIGHT / 2 } })} /></label><label>Focus Y<input aria-label="Camera focus Y" type="number" min="0" max={HEIGHT} value={draft.point?.y ?? HEIGHT / 2} onChange={event => edit({ point: { x: draft.point?.x ?? WIDTH / 2, y: Number(event.target.value) } })} /></label></>}
      <label>Movement<select aria-label="Camera movement" value={movement} onChange={event => setMovement(event.target.value as 'static' | 'pan' | 'follow')}><option value="static">Static</option><option value="pan">Pan</option><option value="follow">Follow</option></select><small>{movement === 'static' ? 'Stays on this shot.' : movement === 'pan' ? 'Glides here from the previous shot.' : 'Keeps tracking this Brightling.'}</small></label>
      {selected && <label>Shot starts (seconds)<input aria-label="Camera start time" type="number" min="0" max={scene.duration} step="0.1" value={draft.start} onChange={event => edit({ start: Number(event.target.value) })} /></label>}
      {movement !== 'static' && <label>{movement === 'pan' ? 'Move duration' : 'Ease-in duration'} (seconds)<input aria-label="Camera transition duration" type="number" min={selected?.start === 0 ? 0 : 0.6} max="15" step="0.1" value={draft.duration} onChange={event => edit({ duration: Number(event.target.value) })} /></label>}
      {movement === 'static' && selected && <p className="director-tip">A static shot holds until the next camera shot. Add another shot to move the camera.</p>}
    </div>
    {selected ? <button onClick={() => { onChange((scene.camera ?? []).filter(key => key.id !== selectedId)); onSelect(null); onPreview(null); }}>Remove keyframe</button> : <button disabled={time > 0 && (scene.duration - time < .6 || draft.duration < .6)} onClick={add}>Add camera keyframe at {time.toFixed(1)}s</button>}
    <button disabled={time > 0 && scene.duration - time < .6} onClick={() => { const key = { ...initial(time), duration: Math.min(1.5, scene.duration - time) }; onChange([...(scene.camera ?? []), key].sort((a, b) => a.start - b.start)); onSelect(key.id); onPreview(null); }}>Return to Wide Shot</button>
    <p className="director-tip">Changes preview on the stage. Add a keyframe to save a shot; select its block on the timeline to edit timing.</p>
  </section>;
}

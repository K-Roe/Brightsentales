import { useRef, useState } from 'react';
import { editActionTiming, type TimingEdit } from './timelineEditing';
import type { TimedAction, TimedScene } from './timedScenes';

type Props = {
  scene: TimedScene;
  time: number;
  selectedCharacter: string | null;
  selectedAction: string | null;
  name: (id: string) => string;
  onSeek: (time: number) => void;
  onSelectCharacter: (id: string) => void;
  onSelectAction: (id: string) => void;
  onTiming: (action: TimedAction) => void;
};
type Lane = { id: string; kind: 'character'; label: string };
const titles = {
  appear: 'Appear', walk: 'Walk To', wait: 'Wait', wave: 'Wave', disappear: 'Disappear',
  breathe: 'Breathe', point: 'Point', nod: 'Nod', shake: 'Shake', smile: 'Smile',
  surprise: 'Surprise', clap: 'Clap', react: 'React', turn: 'Turn',
} as const;
const LABEL_WIDTH = 116;

export default function SceneTimeline({ scene, time, selectedCharacter, selectedAction, name, onSeek, onSelectCharacter, onSelectAction, onTiming }: Props) {
  const [pixelsPerSecond, setPixelsPerSecond] = useState(24);
  const drag = useRef<{ id: string; mode: TimingEdit; x: number; base: TimedScene } | null>(null);
  const lanes: Lane[] = Object.keys(scene.characters).map(id => ({ id, kind: 'character', label: name(id) }));
  const ticks = Array.from({ length: Math.floor(scene.duration / (pixelsPerSecond < 20 ? 5 : 2)) + 1 }, (_, i) => i * (pixelsPerSecond < 20 ? 5 : 2));
  const width = LABEL_WIDTH + scene.duration * pixelsPerSecond + 40;
  const seek = (event: React.PointerEvent<HTMLDivElement>) => {
    const ruler = event.currentTarget.getBoundingClientRect();
    const seconds = (event.clientX - ruler.left - LABEL_WIDTH) / pixelsPerSecond;
    onSeek(Math.max(0, Math.min(scene.duration, Math.round(seconds * 10) / 10)));
  };
  return <section className="scene-timeline" aria-label="Visual scene timeline">
    <div className="timeline-heading"><div><h2>Timeline</h2><p>Drag a block to move it. Drag its right edge to change its length.</p></div><label>Zoom<select aria-label="Timeline zoom" value={pixelsPerSecond} onChange={event => setPixelsPerSecond(Number(event.target.value))}><option value="14">Far</option><option value="24">Normal</option><option value="42">Close</option></select></label></div>
    <div className="timeline-scroll" tabIndex={0} aria-label="Scrollable timeline"><div className="timeline-content" style={{ width }}>
      <div className="timeline-ruler" onPointerDown={event => { seek(event); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event); }}>
        <span className="timeline-label">Time</span>{ticks.map(tick => <span className="timeline-tick" key={tick} style={{ left: LABEL_WIDTH + tick * pixelsPerSecond }}>{tick}s</span>)}
      </div>
      {lanes.map(lane => <div className={`timeline-lane ${selectedCharacter === lane.id ? 'selected' : ''}`} key={lane.id} data-lane-kind={lane.kind}>
        <button className="timeline-label" onClick={() => onSelectCharacter(lane.id)}>{lane.label}</button>
        <div className="timeline-track" style={{ left: LABEL_WIDTH }} />
        {scene.actions.filter(action => action.characterId === lane.id).map(action => <div
          key={action.id} role="button" tabIndex={0} aria-label={`${lane.label} ${titles[action.type]} at ${action.start} seconds`}
          className={`timeline-block timeline-${action.type} ${selectedAction === action.id ? 'selected' : ''}`}
          title={`${titles[action.type]} at ${action.start}s${action.duration ? ` for ${action.duration}s` : ''}`}
          style={{ left: LABEL_WIDTH + action.start * pixelsPerSecond, width: Math.max(58, action.duration * pixelsPerSecond) }}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectAction(action.id); } }}
          onPointerDown={event => { event.stopPropagation(); onSelectAction(action.id); drag.current = { id: action.id, mode: (event.target as HTMLElement).closest('.timeline-resize') ? 'resize' : 'move', x: event.clientX, base: structuredClone(scene) }; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={event => { const current = drag.current; if (!current || current.id !== action.id || !event.currentTarget.hasPointerCapture(event.pointerId)) return; const result = editActionTiming(current.base, current.id, current.mode, (event.clientX - current.x) / pixelsPerSecond); if (result) onTiming(result); }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        ><span>{titles[action.type]}</span>{action.duration > 0 && <span className="timeline-resize" aria-hidden="true" />}</div>)}
      </div>)}
      <div className="timeline-playhead" style={{ left: LABEL_WIDTH + time * pixelsPerSecond }} aria-hidden="true"><span /></div>
    </div></div>
    {lanes.length === 0 && <p className="timeline-empty">Add a Brightling to start its timeline.</p>}
  </section>;
}

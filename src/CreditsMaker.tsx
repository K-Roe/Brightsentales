import { useEffect, useRef, useState } from 'react';
import AudioPanel from './AudioPanel';
import type { AudioAsset } from './audio';
import { scenePlaybackClips, useAudioPlayback } from './audioPlayback';
import { HEIGHT, WIDTH } from './scene';
import { placesIn, type PlaceOrganisation } from './placeFolders';
import { advanceSceneTime } from './timedScenes';
import { drawCreditsPreview } from './scenePreview';
import {
  CREDITS_MAX_DURATION, CREDITS_MAX_LINES, CREDITS_MAX_SPEED, CREDITS_MIN_DURATION, CREDITS_MIN_SPEED, CREDITS_MODES,
  CREDIT_HEADING_LIMIT, CREDIT_NAME_LIMIT, CREDIT_ROLE_LIMIT, creditsAsScene, newCredits, validateCredits,
  type CreditLine, type Credits, type CreditsLibrary, type CreditsMode,
} from './credits';

/** Lets the App confirm before discarding unsaved credit edits. */
export type CreditsLeaveGuard = (proceed: () => void, reason: string) => void;
type Props = { library: CreditsLibrary; places: PlaceOrganisation; issue: string | null; onSave: (next: CreditsLibrary) => boolean; audioAssets?: AudioAsset[]; leaveGuardRef?: React.MutableRefObject<CreditsLeaveGuard | null> };

const fmt = (time: number) => `${time.toFixed(1)}s`;
const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
const clone = (credits: Credits): Credits => structuredClone(credits);

/** Common headings offered as one-tap options so beginners need not invent labels. */
const headingSuggestions = ['Created by', 'Produced by', 'Characters', 'Voices', 'Music', 'Sound Effects', 'Places', 'Thanks to'];

export default function CreditsMaker({ library, places, issue, onSave, audioAssets = [], leaveGuardRef }: Props) {
  const readyPlaces = placesIn(places).filter(place => place.artworkAvailable && place.background);
  const placeIds = readyPlaces.map(place => place.id);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('Open a credits sequence or create a new one.');
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [room, setRoom] = useState<HTMLImageElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const audio = useAudioPlayback(scenePlaybackClips(credits ? creditsAsScene(credits).audio : undefined), audioAssets, time, playing, setMessage);
  const snapshot = (value: Credits) => JSON.stringify({ ...value, audio: undefined });
  const dirty = !!credits && snapshot(credits) !== savedSnapshot;
  const update = (change: (current: Credits) => Credits) => { setPlaying(false); setCredits(current => current ? change(current) : null); };
  const validation = credits ? validateCredits(credits, placeIds) : null;
  const problem = validation && typeof validation !== 'string' ? null : validation;

  useEffect(() => {
    if (!credits) return;
    let live = true;
    const place = readyPlaces.find(item => item.id === credits.placeId);
    if (!place?.background) { setRoom(null); return; }
    loadImage(place.background).then(image => { if (live) setRoom(image); }).catch(() => { if (live) setMessage('Place artwork could not load.'); });
    return () => { live = false; };
  }, [credits?.placeId, places]);

  useEffect(() => {
    if (!credits || !room || !canvas.current) return;
    const context = canvas.current.getContext('2d');
    if (!context) return;
    const scene = creditsAsScene(credits);
    drawCreditsPreview(context, scene, credits.title, credits.lines, credits.mode, credits.scrollSpeed, time, room);
  }, [credits, time, room]);

  useEffect(() => {
    if (!playing || !credits) return;
    let frame = 0, last = 0;
    const tick = (now: number) => {
      const elapsed = last ? (now - last) / 1000 : 0;
      last = now;
      if (elapsed > 0) setTime(value => { const next = advanceSceneTime(value, elapsed, credits.duration); if (next >= credits.duration) setPlaying(false); return next; });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, credits?.duration]);

  const openCredits = (next: Credits) => { setPlaying(false); setCredits(clone(next)); setSavedSnapshot(snapshot(next)); setTime(0); setSelectedLine(null); setMessage('Add your credit lines, then preview.'); };
  const save = () => {
    if (!credits) return;
    const result = validateCredits(credits, placeIds);
    if (typeof result === 'string') { setMessage(result); return; }
    const exists = library.credits.some(item => item.id === result.id);
    const next = { version: 1 as const, credits: exists ? library.credits.map(item => item.id === result.id ? result : item) : [...library.credits, result] };
    if (onSave(next)) { setSavedSnapshot(snapshot(result)); setMessage('Credits saved in this browser. Reuse them in any episode.'); }
    else setMessage('Credits could not be saved. Existing credits were kept.');
  };
  const changeLine = (id: string, patch: Partial<CreditLine>) => update(value => ({ ...value, lines: value.lines.map(line => line.id === id ? { ...line, ...patch } : line) }));
  const moveLine = (id: string, direction: -1 | 1) => update(value => {
    const index = value.lines.findIndex(line => line.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= value.lines.length) return value;
    const lines = [...value.lines];
    [lines[index], lines[target]] = [lines[target], lines[index]];
    return { ...value, lines };
  });
  const addLine = () => update(value => {
    if (value.lines.length >= CREDITS_MAX_LINES) return value;
    return { ...value, lines: [...value.lines, { id: crypto.randomUUID(), heading: '', name: '', role: '' }] };
  });
  const activeLine = credits?.lines.find(line => line.id === selectedLine) ?? null;

  // Guard against losing unsaved credit edits when leaving the section or the browser.
  const leaveGuard = useRef<CreditsLeaveGuard | null>(null);
  leaveGuard.current = (proceed, reason) => {
    if (!dirty) { proceed(); return; }
    if (window.confirm(`Leave without saving your credits changes?\n\nReason: ${reason}`)) proceed();
  };
  useEffect(() => {
    if (!leaveGuardRef) return;
    leaveGuardRef.current = leaveGuard.current;
    return () => { if (leaveGuardRef.current === leaveGuard.current) leaveGuardRef.current = null; };
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!credits) return <section className="scene-maker credits-maker"><div className="intro"><div><p className="eyebrow">CREDITS STUDIO</p><h1>Make your end credits.</h1><p>Who made it, who voiced it, what music played, and thanks.</p></div></div>
    {issue && <p role="alert" className="storage-alert">{issue}</p>}
    <button className="scene-primary" disabled={!!issue || readyPlaces.length === 0} onClick={() => openCredits(newCredits(readyPlaces[0].id))}>Create Credits</button>
    {readyPlaces.length === 0 && <p>No places with artwork are available. Add place artwork in Places first.</p>}
    <div className="scene-library">{library.credits.map(item => <article key={item.id}><h2>{item.name}</h2><p>{item.mode === 'scroll' ? 'Scrolling' : 'Static'} · {fmt(item.duration)} · {item.lines.length} credit lines</p><div className="scene-actions"><button onClick={() => openCredits(item)}>Open</button><button onClick={() => { openCredits({ ...clone(item), id: crypto.randomUUID(), name: `${item.name} copy` }); setSavedSnapshot(null); setMessage('Duplicate opened. Save to keep it.'); }}>Duplicate</button><button onClick={() => { if (window.confirm(`Delete “${item.name}”? This cannot be undone.`)) setMessage(onSave({ version: 1, credits: library.credits.filter(other => other.id !== item.id) }) ? 'Credits deleted.' : 'Could not delete credits.'); }}>Delete</button></div></article>)}</div>
    {library.credits.length === 0 && <p className="scene-empty">No credits yet. Create one to begin.</p>}<p role="status">{message}</p></section>;

  return <section className="scene-maker scene-visual credits-maker">
    <div className="scene-heading"><button onClick={() => { if (dirty && !window.confirm('Leave without saving your credits changes?')) return; setPlaying(false); setCredits(null); }}>← All credits</button><h1>{credits.name}</h1><span className={`episode-save-indicator ${dirty ? 'unsaved' : 'saved'}`}>{dirty ? 'Unsaved changes' : 'Saved'}</span><button className="scene-primary" disabled={!!issue || !!problem} onClick={save}>Save Credits</button></div>
    <div className="scene-setup">
      <label>Credits name<input aria-label="Credits name" maxLength={80} value={credits.name} onChange={event => update(value => ({ ...value, name: event.target.value }))} /></label>
      <label>On-screen title<input aria-label="Credits title" maxLength={120} value={credits.title} onChange={event => update(value => ({ ...value, title: event.target.value }))} /></label>
      <label>Style<select aria-label="Credits style" value={credits.mode} onChange={event => update(value => ({ ...value, mode: event.target.value as CreditsMode }))}>{Object.entries(CREDITS_MODES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Background<select aria-label="Credits background" value={credits.placeId} onChange={event => update(value => ({ ...value, placeId: event.target.value }))}>{readyPlaces.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
      <label>Length (seconds)<input aria-label="Credits duration" type="number" min={CREDITS_MIN_DURATION} max={CREDITS_MAX_DURATION} step="1" value={credits.duration} onChange={event => update(value => ({ ...value, duration: Number(event.target.value) }))} /></label>
      {credits.mode === 'scroll' && <label>Scroll speed<input aria-label="Credits scroll speed" type="number" min={CREDITS_MIN_SPEED} max={CREDITS_MAX_SPEED} step="0.2" value={credits.scrollSpeed} onChange={event => update(value => ({ ...value, scrollSpeed: Number(event.target.value) }))} /></label>}
    </div>
    <div className="scene-stage-main"><div className="scene-stage"><div className="scene-stage-caption"><strong>Credits preview</strong><span>{credits.mode === 'scroll' ? 'Scrolling credits' : 'Static credits'} · {credits.lines.length} lines</span></div><canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label="Credits preview stage" />
      <div className="scene-playback"><button onClick={() => { if (!playing) audio.startAt(time); setPlaying(value => !value); }} disabled={!!problem || time >= credits.duration && !playing}>{playing ? 'Pause' : 'Play'}</button><button onClick={() => { setPlaying(false); setTime(0); }}>Restart</button><strong>{fmt(time)} / {fmt(credits.duration)}</strong></div></div>
      <aside className="scene-director credits-director"><h2>Credit lines</h2>
        <div className="credit-line-list">{credits.lines.map((line, index) => <button key={line.id} className={selectedLine === line.id ? 'active' : ''} onClick={() => setSelectedLine(line.id)} aria-pressed={selectedLine === line.id}><span>{line.heading || line.name || `Line ${index + 1}`}</span><small>{line.role || line.name ? [line.name, line.role].filter(Boolean).join(' · ') : 'Empty'}</small></button>)}</div>
        <button className="scene-primary" onClick={addLine} disabled={credits.lines.length >= CREDITS_MAX_LINES}>+ Add credit line</button>
        {activeLine && <div className="credit-line-editor">
          <label>Heading<input aria-label="Credit heading" maxLength={CREDIT_HEADING_LIMIT} value={activeLine.heading} onChange={event => changeLine(activeLine.id, { heading: event.target.value })} /></label>
          <div className="credit-heading-suggestions">{headingSuggestions.map(item => <button key={item} onClick={() => changeLine(activeLine.id, { heading: item })}>{item}</button>)}</div>
          <label>Name<input aria-label="Credit name" maxLength={CREDIT_NAME_LIMIT} value={activeLine.name} onChange={event => changeLine(activeLine.id, { name: event.target.value })} /></label>
          <label>Role or detail<input aria-label="Credit role" maxLength={CREDIT_ROLE_LIMIT} value={activeLine.role} onChange={event => changeLine(activeLine.id, { role: event.target.value })} /></label>
          <div className="credit-line-actions"><button onClick={() => moveLine(activeLine.id, -1)}>Move up</button><button onClick={() => moveLine(activeLine.id, 1)}>Move down</button><button onClick={() => { update(value => ({ ...value, lines: value.lines.filter(line => line.id !== activeLine.id) })); setSelectedLine(null); }}>Remove line</button></div>
        </div>}
        {!activeLine && <p className="director-tip">Choose a credit line above to edit it, or add a new one.</p>}
      </aside></div>
    <AudioPanel label="Credits" clips={credits.audio ?? []} assets={audioAssets} duration={credits.duration} time={time} onChange={clips => update(value => ({ ...value, audio: clips }))} onSeek={value => { setPlaying(false); setTime(value); }} />
    {problem && <p role="alert" className="storage-alert">{problem}</p>}<p role="status" className="scene-status">{message}</p>
  </section>;
}
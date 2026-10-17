import { useEffect, useRef, useState } from 'react';
import type { AudioAsset } from './audio';
import { INSTRUMENT_NAMES, INSTRUMENTS, noteName, type InstrumentId } from './instruments';
import { effectDuration, peakOf, renderEffect, renderMusic, renderNotePreview } from './musicRender';
import { wavBlob } from './wav';
import { renderEffectToAsset, renderMusicToAsset } from './musicAssets';
import {
  applyDrumPattern, applyStarter, BEATS_PER_BAR, clampNote, DRUM_PATTERN_NAMES, EFFECT_PRESET_NAMES, EFFECT_PRESETS,
  MUSIC_BARS_MAX, MUSIC_BARS_MIN, MUSIC_MAX_TRACKS, MUSIC_TEMPO_MAX, MUSIC_TEMPO_MIN, newEffect, newMusicProject, newTrack,
  projectSeconds, snapToStep, STARTER_NAMES, trackIsAudible, type EffectPreset, type EffectProject, type MusicProject, type Note, type StudioProjects, type Track,
} from './musicProject';
import { PlayButton } from './previewPlayer';

type Tab = 'music' | 'effects';
type Props = {
  projects: StudioProjects;
  issue: string | null;
  audioAssets: AudioAsset[];
  onSaveProjects: (next: StudioProjects) => boolean;
  onAddAsset: (asset: AudioAsset) => void;
};

const BEAT_WIDTH = 46;
const ROW_HEIGHT = 18;
// The visible window must include the drum range (MIDI 36-51), otherwise a
// drum pattern is placed off-canvas and looks empty.
const LOW_PITCH = 36;
const HIGH_PITCH = 84;
const ROWS = HIGH_PITCH - LOW_PITCH + 1;
const ROLL_HEIGHT = ROWS * ROW_HEIGHT;
const LABEL_WIDTH = 54;
const NOTE_MIN = 0.25;

const fmt = (seconds: number) => `${seconds.toFixed(1)}s`;
const rollWidth = (project: MusicProject) => LABEL_WIDTH + project.bars * BEATS_PER_BAR * BEAT_WIDTH + 60;
const beatFromX = (x: number, project: MusicProject) => Math.max(0, Math.min(project.bars * BEATS_PER_BAR - NOTE_MIN, snapToStep((x - LABEL_WIDTH) / BEAT_WIDTH)));
const pitchFromY = (y: number) => Math.max(LOW_PITCH, Math.min(HIGH_PITCH, HIGH_PITCH - Math.floor(y / ROW_HEIGHT)));

/** Small note preview using the same HTMLAudioElement the Studio already uses. */
function useNoteAudition() {
  const [busy, setBusy] = useState(false);
  const run = async (instrument: InstrumentId, pitch: number) => {
    setBusy(true);
    try {
      const result = await renderNotePreview(instrument, pitch);
      const url = URL.createObjectURL(wavBlob(result.channels, result.sampleRate));
      const element = new Audio(url);
      element.volume = 0.6;
      try { await element.play(); } catch { /* preview is best effort */ }
      setTimeout(() => { URL.revokeObjectURL(url); }, 1200);
    } finally { setBusy(false); }
  };
  return { busy, run };
}

export default function MusicStudio({ projects, issue, audioAssets, onSaveProjects, onAddAsset }: Props) {
  const [tab, setTab] = useState<Tab>('music');
  const [openMusic, setOpenMusic] = useState<MusicProject | null>(null);
  const [openEffect, setOpenEffect] = useState<EffectProject | null>(null);
  const [message, setMessage] = useState('Open a song or a sound effect, or create one.');
  const audition = useNoteAudition();

  const changeMusic = (change: (current: MusicProject) => MusicProject) => setOpenMusic(current => current ? change(current) : null);
  const changeEffect = (change: (current: EffectProject) => EffectProject) => setOpenEffect(current => current ? change(current) : null);

  const saveMusic = () => {
    if (!openMusic) return;
    const exists = projects.music.some(item => item.id === openMusic.id);
    const next = { ...projects, music: exists ? projects.music.map(item => item.id === openMusic.id ? openMusic : item) : [...projects.music, openMusic] };
    setMessage(onSaveProjects(next) ? 'Song saved. You can reopen and edit it any time.' : 'Song could not be saved. Existing songs were kept.');
  };
  const saveEffect = () => {
    if (!openEffect) return;
    const exists = projects.effects.some(item => item.id === openEffect.id);
    const next = { ...projects, effects: exists ? projects.effects.map(item => item.id === openEffect.id ? openEffect : item) : [...projects.effects, openEffect] };
    setMessage(onSaveProjects(next) ? 'Sound effect saved.' : 'Sound effect could not be saved. Existing effects were kept.');
  };

  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState<{ name: string; peak: number; duration: number } | null>(null);
  const renderToLibrary = async (project: MusicProject) => {
    if (!project.tracks.some(track => track.notes.length)) { setMessage('Add some notes before rendering. Try a starter melody.'); return; }
    setRendering(true);
    try {
      const asset = await renderMusicToAsset(project);
      const check = await renderMusic(project);
      const peak = peakOf(check.channels);
      if (peak < 0.001) { setMessage('That render was silent. Check every track is unmuted and has notes.'); return; }
      onAddAsset(asset);
      setRendered({ name: asset.name, peak, duration: asset.duration });
      setMessage(`“${asset.name}” added to your Audio Library. Use it in any scene, intro or credits.`);
    } catch {
      setMessage('The song could not be rendered in this browser.');
    } finally { setRendering(false); }
  };
  const renderEffectToLibrary = async (effect: EffectProject) => {
    setRendering(true);
    try {
      const asset = await renderEffectToAsset(effect);
      const check = await renderEffect(effect);
      const peak = peakOf(check.channels);
      if (peak < 0.001) { setMessage('That effect was silent. Try a different preset or volume.'); return; }
      onAddAsset(asset);
      setRendered({ name: asset.name, peak, duration: asset.duration });
      setMessage(`“${asset.name}” added to your Audio Library.`);
    } catch {
      setMessage('The sound effect could not be rendered in this browser.');
    } finally { setRendering(false); }
  };

  return <section className="music-studio">
    <div className="intro"><div><p className="eyebrow">MUSIC &amp; SOUND STUDIO</p><h1>Make your own music and sounds.</h1><p>Everything stays on this device. Finished songs go straight into your Audio Library.</p></div></div>
    {issue && <p role="alert" className="storage-alert">{issue}</p>}
    <div className="music-tabs"><button className={tab === 'music' ? 'active' : ''} onClick={() => setTab('music')}>Music Maker</button><button className={tab === 'effects' ? 'active' : ''} onClick={() => setTab('effects')}>Sound Effects</button></div>
    {tab === 'music'
      ? <MusicMaker projects={projects} open={openMusic} change={changeMusic} setOpen={setOpenMusic} save={saveMusic} message={setMessage} renderToLibrary={renderToLibrary} rendering={rendering} rendered={rendered} audioAssets={audioAssets} audition={audition} onSaveProjects={onSaveProjects} />
      : <EffectsMaker projects={projects} open={openEffect} change={changeEffect} setOpen={setOpenEffect} save={saveEffect} message={setMessage} renderToLibrary={renderEffectToLibrary} rendering={rendering} rendered={rendered} onSaveProjects={onSaveProjects} />}
    <p role="status" className="scene-status">{message}</p>
  </section>;
}

type MusicMakerProps = {
  projects: StudioProjects;
  open: MusicProject | null;
  change: (change: (current: MusicProject) => MusicProject) => void;
  setOpen: (project: MusicProject | null) => void;
  save: () => void;
  message: (text: string) => void;
  renderToLibrary: (project: MusicProject) => void;
  rendering: boolean;
  rendered: { name: string; peak: number; duration: number } | null;
  audioAssets: AudioAsset[];
  audition: { busy: boolean; run: (instrument: InstrumentId, pitch: number) => void };
  onSaveProjects: (next: StudioProjects) => boolean;
};

function MusicMaker({ projects, open, change, setOpen, save, message, renderToLibrary, rendering, rendered, audioAssets, audition, onSaveProjects }: MusicMakerProps) {
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [playing, setPlaying] = useState<MusicProject | null>(null);
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; x: number; y: number; base: Note } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const roll = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => { const element = player.current; if (element) { element.pause(); element.removeAttribute('src'); } }, []);

  const track = open?.tracks.find(item => item.id === selectedTrack) ?? open?.tracks[0] ?? null;
  useEffect(() => { setSelectedTrack(open?.tracks[0]?.id ?? null); setSelectedNote(null); }, [open?.id]);

  const duration = open ? projectSeconds(open) : 0;

  // Preview plays the same rendered WAV that gets saved, through an HTMLAudioElement.
  const play = async () => {
    if (!open || !open.tracks.some(item => item.notes.length)) { message('Add some notes first. Try a starter melody.'); return; }
    setPlaying(open);
    try {
      const result = await renderMusic(open);
      const url = URL.createObjectURL(wavBlob(result.channels, result.sampleRate));
      const element = new Audio(url);
      element.loop = open.loop;
      player.current?.pause();
      player.current = element;
      try { await element.play(); } catch { message('Playback was blocked. Press Play again after clicking the page.'); }
      element.onended = () => { if (!open.loop) setPlaying(null); URL.revokeObjectURL(url); };
    } catch { message('This song could not be previewed in this browser.'); }
  };
  const stop = () => { player.current?.pause(); setPlaying(null); };

  const draw = () => {
    const element = canvas.current;
    if (!element || !open) return;
    const context = element.getContext('2d');
    if (!context) return;
    const width = rollWidth(open);
    context.clearRect(0, 0, width, ROLL_HEIGHT);
    context.fillStyle = '#fbfaff';
    context.fillRect(0, 0, width, ROLL_HEIGHT);
    // Bar and beat guides.
    for (let beat = 0; beat <= open.bars * BEATS_PER_BAR; beat++) {
      const x = LABEL_WIDTH + beat * BEAT_WIDTH;
      context.strokeStyle = beat % BEATS_PER_BAR === 0 ? '#c9c2ea' : '#eae7f6';
      context.lineWidth = beat % BEATS_PER_BAR === 0 ? 2 : 1;
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, ROLL_HEIGHT); context.stroke();
    }
    // Pitch labels, and clicking one auditions that note.
    context.font = '11px Segoe UI';
    for (let pitch = LOW_PITCH; pitch <= HIGH_PITCH; pitch++) {
      const y = (HIGH_PITCH - pitch) * ROW_HEIGHT;
      if (pitch % 12 === 0) {
        context.fillStyle = '#f2f0fb';
        context.fillRect(0, y, width, ROW_HEIGHT);
        context.fillStyle = '#55527a';
        context.fillText(noteName(pitch), 6, y + 13);
      }
      context.strokeStyle = '#f0eef8';
      context.beginPath(); context.moveTo(0, y + ROW_HEIGHT - 0.5); context.lineTo(width, y + ROW_HEIGHT - 0.5); context.stroke();
    }
    if (!track) return;
    // Existing notes, dimmed when another track is selected.
    for (const other of open.tracks) {
      if (other.id !== track.id) {
        context.fillStyle = 'rgba(112, 91, 223, .18)';
        for (const n of other.notes) context.fillRect(LABEL_WIDTH + n.start * BEAT_WIDTH, (HIGH_PITCH - n.pitch) * ROW_HEIGHT + 2, n.duration * BEAT_WIDTH - 2, ROW_HEIGHT - 4);
      }
    }
    for (const n of track.notes) {
      const x = LABEL_WIDTH + n.start * BEAT_WIDTH;
      const y = (HIGH_PITCH - n.pitch) * ROW_HEIGHT;
      const isSelected = n.id === selectedNote;
      context.fillStyle = isSelected ? '#4b3fb8' : '#705bdf';
      context.fillRect(x, y + 2, Math.max(4, n.duration * BEAT_WIDTH - 2), ROW_HEIGHT - 4);
      // Velocity is shown as bar brightness, so quiet notes are visibly quiet.
      context.fillStyle = 'rgba(255,255,255,.45)';
      context.fillRect(x, y + 2, Math.max(2, (n.duration * BEAT_WIDTH - 2) * n.velocity), 3);
      if (isSelected) {
        context.strokeStyle = '#2b2160'; context.lineWidth = 2;
        context.strokeRect(x, y + 2, Math.max(4, n.duration * BEAT_WIDTH - 2), ROW_HEIGHT - 4);
      }
    }
  };

  useEffect(() => { draw(); }, [open, track?.id, selectedNote]);
  // Bring the selected track's notes into view, so a drum track is never hidden below the fold.
  const noteCount = track?.notes.length ?? 0;
  useEffect(() => {
    const box = roll.current;
    if (!box || !track || !track.notes.length) return;
    const highestPitch = Math.max(...track.notes.map(n => n.pitch));
    const y = (HIGH_PITCH - highestPitch) * ROW_HEIGHT;
    box.scrollTop = Math.max(0, y - ROW_HEIGHT * 4);
  }, [track?.id, noteCount, open?.id]);

  if (!open) return <div className="music-library">
    <button className="scene-primary" onClick={() => { setOpen(newMusicProject()); message('Add a track, pick an instrument, then try a starter melody.'); }}>+ Create a song</button>
    <div className="scene-library">{projects.music.map(item => <article key={item.id}><h2>{item.name}</h2><p>{item.tempo} BPM · {item.bars} bars · {item.tracks.length} tracks · {item.tracks.reduce((sum, t) => sum + t.notes.length, 0)} notes</p><div className="scene-actions">
      <button onClick={() => setOpen(structuredClone(item))}>Open</button>
      <button onClick={() => { const copy = { ...structuredClone(item), id: crypto.randomUUID(), name: `${item.name} copy` }; if (onSaveProjects({ ...projects, music: [...projects.music, copy] })) message('Song duplicated.'); }}>Duplicate</button>
      <button onClick={() => { if (window.confirm(`Delete “${item.name}”?`)) message(onSaveProjects({ ...projects, music: projects.music.filter(other => other.id !== item.id) }) ? 'Song deleted.' : 'Could not delete the song.'); }}>Delete</button>
    </div></article>)}</div>
    {projects.music.length === 0 && <p className="scene-empty">No songs yet. Create one to begin.</p>}
  </div>;

  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!track) return;
    const box = event.currentTarget.getBoundingClientRect();
    const scale = rollWidth(open) / box.width;
    const x = (event.clientX - box.left) * scale;
    const y = (event.clientY - box.top) * (ROLL_HEIGHT / box.height);
    if (x < LABEL_WIDTH) {
      const pitch = pitchFromY(y);
      audition.run(track.instrument, pitch);
      message(`${noteName(pitch)} on ${INSTRUMENT_NAMES[track.instrument]}.`);
      return;
    }
    const hit = [...track.notes].reverse().find(n => {
      const nx = LABEL_WIDTH + n.start * BEAT_WIDTH;
      return x >= nx && x <= nx + n.duration * BEAT_WIDTH && Math.abs(y - (HIGH_PITCH - n.pitch) * ROW_HEIGHT) < ROW_HEIGHT;
    });
    if (hit) {
      const onEdge = x >= LABEL_WIDTH + (hit.start + hit.duration) * BEAT_WIDTH - 6;
      setSelectedNote(hit.id);
      drag.current = { id: hit.id, mode: onEdge ? 'resize' : 'move', x: event.clientX, y: event.clientY, base: { ...hit } };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    // Empty space adds a note, which is the fastest way for a beginner to start.
    const pitch = pitchFromY(y);
    const created: Note = { id: crypto.randomUUID(), pitch, start: beatFromX(x, open), duration: 1, velocity: 0.8 };
    change(value => ({ ...value, tracks: value.tracks.map(item => item.id === track.id ? { ...item, notes: [...item.notes, clampNote(created, value.bars)] } : item) }));
    setSelectedNote(created.id);
    message(`Added ${noteName(pitch)}. Drag to move, drag the right edge to shorten, press Delete to remove.`);
  };
  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = drag.current;
    if (!state || !track) return;
    const beatDelta = Math.round(((event.clientX - state.x) / BEAT_WIDTH) * 4) / 4;
    change(value => ({ ...value, tracks: value.tracks.map(item => item.id === track.id ? {
      ...item,
      notes: item.notes.map(n => n.id === state.id
        ? clampNote(state.mode === 'move' ? { ...n, start: state.base.start + beatDelta, pitch: state.base.pitch } : { ...n, duration: state.base.duration + beatDelta }, value.bars)
        : n),
    } : item) }));
  };
  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const deleteSelected = () => {
    if (!track || !selectedNote) return;
    change(value => ({ ...value, tracks: value.tracks.map(item => item.id === track.id ? { ...item, notes: item.notes.filter(n => n.id !== selectedNote) } : item) }));
    setSelectedNote(null);
    message('Note removed.');
  };

  const selectedNoteData = track?.notes.find(n => n.id === selectedNote) ?? null;
  const savedAsset = rendered && audioAssets.some(asset => asset.name === rendered.name);

  return <>
    <div className="scene-heading"><button onClick={() => { stop(); setOpen(null); }}>← All songs</button><h1>{open.name}</h1><button className="scene-primary" onClick={save}>Save Song</button><button className="scene-primary" disabled={rendering} onClick={() => renderToLibrary(open)}>{rendering ? 'Rendering…' : 'Add to Audio Library'}</button></div>
    <div className="music-setup">
      <label>Song name<input aria-label="Song name" maxLength={80} value={open.name} onChange={event => change(value => ({ ...value, name: event.target.value }))} /></label>
      <label>Tempo (BPM)<input aria-label="Song tempo" type="number" min={MUSIC_TEMPO_MIN} max={MUSIC_TEMPO_MAX} step="1" value={open.tempo} onChange={event => change(value => ({ ...value, tempo: Math.max(MUSIC_TEMPO_MIN, Math.min(MUSIC_TEMPO_MAX, Number(event.target.value))) }))} /></label>
      <label>Bars<input aria-label="Song bars" type="number" min={MUSIC_BARS_MIN} max={MUSIC_BARS_MAX} step="1" value={open.bars} onChange={event => change(value => ({ ...value, bars: Math.max(MUSIC_BARS_MIN, Math.min(MUSIC_BARS_MAX, Number(event.target.value))) }))} /></label>
      <label>Master volume<input aria-label="Master volume" type="range" min="0" max="1" step="0.05" value={open.masterVolume} onChange={event => change(value => ({ ...value, masterVolume: Number(event.target.value) }))} /><span>{Math.round(open.masterVolume * 100)}%</span></label>
      <label className="music-toggle">Loop<input aria-label="Loop song" type="checkbox" checked={open.loop} onChange={event => change(value => ({ ...value, loop: event.target.checked }))} /></label>
    </div>
    <div className="music-transport"><PlayButton playing={!!playing} onPlay={play} onStop={stop} /><strong>{fmt(duration)}</strong><span>{playing ? 'Playing preview' : `Loops for ${open.bars} bars`}</span></div>
    <div className="music-tracks">
      <div className="music-track-list">
        <h2>Tracks</h2>
        {open.tracks.map(item => <div key={item.id} className={`music-track-row ${item.id === track?.id ? 'active' : ''} ${trackIsAudible(open.tracks, item) ? '' : 'silenced'}`}>
          <button className="music-track-name" onClick={() => setSelectedTrack(item.id)}>{item.name}<small>{INSTRUMENT_NAMES[item.instrument]} · {item.notes.length} notes{trackIsAudible(open.tracks, item) ? '' : ' · muted'}</small></button>
          <label>Vol<input aria-label={`${item.name} volume`} type="range" min="0" max="1" step="0.05" value={item.volume} onChange={event => change(value => ({ ...value, tracks: value.tracks.map(t => t.id === item.id ? { ...t, volume: Number(event.target.value) } : t) }))} /></label>
          <label>Pan<input aria-label={`${item.name} pan`} type="range" min="-1" max="1" step="0.1" value={item.pan} onChange={event => change(value => ({ ...value, tracks: value.tracks.map(t => t.id === item.id ? { ...t, pan: Number(event.target.value) } : t) }))} /></label>
          <button aria-pressed={item.muted} onClick={() => change(value => ({ ...value, tracks: value.tracks.map(t => t.id === item.id ? { ...t, muted: !t.muted } : t) }))}>M</button>
          <button aria-pressed={item.solo} onClick={() => change(value => ({ ...value, tracks: value.tracks.map(t => t.id === item.id ? { ...t, solo: !t.solo } : t) }))}>S</button>
          <button onClick={() => { if (window.confirm(`Remove track “${item.name}” and its notes?`)) { change(value => ({ ...value, tracks: value.tracks.filter(t => t.id !== item.id) })); if (selectedTrack === item.id) setSelectedTrack(null); } }}>×</button>
        </div>)}
        <div className="music-add-track">
          <select aria-label="New track instrument" value="" onChange={event => { const instrument = event.target.value as InstrumentId; if (!instrument) return; const created = newTrack(instrument, INSTRUMENT_NAMES[instrument]); change(value => value.tracks.length >= MUSIC_MAX_TRACKS ? value : { ...value, tracks: [...value.tracks, created] }); setSelectedTrack(created.id); event.currentTarget.value = ''; }}>
            <option value="">Add a track…</option>{INSTRUMENTS.map(instrument => <option key={instrument} value={instrument}>{INSTRUMENT_NAMES[instrument]}</option>)}
          </select>
          {track && <>
            <div className="music-starters">
              <span>Starter melody:</span>{STARTER_NAMES.map(name => <button key={name} onClick={() => { const notes = applyStarter(track, name); change(value => ({ ...value, tracks: value.tracks.map(t => t.id === track.id ? { ...t, notes } : t) })); setSelectedNote(null); message(`Added “${name}”. Click empty space to add more notes.`); }}>{name}</button>)}
            </div>
            {track.instrument === 'drums' && <div className="music-starters"><span>Drum pattern:</span>{DRUM_PATTERN_NAMES.map(name => <button key={name} onClick={() => { const notes = applyDrumPattern(track, name); change(value => ({ ...value, tracks: value.tracks.map(t => t.id === track.id ? { ...t, notes } : t) })); setSelectedNote(null); message(`Added “${name}”.`); }}>{name}</button>)}</div>}
          </>}
        </div>
      </div>
      <div className="piano-roll-wrap">
        <div className="piano-roll-scroll" ref={roll}><canvas ref={canvas} width={rollWidth(open)} height={ROLL_HEIGHT} style={{ width: rollWidth(open), height: ROLL_HEIGHT }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label="Piano roll note editor" /></div>
        <p className="music-hint">Click empty space to add a note · drag a note to move it · drag the right edge to change length · click a note name on the left to hear it · {open.bars * BEATS_PER_BAR} beats at {open.tempo} BPM</p>
      </div>
    </div>
    {selectedNoteData && track && <div className="music-note-editor">
      <strong>{noteName(selectedNoteData.pitch)}</strong>
      <label>Length<input aria-label="Note length" type="number" min="0.25" max="16" step="0.25" value={selectedNoteData.duration} onChange={event => change(value => ({ ...value, tracks: value.tracks.map(t => t.id === track.id ? { ...t, notes: t.notes.map(n => n.id === selectedNoteData.id ? { ...n, duration: Number(event.target.value) } : n) } : t) }))} /></label>
      <label>Velocity<input aria-label="Note velocity" type="range" min="0.05" max="1" step="0.05" value={selectedNoteData.velocity} onChange={event => change(value => ({ ...value, tracks: value.tracks.map(t => t.id === track.id ? { ...t, notes: t.notes.map(n => n.id === selectedNoteData.id ? { ...n, velocity: Number(event.target.value) } : n) } : t) }))} /><span>{Math.round(selectedNoteData.velocity * 100)}%</span></label>
      <button onClick={deleteSelected}>Delete note</button>
    </div>}
    {rendered && <p className="music-render-result">Last render: <strong>{rendered.name}</strong> · {fmt(rendered.duration)} · peak {rendered.peak.toFixed(2)}{savedAsset ? ' · in your Audio Library' : ''}</p>}
  </>;
}

type EffectsProps = {
  projects: StudioProjects;
  open: EffectProject | null;
  change: (change: (current: EffectProject) => EffectProject) => void;
  setOpen: (project: EffectProject | null) => void;
  save: () => void;
  message: (text: string) => void;
  renderToLibrary: (effect: EffectProject) => void;
  rendering: boolean;
  rendered: { name: string; peak: number; duration: number } | null;
  onSaveProjects: (next: StudioProjects) => boolean;
};

function EffectsMaker({ projects, open, change, setOpen, save, message, renderToLibrary, rendering, rendered, onSaveProjects }: EffectsProps) {
  const [auditioning, setAuditioning] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { const element = player.current; if (element) { element.pause(); element.removeAttribute('src'); } }, []);

  const preview = async () => {
    if (!open) return;
    setAuditioning(true);
    try {
      const result = await renderEffect(open);
      const url = URL.createObjectURL(wavBlob(result.channels, result.sampleRate));
      const element = new Audio(url);
      player.current?.pause();
      player.current = element;
      try { await element.play(); } catch { message('Playback was blocked. Press Preview again after clicking the page.'); }
      element.onended = () => URL.revokeObjectURL(url);
    } catch { message('This effect could not be previewed in this browser.'); }
    finally { setAuditioning(false); }
  };

  if (!open) return <div className="music-library">
    <button className="scene-primary" onClick={() => { setOpen(newEffect()); message('Choose a preset, then press Preview.'); }}>+ Create a sound effect</button>
    <div className="scene-library">{projects.effects.map(item => <article key={item.id}><h2>{item.name}</h2><p>{EFFECT_PRESET_NAMES[item.preset]} · {item.duration.toFixed(1)}s</p><div className="scene-actions">
      <button onClick={() => setOpen(structuredClone(item))}>Open</button>
      <button onClick={() => { const copy = { ...structuredClone(item), id: crypto.randomUUID(), name: `${item.name} copy` }; if (onSaveProjects({ ...projects, effects: [...projects.effects, copy] })) message('Sound effect duplicated.'); }}>Duplicate</button>
      <button onClick={() => { if (window.confirm(`Delete “${item.name}”?`)) message(onSaveProjects({ ...projects, effects: projects.effects.filter(other => other.id !== item.id) }) ? 'Sound effect deleted.' : 'Could not delete the effect.'); }}>Delete</button>
    </div></article>)}</div>
    {projects.effects.length === 0 && <p className="scene-empty">No sound effects yet. Create one to begin.</p>}
  </div>;

  return <>
    <div className="scene-heading"><button onClick={() => { player.current?.pause(); setOpen(null); }}>← All effects</button><h1>{open.name}</h1><button className="scene-primary" onClick={save}>Save Effect</button><button className="scene-primary" disabled={rendering} onClick={() => renderToLibrary(open)}>{rendering ? 'Rendering…' : 'Add to Audio Library'}</button></div>
    <div className="music-setup">
      <label>Name<input aria-label="Effect name" maxLength={80} value={open.name} onChange={event => change(value => ({ ...value, name: event.target.value }))} /></label>
      <label>Sound<select aria-label="Effect preset" value={open.preset} onChange={event => change(value => ({ ...value, preset: event.target.value as EffectPreset }))}>{EFFECT_PRESETS.map(preset => <option key={preset} value={preset}>{EFFECT_PRESET_NAMES[preset]}</option>)}</select></label>
      <label>Pitch<input aria-label="Effect pitch" type="range" min="-12" max="12" step="1" value={open.pitch} onChange={event => change(value => ({ ...value, pitch: Number(event.target.value) }))} /><span>{open.pitch > 0 ? `+${open.pitch}` : open.pitch}</span></label>
      <label>Length (s)<input aria-label="Effect duration" type="number" min="0.1" max="4" step="0.1" value={open.duration} onChange={event => change(value => ({ ...value, duration: Number(event.target.value) }))} /></label>
      <label>Volume<input aria-label="Effect volume" type="range" min="0" max="1" step="0.05" value={open.volume} onChange={event => change(value => ({ ...value, volume: Number(event.target.value) }))} /><span>{Math.round(open.volume * 100)}%</span></label>
      <label>Tail<input aria-label="Effect decay" type="range" min="0" max="1" step="0.05" value={open.decay} onChange={event => change(value => ({ ...value, decay: Number(event.target.value) }))} /><span>{Math.round(open.decay * 100)}%</span></label>
      <label className="music-toggle">Add noise<input aria-label="Effect noise" type="checkbox" checked={open.noise} onChange={event => change(value => ({ ...value, noise: event.target.checked }))} /></label>
    </div>
    <div className="music-transport"><PlayButton playing={auditioning} onPlay={preview} onStop={() => player.current?.pause()} /><strong>{effectDuration(open).toFixed(1)}s</strong><span>{EFFECT_PRESET_NAMES[open.preset]}</span></div>
    {rendered && <p className="music-render-result">Last render: <strong>{rendered.name}</strong> · {rendered.duration.toFixed(1)}s · peak {rendered.peak.toFixed(2)}</p>}
  </>;
}
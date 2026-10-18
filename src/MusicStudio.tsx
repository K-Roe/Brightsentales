import { useEffect, useRef, useState } from 'react';
import type { AudioAsset } from './audio';
import { INSTRUMENTS, INSTRUMENT_NAMES, type InstrumentId } from './instruments';
import { effectDuration, peakOf, renderEffect, renderMusic } from './musicRender';
import { renderEffectToAsset, renderMusicToAsset } from './musicAssets';
import {
  applyDrumPattern, applyStarter, BEATS_PER_BAR, clampNote, DRUM_PATTERN_NAMES, EFFECT_PRESET_NAMES, EFFECT_PRESETS,
  MUSIC_BARS_MAX, MUSIC_BARS_MIN, MUSIC_MAX_TRACKS, MUSIC_TEMPO_MAX, MUSIC_TEMPO_MIN, newEffect, newMusicProject, newTrack,
  projectSeconds, snapToStep, STARTER_NAMES, trackIsAudible, type EffectPreset, type EffectProject, type MusicProject, type Note, type StudioProjects, type Track,
} from './musicProject';
import {
  BEGINNER_STEPS, DRUM_NAMES, DRUM_PATTERN_BLURBS, EFFECT_BLURBS, EFFECT_COLOURS, EFFECT_ICONS, Icon, INSTRUMENT_BLURBS, INSTRUMENT_COLOURS,
  INSTRUMENT_ICONS, noteLabel, STARTER_BLURBS, zoomById, ZOOM_LEVELS, type MusicTheme, type ZoomId,
} from './musicDesign';
import { PlayButton, playEffectPreview, useMusicPreview } from './previewPlayer';
import { emptyNoteHistory, recordNoteEdit, stepNoteHistory, type NoteHistory } from './musicNoteHistory';
import { beginnerPitchName, MUSIC_SCALES, pitchInScale, type MusicScale } from './musicGuidance';
import { useNoteAudition } from './useNoteAudition';

type Tab = 'music' | 'effects';
type RenderedInfo = { kind: Tab; name: string; peak: number; duration: number };
type Props = {
  projects: StudioProjects;
  issue: string | null;
  audioAssets: AudioAsset[];
  onSaveProjects: (next: StudioProjects) => boolean;
  onAddAsset: (asset: AudioAsset) => void;
  theme: MusicTheme;
  onThemeChange: (theme: MusicTheme) => void;
};

const KEY_WIDTH = 96;
const LOW_PITCH = 36;
const HIGH_PITCH = 84;
const ROWS = HIGH_PITCH - LOW_PITCH + 1;
const NOTE_MIN = 0.25;
const DRUM_RANGE = [36, 51];

const fmt = (seconds: number) => `${seconds.toFixed(1)}s`;
const isDrumInstrument = (instrument: InstrumentId) => instrument === 'drums';

/* -------------------------------------------------------------------------- */
/* Shared shell                                                               */
/* -------------------------------------------------------------------------- */

function StudioShell({ children }: { children: React.ReactNode }) {
  return <div className="music-studio">
    <div className="music-studio-top">
      <div className="music-studio-brand">
        <span className="music-studio-mark" aria-hidden="true">♪</span>
        <div><p className="eyebrow">BRIGHTTALES STUDIO</p><h1>Make your own music &amp; sounds</h1></div>
      </div>
    </div>
    {children}
  </div>;
}

/* -------------------------------------------------------------------------- */
/* Music Maker                                                                */
/* -------------------------------------------------------------------------- */

function MusicMaker({
  projects, open, change, setOpen, save, message, renderToLibrary, rendering, rendered, audioAssets, onSaveProjects, theme,
}: {
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
  onSaveProjects: (next: StudioProjects) => boolean;
  theme: MusicTheme;
}) {
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [zoom, setZoom] = useState<ZoomId>('normal');
  const [beginnerMode, setBeginnerMode] = useState(true);
  const [musicScale, setMusicScale] = useState<MusicScale>('C major');
  const [keyboardPitch, setKeyboardPitch] = useState(60);
  const [expandedTracks, setExpandedTracks] = useState<string[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const history = useRef<NoteHistory>(emptyNoteHistory());
  const openRef = useRef(open);
  openRef.current = open;
  const [confirming, setConfirming] = useState<{ kind: 'starter' | 'pattern'; name: string } | null>(null);
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; x: number; y: number; base: Note; before: Note[]; trackId: string; lastPreviewPitch: number; lastPreviewAt: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const roll = useRef<HTMLDivElement>(null);

  const scale = zoomById(zoom);
  const preview = useMusicPreview(open, message);
  const notePreview = useNoteAudition();
  const track = open?.tracks.find(item => item.id === selectedTrack) ?? open?.tracks[0] ?? null;
  const noteCount = track?.notes.length ?? 0;

  useEffect(() => { setSelectedTrack(open?.tracks[0]?.id ?? null); setSelectedNote(null); setExpandedTracks([]); history.current = emptyNoteHistory(); setHistoryVersion(v => v + 1); }, [open?.id]);
  useEffect(() => {
    const saved = projects.music.find(item => item.id === open?.id);
    setSavedSnapshot(saved ? JSON.stringify(saved) : null);
  }, [open?.id, projects.music]);
  const dirty = !!open && (savedSnapshot === null || JSON.stringify(open) !== savedSnapshot);

  const beats = open ? open.bars * BEATS_PER_BAR : 16;
  const rollWidth = KEY_WIDTH + beats * scale.beat + 40;
  const rollHeight = ROWS * scale.row;
  const duration = open ? projectSeconds(open) : 0;
  const progress = preview.duration > 0 ? Math.min(1, preview.position / preview.duration) : 0;
  const activeColour = track ? INSTRUMENT_COLOURS[track.instrument] : '#9d8bff';
  const editNotes = (trackId: string, notes: Note[], label: string) => {
    const current = openRef.current;
    const before = current?.tracks.find(item => item.id === trackId)?.notes;
    if (!before) return;
    const bounded = notes.map(note => clampNote(note, current!.bars));
    const next = recordNoteEdit(history.current, { trackId, before, after: bounded, label });
    if (next === history.current) return;
    history.current = next;
    setHistoryVersion(v => v + 1);
    change(value => ({ ...value, tracks: value.tracks.map(item => item.id === trackId ? { ...item, notes: bounded } : item) }));
  };
  const historyStep = (direction: 'undo' | 'redo') => {
    if (!openRef.current) return;
    const result = stepNoteHistory(openRef.current, history.current, direction);
    if (!result) return;
    history.current = result.history;
    setHistoryVersion(v => v + 1);
    change(() => result.project);
    message(`${direction === 'undo' ? 'Undid' : 'Redid'} ${result.label.toLowerCase()}.`);
  };
  void historyVersion;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'z' && event.key.toLowerCase() !== 'y') return;
      if (!(event.target instanceof Element) || !event.target.closest('.music-editor-panel')) return;
      if ((event.target as Element).closest('input,textarea,[contenteditable]')) return;
      event.preventDefault();
      historyStep(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const beatFromX = (x: number) => Math.max(0, Math.min(beats - NOTE_MIN, snapToStep((x - KEY_WIDTH) / scale.beat)));
  const pitchFromY = (y: number) => Math.max(LOW_PITCH, Math.min(HIGH_PITCH, HIGH_PITCH - Math.floor(y / scale.row)));

  const audition = (instrument: InstrumentId, pitch: number, velocity = 0.75) => {
    if (preview.status === 'playing' || preview.status === 'preparing') return;
    void notePreview.audition(instrument, pitch, velocity);
  };
  useEffect(() => { if (preview.status === 'playing' || preview.status === 'preparing') notePreview.stop(); }, [preview.status]);

  const draw = () => {
    const element = canvas.current;
    if (!element || !open) return;
    const context = element.getContext('2d');
    if (!context) return;
    const styles = getComputedStyle(element);
    const tone = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    context.clearRect(0, 0, rollWidth, rollHeight);

    for (let pitch = LOW_PITCH; pitch <= HIGH_PITCH; pitch++) {
      const y = (HIGH_PITCH - pitch) * scale.row;
      const isOctave = pitch % 12 === 0;
      context.fillStyle = beginnerMode && track?.instrument !== 'drums' && pitchInScale(pitch, musicScale)
        ? tone('--ms-roll-scale', 'rgba(78,205,196,.13)')
        : isOctave ? tone('--ms-roll-octave', 'rgba(157,139,255,.09)') : tone('--ms-roll-row', 'rgba(157,139,255,.03)');
      context.fillRect(KEY_WIDTH, y, rollWidth - KEY_WIDTH, scale.row);
      if (pitch === 60 && track?.instrument !== 'drums') {
        context.fillStyle = tone('--ms-roll-middle', 'rgba(255,209,102,.22)');
        context.fillRect(KEY_WIDTH, y, rollWidth - KEY_WIDTH, scale.row);
      }
    }
    for (let beat = 0; beat <= beats; beat++) {
      const x = KEY_WIDTH + beat * scale.beat;
      const isBar = beat % BEATS_PER_BAR === 0;
      context.strokeStyle = isBar ? tone('--ms-roll-bar', 'rgba(157,139,255,.55)') : tone('--ms-roll-beat', 'rgba(157,139,255,.2)');
      context.lineWidth = isBar ? 2 : 1;
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, rollHeight); context.stroke();
    }

    // Piano keyboard column.
    context.fillStyle = tone('--ms-roll-keys', 'rgba(10,7,26,.72)');
    context.fillRect(0, 0, KEY_WIDTH, rollHeight);
    for (let pitch = HIGH_PITCH; pitch >= LOW_PITCH; pitch--) {
      const y = (HIGH_PITCH - pitch) * scale.row;
      const isBlack = [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
      const isDrum = !!track && isDrumInstrument(track.instrument);
      context.fillStyle = isBlack ? tone('--ms-roll-black', 'rgba(28,20,56,.95)') : tone('--ms-roll-white', 'rgba(232,228,255,.94)');
      const h = isBlack ? scale.row * 0.62 : scale.row;
      context.fillRect(0, y, KEY_WIDTH, h);
      if (beginnerMode && !isDrum && pitchInScale(pitch, musicScale)) {
        context.fillStyle = tone('--ms-roll-scale', 'rgba(78,205,196,.13)');
        context.fillRect(0, y, KEY_WIDTH, h);
      }
      if (pitch === 60 && !isDrum) {
        context.fillStyle = tone('--ms-roll-middle', 'rgba(255,209,102,.22)');
        context.fillRect(0, y, KEY_WIDTH, h);
      }
      if (notePreview.activePitch === pitch) {
        context.fillStyle = tone('--ms-roll-audition', 'rgba(78,205,196,.65)');
        context.fillRect(0, y, KEY_WIDTH, h);
      }
      if (keyboardPitch === pitch && !isDrum) {
        context.strokeStyle = tone('--ms-roll-focus', '#b28cff');
        context.lineWidth = 2;
        context.strokeRect(1, y + 1, KEY_WIDTH - 2, h - 2);
      }
      context.fillStyle = isBlack ? tone('--ms-roll-black-text', 'rgba(214,206,255,.75)') : tone('--ms-roll-white-text', 'rgba(58,44,110,.85)');
      context.font = `700 ${Math.min(11, scale.row - 5)}px 'Segoe UI',sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const label = isDrum ? (DRUM_RANGE[0] <= pitch && pitch <= DRUM_RANGE[1] ? DRUM_NAMES[pitch] ?? '' : '') : pitch === 60 ? 'C4 · Middle C' : beginnerPitchName(pitch);
      if (label) context.fillText(label, KEY_WIDTH / 2, y + (isBlack ? h / 2 : scale.row / 2));
    }

    if (!track) return;
    // Notes from other tracks, dimmed.
    for (const other of open.tracks) {
      if (other.id === track.id) continue;
      context.fillStyle = tone('--ms-roll-ghost', 'rgba(157,139,255,.16)');
      for (const n of other.notes) context.fillRect(KEY_WIDTH + n.start * scale.beat, (HIGH_PITCH - n.pitch) * scale.row + 2, Math.max(3, n.duration * scale.beat - 2), scale.row - 4);
    }
    for (const n of track.notes) {
      const x = KEY_WIDTH + n.start * scale.beat;
      const y = (HIGH_PITCH - n.pitch) * scale.row;
      const width = Math.max(4, n.duration * scale.beat - 2);
      const selected = n.id === selectedNote;
      context.fillStyle = activeColour;
      context.fillRect(x, y + 2, width, scale.row - 4);
      // Velocity reads as a brightness bar along the top of the block.
      context.fillStyle = 'rgba(255,255,255,.6)';
      context.fillRect(x, y + 2, Math.max(2, width * n.velocity), 3);
      if (selected) {
        context.strokeStyle = tone('--ms-roll-selection', '#fff'); context.lineWidth = 2;
        context.strokeRect(x - 1, y + 1, width + 2, scale.row - 2);
      }
    }
    // Playhead.
    if (preview.playing && preview.duration > 0) {
      const beatNow = (preview.position / 60) * open.tempo;
      const x = KEY_WIDTH + beatNow * scale.beat;
      context.strokeStyle = tone('--ms-roll-playhead', '#ff8fab'); context.lineWidth = 2;
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, rollHeight); context.stroke();
    }
  };

  useEffect(() => { draw(); }, [theme, open, selectedNote, zoom, preview.position, selectedTrack, beginnerMode, musicScale, keyboardPitch, notePreview.activePitch]);
  useEffect(() => {
    const box = roll.current;
    if (!box || !track || !track.notes.length) return;
    const highest = Math.max(...track.notes.map(n => n.pitch));
    box.scrollTop = Math.max(0, (HIGH_PITCH - highest) * scale.row - scale.row * 4);
  }, [track?.id, noteCount, open?.id, zoom]);

  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!open || !track) return;
    const box = event.currentTarget.getBoundingClientRect();
    const factor = rollWidth / box.width;
    const x = (event.clientX - box.left) * factor;
    const y = (event.clientY - box.top) * (rollHeight / box.height);
    if (x < KEY_WIDTH) {
      const pitch = pitchFromY(y);
      setKeyboardPitch(pitch);
      void audition(track.instrument, pitch);
      message(`${isDrumInstrument(track.instrument) ? noteLabel(pitch, true) : beginnerPitchName(pitch)} on ${INSTRUMENT_NAMES[track.instrument]}.`);
      return;
    }
    const hit = [...track.notes].reverse().find(n => {
      const nx = KEY_WIDTH + n.start * scale.beat;
      return x >= nx && x <= nx + n.duration * scale.beat && Math.abs(y - (HIGH_PITCH - n.pitch) * scale.row) < scale.row;
    });
    if (hit) {
      const onEdge = x >= KEY_WIDTH + (hit.start + hit.duration) * scale.beat - 7;
      setSelectedNote(hit.id);
      drag.current = { id: hit.id, mode: onEdge ? 'resize' : 'move', x: event.clientX, y: event.clientY, base: { ...hit }, before: structuredClone(track.notes), trackId: track.id, lastPreviewPitch: hit.pitch, lastPreviewAt: 0 };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const created: Note = { id: crypto.randomUUID(), pitch: pitchFromY(y), start: beatFromX(x), duration: 1, velocity: 0.8 };
    editNotes(track.id, [...track.notes, created], 'Add note');
    audition(track.instrument, created.pitch, created.velocity);
    setSelectedNote(created.id);
    message('Note added. Drag to move it, drag the right edge to change its length.');
  };
  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = drag.current;
    if (!state || !track) return;
    const beatDelta = Math.round(((event.clientX - state.x) / scale.beat) * 4) / 4;
    const pitchDelta = -Math.round((event.clientY - state.y) / scale.row);
    const nextPitch = Math.max(LOW_PITCH, Math.min(HIGH_PITCH, state.base.pitch + pitchDelta));
    if (state.mode === 'move' && nextPitch !== state.lastPreviewPitch && performance.now() - state.lastPreviewAt >= 90) {
      audition(track.instrument, nextPitch, state.base.velocity);
      state.lastPreviewPitch = nextPitch;
      state.lastPreviewAt = performance.now();
    }
    change(value => ({ ...value, tracks: value.tracks.map(item => item.id === track.id ? {
      ...item,
      notes: item.notes.map(n => n.id === state.id
        ? clampNote(state.mode === 'move' ? { ...n, start: state.base.start + beatDelta, pitch: nextPitch } : { ...n, duration: state.base.duration + beatDelta }, value.bars)
        : n),
    } : item) }));
  };
  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = drag.current;
    if (state && openRef.current) {
      const beatDelta = Math.round(((event.clientX - state.x) / scale.beat) * 4) / 4;
      const pitchDelta = -Math.round((event.clientY - state.y) / scale.row);
      const nextPitch = Math.max(LOW_PITCH, Math.min(HIGH_PITCH, state.base.pitch + pitchDelta));
      const after = state.before.map(note => note.id === state.id
        ? clampNote(state.mode === 'move' ? { ...state.base, start: state.base.start + beatDelta, pitch: nextPitch } : { ...state.base, duration: state.base.duration + beatDelta }, openRef.current!.bars)
        : note);
      if (state.mode === 'move' && nextPitch !== state.lastPreviewPitch) audition(track?.instrument ?? 'piano', nextPitch, state.base.velocity);
      change(value => ({ ...value, tracks: value.tracks.map(item => item.id === state.trackId ? { ...item, notes: after } : item) }));
      history.current = recordNoteEdit(history.current, { trackId: state.trackId, before: state.before, after, label: state.mode === 'move' ? 'Move note' : 'Resize note' });
      setHistoryVersion(v => v + 1);
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyboardKey = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!track) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next = Math.max(LOW_PITCH, Math.min(HIGH_PITCH, keyboardPitch + (event.key === 'ArrowUp' ? 1 : -1)));
      setKeyboardPitch(next);
      const rowTop = (HIGH_PITCH - next) * scale.row;
      roll.current?.scrollTo({ top: Math.max(0, rowTop - 100), behavior: 'instant' });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      audition(track.instrument, keyboardPitch);
    }
  };

  const addTrack = (instrument: InstrumentId) => {
    if (!open) return;
    if (open.tracks.length >= MUSIC_MAX_TRACKS) { message(`You can have up to ${MUSIC_MAX_TRACKS} instruments in one song.`); return; }
    const created = newTrack(instrument, INSTRUMENT_NAMES[instrument]);
    change(value => ({ ...value, tracks: [...value.tracks, created] }));
    setSelectedTrack(created.id);
    setPicking(false);
    message(`${INSTRUMENT_NAMES[instrument]} added.`);
  };
  const applyPreset = (name: string, kind: 'starter' | 'pattern', confirmed = false) => {
    if (!track) return;
    const replace = () => {
      const notes = kind === 'starter' ? applyStarter(track, name) : applyDrumPattern(track, name);
      editNotes(track.id, notes, 'Replace notes');
      setSelectedNote(null);
      setConfirming(null);
      message(`“${name}” added to ${track.name}.`);
    };
    // Never overwrite existing notes without asking.
    if (track.notes.length && !confirmed) setConfirming({ kind, name });
    else replace();
  };
  const removeSelected = () => {
    if (!track || !selectedNote) return;
    editNotes(track.id, track.notes.filter(n => n.id !== selectedNote), 'Delete note');
    setSelectedNote(null);
    message('Note removed.');
  };
  const selected = track?.notes.find(n => n.id === selectedNote) ?? null;
  const savedAsset = rendered && audioAssets.some(asset => asset.kind === 'music' && asset.name === rendered.name);

  if (!open) return <StudioShell>
    <div className="music-beginner-path">
      <h2>How to make a song</h2>
      <ol>{BEGINNER_STEPS.map((step, index) => <li key={step}><span className="music-step-number">{index + 1}</span>{step}</li>)}</ol>
    </div>
    <div className="music-empty">
      <span className="music-empty-icon" aria-hidden="true">🎵</span>
      <h2>No songs yet</h2>
      <p>Press the big button to start your first song. You will pick an instrument and can play a tune straight away.</p>
      <button className="music-big-button" onClick={() => { setOpen(newMusicProject()); message('Now choose an instrument to begin.'); }}>+ Create a song</button>
    </div>
    <div className="scene-library">{projects.music.map(item => <article key={item.id}>
      <h2>{item.name}</h2>
      <p>{item.tempo} BPM · {item.bars} bars · {item.tracks.length} instruments · {item.tracks.reduce((sum, t) => sum + t.notes.length, 0)} notes</p>
      <div className="scene-actions">
        <button onClick={() => setOpen(structuredClone(item))}>Open</button>
        <button onClick={() => { const copy = { ...structuredClone(item), id: crypto.randomUUID(), name: `${item.name} copy` }; if (onSaveProjects({ ...projects, music: [...projects.music, copy] })) message('Song duplicated.'); }}>Duplicate</button>
        <button onClick={() => { if (window.confirm(`Delete “${item.name}”?`)) message(onSaveProjects({ ...projects, music: projects.music.filter(other => other.id !== item.id) }) ? 'Song deleted.' : 'Could not delete the song.'); }}>Delete</button>
      </div>
    </article>)}</div>
  </StudioShell>;

  return <StudioShell>

    <header className="music-song-header">
      <button className="music-back" onClick={() => { if (dirty && !window.confirm('Leave without saving your song changes?')) return; preview.stop(); setOpen(null); }}>← All songs</button>
      <input className="music-song-name" aria-label="Song name" maxLength={80} value={open.name} onChange={event => change(value => ({ ...value, name: event.target.value }))} />
      <span className={`music-save-pill ${dirty ? 'unsaved' : 'saved'}`}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
      <div className="music-header-actions">
        <button className="music-save-button" onClick={save}><span aria-hidden="true">💾</span> Save Song</button>
        <button className="music-export-button" disabled={rendering} onClick={() => renderToLibrary(open)} data-tooltip="Finish this song and make it available in your Audio Library">
          <span aria-hidden="true">✨</span> {rendering ? 'Making audio…' : 'Add to Audio Library'}
        </button>
      </div>
    </header>

    <section className="music-transport" aria-label="Playback controls">
      <PlayButton playing={preview.playing} status={preview.status} disabled={preview.status === 'preparing'} canStop={preview.status !== 'stopped'} onPlay={() => void preview.play()} onStop={preview.stop} />
      <span className="music-playback-state" role="status">{preview.status === 'preparing' ? 'Preparing audio' : preview.status === 'playing' ? 'Playing' : preview.status === 'paused' ? 'Paused' : 'Stopped'}</span>
      <div className="music-progress">
        <div className="music-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Song progress">
          <div className="music-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="music-progress-time">{fmt(preview.position)} / {fmt(preview.duration || duration)}</span>
      </div>
      <div className="music-transport-fields">
        <label className="music-stepper"><span>Tempo</span>
          <input aria-label="Song tempo" type="number" min={MUSIC_TEMPO_MIN} max={MUSIC_TEMPO_MAX} value={open.tempo}
            onChange={event => change(value => ({ ...value, tempo: Math.max(MUSIC_TEMPO_MIN, Math.min(MUSIC_TEMPO_MAX, Number(event.target.value))) }))} />
          <small>BPM</small>
        </label>
        <label className="music-stepper"><span>Bars</span>
          <input aria-label="Song bars" type="number" min={MUSIC_BARS_MIN} max={MUSIC_BARS_MAX} value={open.bars}
            onChange={event => change(value => ({ ...value, bars: Math.max(MUSIC_BARS_MIN, Math.min(MUSIC_BARS_MAX, Number(event.target.value))) }))} />
          <small>{beats} beats</small>
        </label>
        <label className="music-toggle"><input aria-label="Loop song" type="checkbox" checked={open.loop} onChange={event => change(value => ({ ...value, loop: event.target.checked }))} /><span>Loop</span></label>
        <label className="music-master"><span>Master volume</span>
          <input aria-label="Master volume" type="range" min="0" max="1" step="0.05" value={open.masterVolume} onChange={event => change(value => ({ ...value, masterVolume: Number(event.target.value) }))} />
          <small>{Math.round(open.masterVolume * 100)}%</small>
        </label>
      </div>
    </section>

    <div className="music-workspace">
    <section className="music-panel music-instrument-panel" aria-label="Instruments in this song">
      <div className="music-panel-heading">
        <div><h2>Your instruments</h2><p>Each instrument has its own colour. Tap one to edit its notes.</p></div>
        <button className="music-add-instrument" onClick={() => setPicking(true)}><span aria-hidden="true">＋</span> Add Instrument</button>
      </div>
      <div className="music-track-cards">
        {open.tracks.map(item => {
          const colour = INSTRUMENT_COLOURS[item.instrument];
          const audible = trackIsAudible(open.tracks, item);
          return <article key={item.id} className={`music-track-card ${item.id === track?.id ? 'active' : ''} ${audible ? '' : 'silenced'}`} style={{ '--track-colour': colour } as React.CSSProperties}>
            <button className="music-track-select" onClick={() => { setSelectedTrack(item.id); setSelectedNote(null); }} aria-pressed={item.id === track?.id}>
              <span className="music-track-icon" style={{ background: `${colour}26`, color: colour }}><Icon path={INSTRUMENT_ICONS[item.instrument]} colour={colour} size={26} /></span>
              <span className="music-track-meta"><strong>{item.name}</strong><small>{audible ? `${item.notes.length} notes` : `${item.notes.length} notes · silent`}</small></span>
            </button>
            <button className="music-track-expand" aria-expanded={expandedTracks.includes(item.id)} aria-controls={`music-track-controls-${item.id}`} onClick={() => setExpandedTracks(value => value.includes(item.id) ? value.filter(id => id !== item.id) : [...value, item.id])}>{expandedTracks.includes(item.id) ? 'Hide controls' : 'Show controls'} <span aria-hidden="true">{expandedTracks.includes(item.id) ? '−' : '+'}</span></button>
            {expandedTracks.includes(item.id) && <div id={`music-track-controls-${item.id}`}>
            <div className="music-track-controls">
              <label>Volume<input aria-label={`${item.name} volume`} type="range" min="0" max="1" step="0.05" value={item.volume} onChange={event => change(value => ({ ...value, tracks: value.tracks.map(t => t.id === item.id ? { ...t, volume: Number(event.target.value) } : t) }))} /><small>{Math.round(item.volume * 100)}%</small></label>
              <label>Pan<input aria-label={`${item.name} pan`} type="range" min="-1" max="1" step="0.1" value={item.pan} onChange={event => change(value => ({ ...value, tracks: value.tracks.map(t => t.id === item.id ? { ...t, pan: Number(event.target.value) } : t) }))} /><small>{item.pan === 0 ? 'Middle' : item.pan < 0 ? `Left ${Math.round(Math.abs(item.pan) * 100)}%` : `Right ${Math.round(item.pan * 100)}%`}</small></label>
            </div>
            <div className="music-track-toggles">
              <button aria-pressed={item.muted} onClick={() => change(value => ({ ...value, tracks: value.tracks.map(t => t.id === item.id ? { ...t, muted: !t.muted } : t) }))} data-tooltip="Mute this instrument">Mute</button>
              <button aria-pressed={item.solo} onClick={() => change(value => ({ ...value, tracks: value.tracks.map(t => t.id === item.id ? { ...t, solo: !t.solo } : t) }))} data-tooltip="Play only this instrument">Solo</button>
              <button onClick={() => { if (window.confirm(`Remove “${item.name}” and all its notes?`)) { change(value => ({ ...value, tracks: value.tracks.filter(t => t.id !== item.id) })); history.current = emptyNoteHistory(); setHistoryVersion(v => v + 1); if (selectedTrack === item.id) setSelectedTrack(null); } }} data-tooltip="Remove this instrument">Remove</button>
            </div>
            </div>}
          </article>;
        })}
        {open.tracks.length === 0 && <p className="music-panel-empty">No instruments yet. Press <strong>Add Instrument</strong> above to begin.</p>}
      </div>
    </section>

    {track && <section className="music-panel music-editor-panel" aria-label="Note editor">
      <div className="music-panel-heading">
        <div><h2>Notes for {track.name}</h2><p>Click empty space to add a note. Drag a note to move it. Drag the right edge to change its length. Click a key on the left to hear it.</p></div>
        <div className="music-zoom" role="group" aria-label="Editor zoom">
          {ZOOM_LEVELS.map(level => <button key={level.id} className={zoom === level.id ? 'active' : ''} aria-pressed={zoom === level.id} onClick={() => setZoom(level.id)}>{level.label}</button>)}
        </div>
      </div>
      <div className="music-guidance">
        <label><input type="checkbox" checked={beginnerMode} onChange={event => setBeginnerMode(event.target.checked)} /> Beginner scale guide</label>
        {beginnerMode && track.instrument !== 'drums' && <><label>Scale <select aria-label="Musical scale" value={musicScale} onChange={event => setMusicScale(event.target.value as MusicScale)}>{Object.keys(MUSIC_SCALES).map(name => <option key={name}>{name}</option>)}</select></label><span>Highlighted notes commonly work together. Every note is yours to try.</span></>}
        <span>Click a key, or focus the keyboard and use ↑/↓ then Enter or Space.</span>
      </div>
      <div className="music-history-actions" role="group" aria-label="Note edit history">
        <button onClick={() => historyStep('undo')} disabled={!history.current.past.length}>↶ Undo note edit</button>
        <button onClick={() => historyStep('redo')} disabled={!history.current.future.length}>↷ Redo note edit</button>
      </div>
      <div className="music-starters" role="group" aria-label="Starter tunes">
        {STARTER_NAMES.map(name => <button key={name} className="music-preset-card" onClick={() => applyPreset(name, 'starter')}>
          <strong>{name}</strong><small>{STARTER_BLURBS[name]}</small>
        </button>)}
        {track.instrument === 'drums' && DRUM_PATTERN_NAMES.map(name => <button key={name} className="music-preset-card drums" onClick={() => applyPreset(name, 'pattern')}>
          <strong>{name}</strong><small>{DRUM_PATTERN_BLURBS[name]}</small>
        </button>)}
      </div>
      <div className="piano-roll-scroll" ref={roll}>
        <canvas ref={canvas} width={rollWidth} height={rollHeight} style={{ width: rollWidth, height: rollHeight }}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
          onKeyDown={keyboardKey} tabIndex={0} role="application" aria-label={`Note editor for ${track.name}. Selected keyboard key ${beginnerPitchName(keyboardPitch)}. Arrow keys choose a pitch; Enter or Space plays it.`} data-audition-pitch={notePreview.activePitch ?? ''} />
      </div>
      <div className="music-note-editor" aria-label="Selected note">
      {selected ? <>
        <strong className="music-note-chip" style={{ background: activeColour }}>{isDrumInstrument(track.instrument) ? noteLabel(selected.pitch, true) : beginnerPitchName(selected.pitch)}</strong>
        <button className="music-hear-note" onClick={() => audition(track.instrument, selected.pitch, selected.velocity)}>♪ Hear note</button>
        <label>Pitch<input aria-label="Note pitch" type="number" min={LOW_PITCH} max={HIGH_PITCH} step="1" value={selected.pitch} onChange={event => { const pitch = Math.max(LOW_PITCH, Math.min(HIGH_PITCH, Number(event.target.value))); editNotes(track.id, track.notes.map(n => n.id === selected.id ? { ...n, pitch } : n), 'Change pitch'); if (pitch !== selected.pitch) audition(track.instrument, pitch, selected.velocity); }} /><small>{isDrumInstrument(track.instrument) ? noteLabel(selected.pitch, true) : beginnerPitchName(selected.pitch)}</small></label>
        <label>Start<input aria-label="Note start" type="number" min="0" max={beats - NOTE_MIN} step="0.25" value={selected.start} onChange={event => editNotes(track.id, track.notes.map(n => n.id === selected.id ? { ...n, start: Number(event.target.value) } : n), 'Change start')} /><small>beats</small></label>
        <label>Length<input aria-label="Note length" type="number" min="0.25" max="16" step="0.25" value={selected.duration} onChange={event => editNotes(track.id, track.notes.map(n => n.id === selected.id ? { ...n, duration: Number(event.target.value) } : n), 'Change length')} /><small>beats</small></label>
        <label>Softness<input aria-label="Note velocity" type="range" min="0.05" max="1" step="0.05" value={selected.velocity} onChange={event => editNotes(track.id, track.notes.map(n => n.id === selected.id ? { ...n, velocity: Number(event.target.value) } : n), 'Change softness')} /><small>{Math.round(selected.velocity * 100)}%</small></label>
        <button className="music-delete-note" onClick={removeSelected}>Delete note</button>
      </> : <p>Select a note in the roll or the list below to edit its pitch, start, length and softness.</p>}
      </div>
      <div className="music-note-list" aria-label="Notes on this instrument">{track.notes.map((note, index) => <button key={note.id} aria-pressed={selectedNote === note.id} onClick={() => setSelectedNote(note.id)}>{index + 1}. {noteLabel(note.pitch, isDrumInstrument(track.instrument))} at beat {note.start + 1}</button>)}</div>
    </section>}
    </div>

    {confirming && <div className="music-confirm" role="dialog" aria-modal="true" aria-label="Replace notes?">
      <div>
        <h2>Replace the notes in {track?.name}?</h2>
        <p>“{confirming.name}” will <strong>replace</strong> the {track?.notes.length} notes in this instrument. Anything already there will be removed.</p>
        <div className="music-confirm-actions">
          <button onClick={() => setConfirming(null)}>Keep my notes</button>
          <button className="danger" onClick={() => confirming && applyPreset(confirming.name, confirming.kind, true)}>Replace them</button>
        </div>
      </div>
    </div>}

    {picking && <div className="music-picker" role="dialog" aria-modal="true" aria-label="Choose an instrument" onClick={() => setPicking(false)}>
      <div onClick={event => event.stopPropagation()}>
        <h2>Pick an instrument</h2>
        <p>Each one sounds different. You can change your mind later.</p>
        <div className="music-picker-grid">
          {INSTRUMENTS.map(instrument => <div key={instrument} className="music-picker-choice" style={{ '--tile-colour': INSTRUMENT_COLOURS[instrument] } as React.CSSProperties}><button className="music-picker-tile" aria-label={`Add ${INSTRUMENT_NAMES[instrument]} instrument`} onClick={() => addTrack(instrument)}>
            <span className="music-picker-icon"><Icon path={INSTRUMENT_ICONS[instrument]} colour={INSTRUMENT_COLOURS[instrument]} size={30} /></span>
            <strong>{INSTRUMENT_NAMES[instrument]}</strong>
            <small>{INSTRUMENT_BLURBS[instrument]}</small>
          </button><button className="music-picker-try" onClick={() => audition(instrument, instrument === 'drums' ? 38 : 60)}>♪ Try {INSTRUMENT_NAMES[instrument]}</button></div>)}
        </div>
        <button className="music-picker-close" onClick={() => setPicking(false)}>Close</button>
      </div>
    </div>}

    {rendered && <p className="music-render-result">Made <strong>{rendered.name}</strong> · {fmt(rendered.duration)} · peak {rendered.peak.toFixed(2)}{savedAsset ? ' · it is in your Audio Library' : ''}</p>}
  </StudioShell>;
}

/* -------------------------------------------------------------------------- */
/* Sound Effects Maker                                                         */
/* -------------------------------------------------------------------------- */

function EffectsMaker({
  projects, open, change, setOpen, save, message, renderToLibrary, rendering, rendered, onSaveProjects,
}: {
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
}) {
  const [busy, setBusy] = useState(false);

  const previewEffect = async (effect: EffectProject) => {
    setBusy(true);
    try {
      const result = await renderEffect(effect);
      await playEffectPreview(async () => result);
    } catch (error) { message(error instanceof Error ? error.message : 'Preview failed.'); }
    finally { setBusy(false); }
  };

  if (!open) return <StudioShell>
    <div className="music-empty">
      <span className="music-empty-icon" aria-hidden="true">🔊</span>
      <h2>Make a cartoon sound</h2>
      <p>Pick a sound, change how it feels, and add it to your Audio Library.</p>
      <button className="music-big-button" onClick={() => { setOpen(newEffect()); message('Choose a sound and press Preview.'); }}>+ Create a sound effect</button>
    </div>
    <div className="scene-library">{projects.effects.map(item => <article key={item.id}>
      <h2>{item.name}</h2><p>{EFFECT_PRESET_NAMES[item.preset]} · {item.duration.toFixed(1)}s</p>
      <div className="scene-actions">
        <button onClick={() => setOpen(structuredClone(item))}>Open</button>
        <button onClick={() => { const copy = { ...structuredClone(item), id: crypto.randomUUID(), name: `${item.name} copy` }; if (onSaveProjects({ ...projects, effects: [...projects.effects, copy] })) message('Sound effect duplicated.'); }}>Duplicate</button>
        <button onClick={() => { if (window.confirm(`Delete “${item.name}”?`)) message(onSaveProjects({ ...projects, effects: projects.effects.filter(other => other.id !== item.id) }) ? 'Sound effect deleted.' : 'Could not delete the effect.'); }}>Delete</button>
      </div>
    </article>)}</div>
  </StudioShell>;

  return <StudioShell>
    <header className="music-song-header">
      <button className="music-back" onClick={() => setOpen(null)}>← All effects</button>
      <input className="music-song-name" aria-label="Effect name" maxLength={80} value={open.name} onChange={event => change(value => ({ ...value, name: event.target.value }))} />
      <div className="music-header-actions">
        <button className="music-save-button" onClick={save}><span aria-hidden="true">💾</span> Save Effect</button>
        <button className="music-export-button" disabled={rendering} onClick={() => renderToLibrary(open)} data-tooltip="Finish this sound and make it available in your Audio Library">
          <span aria-hidden="true">✨</span> {rendering ? 'Making audio…' : 'Add to Audio Library'}
        </button>
      </div>
    </header>

    <section className="music-panel" aria-label="Choose a sound">
      <div className="music-panel-heading"><div><h2>Choose a sound</h2><p>Tap a card to hear what it sounds like.</p></div></div>
      <div className="music-effect-cards">
        {EFFECT_PRESETS.map(preset => <button key={preset} className={`music-effect-card ${open.preset === preset ? 'active' : ''}`} style={{ '--tile-colour': EFFECT_COLOURS[preset] } as React.CSSProperties} onClick={() => change(value => ({ ...value, preset }))}>
          <span className="music-effect-icon"><Icon path={EFFECT_ICONS[preset]} colour={EFFECT_COLOURS[preset]} size={28} /></span>
          <strong>{EFFECT_PRESET_NAMES[preset]}</strong>
          <small>{EFFECT_BLURBS[preset]}</small>
        </button>)}
      </div>
    </section>

    <section className="music-panel" aria-label="Sound controls">
      <div className="music-panel-heading"><div><h2>Make it yours</h2><p>Change how {EFFECT_PRESET_NAMES[open.preset].toLowerCase()} sounds.</p></div>
        <button className="music-preview-button" onClick={() => void previewEffect(open)} disabled={busy}>{busy ? 'Playing…' : '▶ Preview'}</button>
      </div>
      <div className="music-effect-controls">
        <label>Pitch<input aria-label="Effect pitch" type="range" min="-12" max="12" step="1" value={open.pitch} onChange={event => change(value => ({ ...value, pitch: Number(event.target.value) }))} /><small>{open.pitch > 0 ? `+${open.pitch}` : open.pitch} semitones</small></label>
        <label>Length<input aria-label="Effect duration" type="number" min="0.1" max="4" step="0.1" value={open.duration} onChange={event => change(value => ({ ...value, duration: Number(event.target.value) }))} /><small>seconds</small></label>
        <label>Volume<input aria-label="Effect volume" type="range" min="0" max="1" step="0.05" value={open.volume} onChange={event => change(value => ({ ...value, volume: Number(event.target.value) }))} /><small>{Math.round(open.volume * 100)}%</small></label>
        <label>Tail<input aria-label="Effect decay" type="range" min="0" max="1" step="0.05" value={open.decay} onChange={event => change(value => ({ ...value, decay: Number(event.target.value) }))} /><small>{Math.round(open.decay * 100)}%</small></label>
        <label className="music-toggle"><input aria-label="Effect noise" type="checkbox" checked={open.noise} onChange={event => change(value => ({ ...value, noise: event.target.checked }))} /><span>Add a noisy layer</span></label>
      </div>
    </section>
    {rendered && <p className="music-render-result">Made <strong>{rendered.name}</strong> · {fmt(rendered.duration)} · peak {rendered.peak.toFixed(2)}</p>}
    <p className="music-hint">This sound lasts about {effectDuration(open).toFixed(1)} seconds including its tail.</p>
  </StudioShell>;
}

/* -------------------------------------------------------------------------- */
/* Section container                                                          */
/* -------------------------------------------------------------------------- */

export default function MusicStudio({ projects, issue, audioAssets, onSaveProjects, onAddAsset, theme, onThemeChange }: Props) {
  const [tab, setTab] = useState<Tab>('music');
  const [openMusic, setOpenMusic] = useState<MusicProject | null>(null);
  const [openEffect, setOpenEffect] = useState<EffectProject | null>(null);
  const [message, setMessage] = useState('Open a song or a sound effect, or create one.');
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState<RenderedInfo | null>(null);

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

  const renderMusicToLibrary = async (project: MusicProject) => {
    if (!project.tracks.some(track => track.notes.length)) { setMessage('Add some notes before making audio. Try a starter tune.'); return; }
    setRendering(true);
    try {
      const check = await renderMusic(project);
      const peak = peakOf(check.channels);
      if (peak < 0.001) { setMessage('That was silent. Check every instrument is unmuted and has notes.'); return; }
      const asset = await renderMusicToAsset(project);
      onAddAsset(asset);
      setRendered({ kind: 'music', name: asset.name, peak, duration: asset.duration });
      setMessage(`“${asset.name}” is now in your Audio Library. You can use it in any scene, intro or credits.`);
    } catch { setMessage('The song could not be made in this browser.'); }
    finally { setRendering(false); }
  };
  const renderEffectToLibrary = async (effect: EffectProject) => {
    setRendering(true);
    try {
      const check = await renderEffect(effect);
      const peak = peakOf(check.channels);
      if (peak < 0.001) { setMessage('That was silent. Try a different sound or a higher volume.'); return; }
      const asset = await renderEffectToAsset(effect);
      onAddAsset(asset);
      setRendered({ kind: 'effects', name: asset.name, peak, duration: asset.duration });
      setMessage(`“${asset.name}” is now in your Audio Library.`);
    } catch { setMessage('The sound effect could not be made in this browser.'); }
    finally { setRendering(false); }
  };

  const activeIssue = issue;
  return <div className="music-studio-wrap">
    {activeIssue && <p role="alert" className="storage-alert">{activeIssue}</p>}
    <div className="music-studio-switcher">
      <button className={tab === 'music' ? 'active' : ''} onClick={() => { setTab('music'); setMessage('Music Maker is ready.'); }} aria-pressed={tab === 'music'}><span aria-hidden="true">♪</span> Music Maker</button>
      <button className={tab === 'effects' ? 'active' : ''} onClick={() => { setTab('effects'); setMessage('Sound Effects Maker is ready.'); }} aria-pressed={tab === 'effects'}><span aria-hidden="true">🔊</span> Sound Effects</button>
      <button className="music-theme-toggle-inline" onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'light'}>
        <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span> {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </div>
    {tab === 'music'
      ? <MusicMaker projects={projects} open={openMusic} change={changeMusic} setOpen={project => { setRendered(null); setOpenMusic(project); }} save={saveMusic} message={setMessage}
          renderToLibrary={renderMusicToLibrary} rendering={rendering} rendered={rendered?.kind === 'music' ? rendered : null} audioAssets={audioAssets}
          onSaveProjects={onSaveProjects} theme={theme} />
      : <EffectsMaker projects={projects} open={openEffect} change={changeEffect} setOpen={project => { setRendered(null); setOpenEffect(project); }} save={saveEffect} message={setMessage}
          renderToLibrary={renderEffectToLibrary} rendering={rendering} rendered={rendered?.kind === 'effects' ? rendered : null} onSaveProjects={onSaveProjects} />}
    <p role="status" className="music-status">{message}</p>
  </div>;
}

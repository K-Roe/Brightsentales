import { useEffect, useRef, useState } from 'react';
import type { AudioAsset } from './audio';
import { importAudioFile } from './audioStore';
import { wavBlob } from './wav';
import { localVoices, processVoice, retryVoiceService, synthesizeVoice, voiceServiceStatus, type InstalledVoice, type VoiceServiceStatus } from './voiceApi';
import { BUILTIN_VOICE_PRESETS, naturalEffect, type VoiceEffect, type VoicePreset, type VoiceSettings } from './voiceSettings';
import type { Brightling } from './maker';

type Tab = 'ai' | 'record' | 'editor';
type Source = { blob: Blob; name: string; duration: number; assetId?: string; speakerId?: string };
type Props = { assets: AudioAsset[]; characters: Brightling[]; settings: VoiceSettings; issue: string | null; onSettingsChange: (next: VoiceSettings) => boolean; onSaveAsset: (asset: AudioAsset) => Promise<void>; onDeleteAsset: (id: string) => Promise<void> };
const readDuration = async (blob: Blob) => {
  const context = new AudioContext();
  try { return (await context.decodeAudioData(await blob.arrayBuffer())).duration; }
  finally { await context.close(); }
};
const asAsset = async (blob: Blob, name: string, speakerId?: string): Promise<AudioAsset> => {
  const duration = await readDuration(blob);
  if (!duration || duration > 600 || blob.size > 20_000_000) throw new Error('Voice must be under 10 minutes and 20 MB.');
  return { id: crypto.randomUUID(), name: name.trim().slice(0, 120) || 'Untitled voice', kind: 'speech', mime: blob.type || 'audio/wav', duration, size: blob.size, blob, ...(speakerId ? { speakerId } : {}) };
};

function Waveform({ blob }: { blob: Blob | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    if (!blob) return;
    const context = new AudioContext();
    void blob.arrayBuffer().then(bytes => context.decodeAudioData(bytes)).then(audio => {
      if (!live || !canvas.current) return;
      const values = audio.getChannelData(0), draw = canvas.current.getContext('2d');
      if (!draw) return;
      const { width, height } = canvas.current;
      draw.clearRect(0, 0, width, height);
      draw.fillStyle = getComputedStyle(canvas.current).getPropertyValue('--ui-teal') || '#67d8cb';
      for (let x = 0; x < width; x++) {
        const from = Math.floor(x * values.length / width), to = Math.floor((x + 1) * values.length / width);
        let peak = 0;
        for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(values[i]));
        draw.fillRect(x, (height - peak * height) / 2, 1, Math.max(1, peak * height));
      }
    }).catch(() => {}).finally(() => { void context.close(); });
    return () => { live = false; };
  }, [blob]);
  return <canvas className="voice-waveform" ref={canvas} width={800} height={108} role="img" aria-label="Voice waveform" />;
}

export default function VoiceMaker({ assets, characters, settings, issue, onSettingsChange, onSaveAsset, onDeleteAsset }: Props) {
  const [tab, setTab] = useState<Tab>('ai');
  const [voices, setVoices] = useState<InstalledVoice[]>([]);
  const [serviceStatus, setServiceStatus] = useState<VoiceServiceStatus['state']>('starting');
  const [serviceError, setServiceError] = useState('Voice engine is starting.');
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('');
  const [speakerId, setSpeakerId] = useState('narrator');
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [source, setSource] = useState<Source | null>(null);
  const [processed, setProcessed] = useState<Blob | null>(null);
  const [effect, setEffect] = useState<VoiceEffect>(naturalEffect(1));
  const [past, setPast] = useState<VoiceEffect[]>([]);
  const [future, setFuture] = useState<VoiceEffect[]>([]);
  const [cutStart, setCutStart] = useState(0);
  const [cutEnd, setCutEnd] = useState(.5);
  const [name, setName] = useState('');
  const [presetName, setPresetName] = useState('');
  const [presetChoice, setPresetChoice] = useState('natural');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Choose a voice or record your own. Originals stay in the Audio Library.');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const playerUrl = useRef<string | null>(null);
  const cast = [{ id: 'narrator', name: 'Narrator' }, { id: 'max', name: 'Max' }, { id: 'maxine', name: 'Maxine' }, ...characters.map(item => ({ id: item.id, name: item.name }))];
  const stopPreview = () => { player.current?.pause(); player.current = null; if (playerUrl.current) URL.revokeObjectURL(playerUrl.current); playerUrl.current = null; };
  const stopRecording = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setRecording(false); };
  useEffect(() => () => { stopPreview(); stopRecording(); }, []);
  useEffect(() => {
    let active = true, checking = false, wasReady = false;
    const check = async () => {
      if (checking || !active) return;
      checking = true;
      try {
        const status = await voiceServiceStatus();
        if (!active) return;
        setServiceStatus(status.state);
        setServiceError(status.state === 'ready' ? '' : status.detail);
        if (status.state === 'ready' && !wasReady) {
          const items = await localVoices();
          if (!active) return;
          setVoices(items);
          setVoice(current => items.some(item => item.id === current) ? current : items.find(item => item.language === 'en_GB')?.id || items[0]?.id || '');
          if (!items.length) { setServiceStatus('error'); setServiceError('No installed voices found. Check local models.'); }
        }
        wasReady = status.state === 'ready';
      } catch (error) {
        if (active) { wasReady = false; setServiceStatus('unavailable'); setServiceError(error instanceof Error ? error.message : 'Voice service is unavailable.'); }
      } finally { checking = false; }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const retryService = async () => { setServiceStatus('starting'); setServiceError('Voice engine is starting.'); try { await retryVoiceService(); } catch (error) { setServiceStatus('error'); setServiceError(error instanceof Error ? error.message : 'Voice service failed to restart.'); } };
  useEffect(() => { void navigator.mediaDevices?.enumerateDevices().then(items => setDevices(items.filter(item => item.kind === 'audioinput'))).catch(() => {}); }, []);
  const play = (blob: Blob) => { stopPreview(); const url = URL.createObjectURL(blob); playerUrl.current = url; const audio = new Audio(url); player.current = audio; audio.onended = stopPreview; void audio.play().catch(() => setMessage('Playback was blocked. Try pressing Preview again.')); };
  const openSource = (item: Source) => { stopPreview(); setSource(item); setProcessed(null); setEffect(naturalEffect(item.duration)); setPresetChoice('natural'); setPast([]); setFuture([]); setName(item.name.replace(/\.[^.]+$/, '') + ' cartoon'); setTab('editor'); };
  const changeEffect = (patch: Partial<VoiceEffect>) => { setPast(items => [...items.slice(-49), structuredClone(effect)]); setFuture([]); setEffect(value => ({ ...value, ...patch })); setPresetChoice('custom'); setProcessed(null); };
  const history = (direction: 'undo' | 'redo') => {
    const from = direction === 'undo' ? past : future, previous = from.at(-1);
    if (!previous) return;
    if (direction === 'undo') { setPast(from.slice(0, -1)); setFuture(items => [...items, effect]); }
    else { setFuture(from.slice(0, -1)); setPast(items => [...items, effect]); }
    setEffect(previous); setPresetChoice('custom'); setProcessed(null);
  };
  const saveAsset = async (blob: Blob, label: string, speaker?: string) => { const asset = await asAsset(blob, label, speaker); await onSaveAsset(asset); setMessage(`Saved “${asset.name}” to the Audio Library.`); return asset; };
  const generate = async () => {
    if (!voice || !text.trim()) { setMessage('Enter dialogue and choose an installed voice.'); return; }
    setBusy(true);
    try { stopPreview(); const blob = await synthesizeVoice(voice, text.trim(), ttsSpeed); const duration = await readDuration(blob); openSource({ blob, name: `${cast.find(item => item.id === speakerId)?.name ?? 'Voice'} dialogue`, duration, speakerId }); const preferred = [...BUILTIN_VOICE_PRESETS, ...settings.presets].find(item => item.id === settings.defaults[speakerId]?.presetId); if (preferred) { setEffect({ ...naturalEffect(duration), ...preferred.effect }); setPresetChoice(preferred.id); } play(blob); setMessage(preferred ? 'Dialogue generated. The speaker default effect is ready in the editor.' : 'Dialogue generated. Preview it, save the original, or edit it.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Generation failed.'); }
    finally { setBusy(false); }
  };
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Microphone recording is unavailable in this browser.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId }, echoCancellation: true } : { echoCancellation: true } });
      stream.current = media;
      const captured: BlobPart[] = [];
      const current = new MediaRecorder(media); recorder.current = current;
      current.ondataavailable = event => { if (event.data.size) captured.push(event.data); };
      current.onstop = () => { void (async () => {
        try {
          const encoded = new Blob(captured, { type: current.mimeType });
          const audio = new AudioContext();
          try { const decoded = await audio.decodeAudioData(await encoded.arrayBuffer()); const blob = wavBlob([decoded.getChannelData(0)], decoded.sampleRate); openSource({ blob, name: 'My recording', duration: decoded.duration }); setMessage('Recording ready. Play or save the original, then edit it.'); }
          finally { await audio.close(); }
        } catch { setMessage('The recording could not be decoded. Please retry or import a WAV file.'); }
      })(); };
      current.start(); setRecording(true); setMessage('Recording… Press Stop when finished.');
      const inputs = await navigator.mediaDevices.enumerateDevices(); setDevices(inputs.filter(item => item.kind === 'audioinput'));
    } catch (error) { setMessage(error instanceof Error ? `Microphone access failed: ${error.message}` : 'Microphone access was denied.'); stopRecording(); }
  };
  const importFile = async (file: File) => {
    try { const asset = await importAudioFile(file, 'speech'); if (asset.duration > 600) throw new Error('Voice recordings must be 10 minutes or shorter.'); await onSaveAsset(asset); openSource({ blob: asset.blob, name: asset.name, duration: asset.duration, assetId: asset.id }); setMessage('Original imported and saved. You can edit a separate copy.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Import failed.'); }
  };
  const previewEdit = async () => {
    if (!source) return;
    stopPreview(); setBusy(true);
    try { const blob = await processVoice(source.blob, effect); setProcessed(blob); play(blob); setMessage('Processed preview ready. Save it as a new voice to keep this edit.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Editing failed.'); }
    finally { setBusy(false); }
  };
  const savePreset = () => {
    if (!presetName.trim()) { setMessage('Give your preset a name.'); return; }
    const { trimStart: _start, trimEnd: _end, cuts: _cuts, ...sound } = effect;
    const preset: VoicePreset = { id: crypto.randomUUID(), name: presetName.trim().slice(0, 60), effect: sound };
    if (onSettingsChange({ ...settings, presets: [...settings.presets, preset] })) { setPresetName(''); setPresetChoice(preset.id); setMessage('Preset saved for future recordings.'); }
    else setMessage('Preset could not be saved. Existing presets were kept.');
  };
  const applyPreset = (id: string) => { const preset = [...BUILTIN_VOICE_PRESETS, ...settings.presets].find(item => item.id === id); if (preset) { changeEffect(preset.effect); setPresetChoice(id); setTab('editor'); } };
  const previewPreset = async (preset: VoicePreset) => { if (!source) return; stopPreview(); setBusy(true); try { play(await processVoice(source.blob, { ...effect, ...preset.effect })); setMessage(`Previewing ${preset.name} on ${source.name}.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Preset preview failed.'); } finally { setBusy(false); } };
  const duplicatePreset = (preset: VoicePreset) => { const copy = { ...preset, id: crypto.randomUUID(), name: `${preset.name} copy`.slice(0, 60) }; if (!onSettingsChange({ ...settings, presets: [...settings.presets, copy] })) setMessage('Preset could not be duplicated.'); };
  const renamePreset = (preset: VoicePreset) => { const label = window.prompt('Preset name', preset.name)?.trim(); if (label && !onSettingsChange({ ...settings, presets: settings.presets.map(item => item.id === preset.id ? { ...item, name: label.slice(0, 60) } : item) })) setMessage('Preset could not be renamed.'); };
  const deletePreset = (preset: VoicePreset) => { if (!window.confirm(`Delete preset "${preset.name}"?`)) return; const defaults = Object.fromEntries(Object.entries(settings.defaults).map(([id, item]) => [id, { ...item, presetId: item.presetId === preset.id ? null : item.presetId }])); if (onSettingsChange({ ...settings, presets: settings.presets.filter(item => item.id !== preset.id), defaults })) { if (presetChoice === preset.id) setPresetChoice('custom'); setMessage('Preset deleted. Existing saved voices are unchanged.'); } else setMessage('Preset could not be deleted.'); };
  const updateDefault = (id: string, patch: Partial<{ voice: string | null; presetId: string | null }>) => { const previous = settings.defaults[id] ?? { voice: null, presetId: null }; if (!onSettingsChange({ ...settings, defaults: { ...settings.defaults, [id]: { ...previous, ...patch } } })) setMessage('Voice default could not be saved.'); };

  return <section className="voice-maker"><div className="scene-heading"><div><p className="eyebrow">VOICE MAKER</p><h1>Make voices for your cartoons</h1><p>Generate a local voice or record your own, then shape it and use it in a scene.</p></div></div>{issue && <p className="storage-alert" role="alert">{issue}</p>}
    <div className={`voice-service-status ${serviceStatus}`} role="status"><strong>Voice engine: {serviceStatus[0].toUpperCase() + serviceStatus.slice(1)}</strong><span>{serviceError || 'Installed local voice models passed the health check.'}</span>{(serviceStatus === 'unavailable' || serviceStatus === 'error') && <button onClick={() => void retryService()}>Retry voice engine</button>}</div>
    <div className="voice-tabs" role="tablist" aria-label="Voice Maker tabs">{([['ai', 'AI Voices'], ['record', 'Record Voice'], ['editor', 'Voice Editor']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === 'ai' && <section className="voice-card" aria-label="AI Voices"><h2>Local AI voices</h2><p>{serviceError || `${voices.length} installed voices available. Speech stays on this computer.`}</p><label>Dialogue<textarea aria-label="Dialogue text" maxLength={500} value={text} onChange={event => setText(event.target.value)} placeholder="What should your character say?" /></label><div className="voice-fields"><label>Who is speaking?<select aria-label="Dialogue speaker" value={speakerId} onChange={event => { const id = event.target.value; setSpeakerId(id); const preferred = settings.defaults[id]?.voice; if (preferred && voices.some(item => item.id === preferred)) setVoice(preferred); }}>{cast.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Voice<select aria-label="AI voice" value={voice} onChange={event => setVoice(event.target.value)}>{voices.length ? voices.map(item => <option key={item.id} value={item.id}>{item.name} ({item.engine})</option>) : <option value="">No voices available</option>}</select></label><label>Speaking speed <strong>{ttsSpeed.toFixed(2)}×</strong><input aria-label="AI speaking speed" type="range" min="0.6" max="1.8" step="0.05" value={ttsSpeed} onChange={event => setTtsSpeed(Number(event.target.value))} /></label></div><button className="voice-primary" disabled={busy || serviceStatus !== 'ready' || !voice || !text.trim()} onClick={() => void generate()}>{busy ? 'Generating…' : 'Generate dialogue'}</button>
      <details><summary>Default voices for Brightlings and narrator</summary><div className="voice-defaults">{cast.map(item => <div key={item.id}><strong>{item.name}</strong><select aria-label={`${item.name} default voice`} value={settings.defaults[item.id]?.voice ?? ''} onChange={event => updateDefault(item.id, { voice: event.target.value || null })}><option value="">No voice</option>{voices.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select><select aria-label={`${item.name} default effect`} value={settings.defaults[item.id]?.presetId ?? ''} onChange={event => updateDefault(item.id, { presetId: event.target.value || null })}><option value="">No effect preset</option>{[...BUILTIN_VOICE_PRESETS, ...settings.presets].map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></div>)}</div></details>
    </section>}
    {tab === 'record' && <section className="voice-card" aria-label="Record Voice"><h2>Record your voice</h2><p>Use a microphone, or import a WAV, MP3 or OGG recording. Your source stays available after editing.</p><label>Microphone<select aria-label="Microphone" value={deviceId} onChange={event => setDeviceId(event.target.value)}><option value="">Default microphone</option>{devices.map((item, index) => <option key={item.deviceId || index} value={item.deviceId}>{item.label || `Microphone ${index + 1}`}</option>)}</select></label><div className="voice-actions"><button className="voice-primary" disabled={recording} onClick={() => void startRecording()}>Start recording</button><button disabled={!recording} onClick={stopRecording}>Stop recording</button><button disabled={recording} onClick={() => { setSource(null); setProcessed(null); setMessage('Ready to record again.'); }}>Retry</button></div><label className="voice-import">Import recording<input type="file" aria-label="Import voice recording" accept=".wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file); }} /></label></section>}
    {tab === 'editor' && <section className="voice-card" aria-label="Voice Editor"><h2>Voice Editor</h2>{source ? <><p>Original: <strong>{source.name}</strong> · {source.duration.toFixed(2)}s. Edits create a new asset.</p><Waveform blob={source.blob} /><div className="voice-actions"><button onClick={() => play(source.blob)}>Play original</button>{!source.assetId && <button onClick={() => void saveAsset(source.blob, source.name, source.speakerId).then(asset => setSource(value => value && { ...value, assetId: asset.id })).catch(error => setMessage(error instanceof Error ? error.message : 'Save failed.'))}>Save original</button>}<button disabled={!past.length} onClick={() => history('undo')}>Undo</button><button disabled={!future.length} onClick={() => history('redo')}>Redo</button></div>
      <div className="voice-fields"><label>Effect preset<select aria-label="Voice effect preset" value={presetChoice} onChange={event => applyPreset(event.target.value)}><option value="custom" disabled>Custom settings</option>{[...BUILTIN_VOICE_PRESETS, ...settings.presets].map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Trim from (s)<input aria-label="Trim start" type="number" min="0" max={source.duration} step="0.01" value={effect.trimStart} onChange={event => changeEffect({ trimStart: Number(event.target.value) })} /></label><label>Trim to (s)<input aria-label="Trim end" type="number" min="0" max={source.duration} step="0.01" value={effect.trimEnd} onChange={event => changeEffect({ trimEnd: Number(event.target.value) })} /></label><label>Pitch (semitones) <strong>{effect.pitch}</strong><input aria-label="Voice pitch" type="range" min="-12" max="12" step="1" value={effect.pitch} onChange={event => changeEffect({ pitch: Number(event.target.value) })} /></label><label>Speed <strong>{effect.speed.toFixed(2)}×</strong><input aria-label="Voice speed" type="range" min="0.5" max="2" step="0.05" value={effect.speed} onChange={event => changeEffect({ speed: Number(event.target.value) })} /></label><label>Tone <strong>{effect.tone.toFixed(2)}</strong><input aria-label="Voice tone" type="range" min="-1" max="1" step="0.05" value={effect.tone} onChange={event => changeEffect({ tone: Number(event.target.value) })} /></label><label>Volume <strong>{Math.round(effect.volume * 100)}%</strong><input aria-label="Voice volume" type="range" min="0" max="2" step="0.05" value={effect.volume} onChange={event => changeEffect({ volume: Number(event.target.value) })} /></label><label>Fade in (s)<input aria-label="Voice fade in" type="number" min="0" max="10" step="0.05" value={effect.fadeIn} onChange={event => changeEffect({ fadeIn: Number(event.target.value) })} /></label><label>Fade out (s)<input aria-label="Voice fade out" type="number" min="0" max="10" step="0.05" value={effect.fadeOut} onChange={event => changeEffect({ fadeOut: Number(event.target.value) })} /></label></div>
      <div className="voice-switches">{(['normalize', 'echo', 'reverb', 'robot'] as const).map(key => <label key={key}><input type="checkbox" checked={effect[key]} onChange={event => changeEffect({ [key]: event.target.checked })} />{key[0].toUpperCase() + key.slice(1)}</label>)}</div><div className="voice-cut"><span>Cut section (seconds)</span><input aria-label="Cut start" type="number" min="0" max={source.duration} step="0.01" value={cutStart} onChange={event => setCutStart(Number(event.target.value))} /><input aria-label="Cut end" type="number" min="0" max={source.duration} step="0.01" value={cutEnd} onChange={event => setCutEnd(Number(event.target.value))} /><button onClick={() => { if (cutEnd > cutStart && cutEnd <= source.duration) changeEffect({ cuts: [...effect.cuts, [cutStart, cutEnd]] }); else setMessage('Choose a cut inside the recording.'); }}>Add cut</button>{effect.cuts.map(([a, b], index) => <button key={index} onClick={() => changeEffect({ cuts: effect.cuts.filter((_, i) => i !== index) })}>Remove {a.toFixed(1)}–{b.toFixed(1)}s</button>)}</div>
      <div className="voice-actions"><button className="voice-primary" disabled={busy || serviceStatus !== 'ready'} onClick={() => void previewEdit()}>{busy ? 'Processing…' : 'Preview edited voice'}</button>{processed && <><button onClick={() => play(processed)}>Play edited</button><label>Name<input aria-label="Edited voice name" maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label><button onClick={() => void (async () => { try { if (!source.assetId) { const original = await saveAsset(source.blob, source.name, source.speakerId); setSource(value => value && { ...value, assetId: original.id }); } await saveAsset(processed, name, source.speakerId); } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); } })()}>Save as new voice</button></>}</div><div className="voice-actions"><label>My preset name<input aria-label="Custom preset name" maxLength={60} value={presetName} onChange={event => setPresetName(event.target.value)} /></label><button onClick={savePreset}>Save my preset</button></div></> : <p>Generate dialogue, record, import, or choose a voice from the library below to edit it.</p>}</section>}
    <section className="voice-card" aria-label="Voice Library"><h2>Voice Library</h2><p>Original and edited speech assets stay in the existing Audio Library and Studio Backup.</p><div className="voice-library">{assets.filter(item => item.kind === 'speech').map(item => <article key={item.id}><div><strong>{item.name}</strong><small>{item.duration.toFixed(1)}s · {item.speakerId ?? 'Unassigned'}</small></div><button onClick={() => play(item.blob)}>Preview</button><button onClick={() => openSource({ blob: item.blob, name: item.name, duration: item.duration, assetId: item.id, speakerId: item.speakerId })}>Edit</button><button onClick={() => void saveAsset(item.blob, `${item.name} copy`, item.speakerId).catch(error => setMessage(error instanceof Error ? error.message : 'Duplicate failed.'))}>Duplicate</button><button onClick={() => { if (window.confirm(`Delete “${item.name}”? Scene references to it will be removed.`)) void onDeleteAsset(item.id).catch(error => setMessage(error instanceof Error ? error.message : 'Delete failed.')); }}>Delete</button></article>)}</div>{!assets.some(item => item.kind === 'speech') && <p>No voices saved yet.</p>}</section>
    <section className="voice-card" aria-label="My voice effect presets"><h2>My effect presets</h2><p>Save settings once, then use them on another recording.</p><div className="voice-library">{settings.presets.map(preset => <article key={preset.id}><div><strong>{preset.name}</strong><small>Reusable voice effect</small></div><button disabled={!source || busy || serviceStatus !== 'ready'} onClick={() => void previewPreset(preset)}>Preview</button><button disabled={!source} onClick={() => applyPreset(preset.id)}>Edit on current voice</button><button onClick={() => renamePreset(preset)}>Rename</button><button onClick={() => duplicatePreset(preset)}>Duplicate</button><button onClick={() => deletePreset(preset)}>Delete</button></article>)}</div>{settings.presets.length === 0 && <p>No custom presets saved yet.</p>}</section>
    <p className="voice-message" role="status">{message}</p>
  </section>;
}

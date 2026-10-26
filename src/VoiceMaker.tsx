import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AudioAsset } from './audio';
import { importAudioFile } from './audioStore';
import { wavBlob } from './wav';
import { localVoices, processVoice, retryVoiceService, synthesizeVoice, voiceServiceStatus, type InstalledVoice, type VoiceServiceStatus } from './voiceApi';
import { BUILTIN_VOICE_PRESETS, naturalEffect, type VoiceEffect, type VoicePreset, type VoiceSettings } from './voiceSettings';
import type { Brightling } from './maker';
import { clampSelection, createRevisionGate, cutSelection, recordedBlob, recordingMimeType, selectionForEffect, stopCapture, timelineTime, trimToSelection, type TimeSelection } from './voiceEditing';
import { createSpeechAsset } from './voiceAssets';

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
  return createSpeechAsset(blob, duration, name, speakerId);
};

function Waveform({ blob, duration, selection, playhead, onSelection }: { blob: Blob | null; duration: number; selection: TimeSelection; playhead: number; onSelection: (selection: TimeSelection) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const peaks = useRef<Float32Array | null>(null);
  const dragStart = useRef<number | null>(null);
  const dragMode = useRef<'new' | 'start' | 'end'>('new');
  useEffect(() => {
    let live = true;
    peaks.current = null;
    if (!blob) return;
    const context = new AudioContext();
    void blob.arrayBuffer().then(bytes => context.decodeAudioData(bytes)).then(audio => {
      if (!live) return;
      const values = audio.getChannelData(0), samples = 800;
      peaks.current = new Float32Array(samples);
      for (let x = 0; x < samples; x++) {
        const from = Math.floor(x * values.length / samples), to = Math.floor((x + 1) * values.length / samples);
        let peak = 0;
        for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(values[i]));
        peaks.current[x] = peak;
      }
    }).catch(() => {}).finally(() => { void context.close(); });
    return () => { live = false; };
  }, [blob]);
  const draw = useCallback(() => {
    const node = canvas.current, values = peaks.current;
    if (!node || !values) return;
    const context = node.getContext('2d');
    if (!context) return;
    const { width, height } = node, scale = width / Math.max(duration, .01);
    context.clearRect(0, 0, width, height);
    const selectedLeft = selection.start * scale, selectedRight = selection.end * scale;
    context.fillStyle = getComputedStyle(node).getPropertyValue('--ui-accent') || '#e8f6f3';
    context.globalAlpha = .3;
    context.fillRect(selectedLeft, 0, Math.max(0, selectedRight - selectedLeft), height);
    context.globalAlpha = 1;
    context.fillStyle = getComputedStyle(node).getPropertyValue('--ui-teal') || '#67d8cb';
    for (let x = 0; x < width; x++) {
      const peak = values[Math.min(values.length - 1, Math.floor(x / width * values.length))];
      context.fillRect(x, (height - peak * height * .82) / 2, 1, Math.max(1, peak * height * .82));
    }
    context.fillStyle = getComputedStyle(node).getPropertyValue('--ui-text') || '#222';
    context.fillRect(selectedLeft, 0, 2, height);
    context.fillRect(selectedRight - 2, 0, 2, height);
    context.fillStyle = getComputedStyle(node).getPropertyValue('--ui-danger') || '#d44';
    context.fillRect(Math.min(width - 2, Math.max(0, playhead * scale)), 0, 2, height);
  }, [duration, selection, playhead]);
  useEffect(() => { draw(); }, [draw, blob]);
  const setFromPointer = (event: ReactPointerEvent<HTMLCanvasElement>, anchor: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const at = timelineTime(event.clientX, rect.left, rect.width, duration);
    if (dragMode.current === 'start') onSelection(clampSelection(at, selection.end, duration));
    else if (dragMode.current === 'end') onSelection(clampSelection(selection.start, at, duration));
    else onSelection(clampSelection(Math.min(anchor, at), Math.max(anchor, at), duration));
  };
  return <canvas className="voice-waveform" ref={canvas} width={800} height={108} role="img" aria-label={`Interactive waveform. Selected ${selection.start.toFixed(2)} to ${selection.end.toFixed(2)} seconds. Click and drag to select a range; use the selection time fields below for keyboard editing.`}
    onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); const at = timelineTime(event.clientX, rect.left, rect.width, duration); const startX = selection.start / Math.max(duration, .01) * rect.width, endX = selection.end / Math.max(duration, .01) * rect.width; dragMode.current = Math.abs(event.clientX - rect.left - startX) < 12 ? 'start' : Math.abs(event.clientX - rect.left - endX) < 12 ? 'end' : 'new'; dragStart.current = at; event.currentTarget.setPointerCapture(event.pointerId); if (dragMode.current === 'new') onSelection(clampSelection(at, Math.min(duration, at + .01), duration)); }}
    onPointerMove={event => { if (dragStart.current !== null && event.currentTarget.hasPointerCapture(event.pointerId)) setFromPointer(event, dragStart.current); }}
    onPointerUp={event => { if (dragStart.current !== null) { setFromPointer(event, dragStart.current); dragStart.current = null; } }}
    onPointerCancel={() => { dragStart.current = null; }} />;
}

export default function VoiceMaker({ assets, characters, settings, issue, onSettingsChange, onSaveAsset, onDeleteAsset }: Props) {
  const [tab, setTab] = useState<Tab>('ai');
  const [voices, setVoices] = useState<InstalledVoice[]>([]);
  const [serviceStatus, setServiceStatus] = useState<VoiceServiceStatus['state']>('starting');
  const [serviceError, setServiceError] = useState('Voice engine is starting.');
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('');
  const [speakerId, setSpeakerId] = useState('narrator');
  const [ttsSpeed, setTtsSpeed] = useState(settings.defaults.narrator?.speed ?? 1);
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
  const [finishingRecording, setFinishingRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startingRecording, setStartingRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingLevel, setRecordingLevel] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [selection, setSelection] = useState<TimeSelection>({ start: 0, end: .5 });
  const [microphoneMessage, setMicrophoneMessage] = useState('Choose a microphone. Your recording stays on this computer.');
  const [message, setMessage] = useState('Choose a voice or record your own. Originals stay in the Audio Library.');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const playerUrl = useRef<string | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const levelFrame = useRef<number | null>(null);
  const recordingStartedAt = useRef(0);
  const recordingStartLock = useRef(false);
  const processingRevision = useRef(createRevisionGate());
  const mounted = useRef(true);
  const cast = Array.from(new Map([{ id: 'narrator', name: 'Narrator' }, { id: 'max', name: 'Max' }, { id: 'maxine', name: 'Maxine' }, ...characters.map(item => ({ id: item.id, name: item.name }))].map(item => [item.id, item])).values());
  const stopPreview = () => { if (player.current) { player.current.pause(); player.current.onended = null; player.current.ontimeupdate = null; player.current.onerror = null; player.current = null; } if (playerUrl.current) URL.revokeObjectURL(playerUrl.current); playerUrl.current = null; if (mounted.current) setPlayhead(0); };
  const stopMeter = () => { if (levelFrame.current !== null) cancelAnimationFrame(levelFrame.current); levelFrame.current = null; if (audioContext.current) { void audioContext.current.close().catch(() => {}); audioContext.current = null; } if (mounted.current) setRecordingLevel(0); };
  const stopRecording = () => { if (recorder.current?.state === 'recording' && mounted.current) setFinishingRecording(true); stopCapture(recorder.current, stream.current); stream.current = null; stopMeter(); if (mounted.current) setRecording(false); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; processingRevision.current.invalidate(); stopPreview(); stopCapture(recorder.current, stream.current); stream.current = null; if (levelFrame.current !== null) cancelAnimationFrame(levelFrame.current); if (audioContext.current) void audioContext.current.close().catch(() => {}); }; }, []);
  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => { const elapsed = (Date.now() - recordingStartedAt.current) / 1000; setRecordingSeconds(elapsed); if (elapsed >= 600) { setMicrophoneMessage('The 10-minute recording limit was reached. Finishing this take.'); stopRecording(); } }, 100); return () => window.clearInterval(timer); }, [recording]);
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
          setVoice(current => items.some(item => item.id === current) ? current : items.some(item => item.id === settings.defaults.narrator?.voice) ? settings.defaults.narrator.voice! : items.find(item => item.id.startsWith('kokoro:bf_'))?.id || items.find(item => item.language === 'en_GB')?.id || items[0]?.id || '');
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
  useEffect(() => { let active = true; const refresh = () => { void navigator.mediaDevices?.enumerateDevices().then(items => { if (active) setDevices(items.filter(item => item.kind === 'audioinput')); }).catch(() => { if (active) setMicrophoneMessage('Microphone list is unavailable. Check browser permissions or import an audio file.'); }); }; refresh(); navigator.mediaDevices?.addEventListener?.('devicechange', refresh); return () => { active = false; navigator.mediaDevices?.removeEventListener?.('devicechange', refresh); }; }, []);
  const play = (blob: Blob, range?: TimeSelection) => { stopPreview(); const url = URL.createObjectURL(blob); playerUrl.current = url; const audio = new Audio(url); player.current = audio; audio.onloadedmetadata = () => { if (range) audio.currentTime = Math.min(range.start, Math.max(0, audio.duration - .01)); }; audio.ontimeupdate = () => { if (mounted.current) setPlayhead(audio.currentTime); if (range && audio.currentTime >= range.end && player.current === audio) stopPreview(); }; audio.onended = () => { if (player.current === audio) stopPreview(); }; audio.onerror = () => { if (player.current === audio) { stopPreview(); if (mounted.current) setMessage('This recording could not be played. Import a WAV or OGG file and try again.'); } }; void audio.play().catch(() => { if (player.current === audio) { stopPreview(); if (mounted.current) setMessage('Playback was blocked. Try pressing Play again.'); } }); };
  const openSource = (item: Source, showEditor = true) => { processingRevision.current.invalidate(); setBusy(false); stopPreview(); setSource(item); if (item.speakerId) setSpeakerId(item.speakerId); setProcessed(null); setEffect(naturalEffect(item.duration)); setSelection({ start: 0, end: item.duration }); setPresetChoice('natural'); setPast([]); setFuture([]); setName(item.name.replace(/\.[^.]+$/, '') + ' edited'); if (showEditor) setTab('editor'); };
  const changeEffect = (patch: Partial<VoiceEffect>) => { processingRevision.current.invalidate(); setBusy(false); stopPreview(); setPast(items => [...items.slice(-49), structuredClone(effect)]); setFuture([]); setEffect(value => ({ ...value, ...patch })); if (patch.trimStart !== undefined || patch.trimEnd !== undefined) setSelection(current => clampSelection(patch.trimStart ?? current.start, patch.trimEnd ?? current.end, source?.duration ?? 0)); setPresetChoice('custom'); setProcessed(null); };
  const changeTrimBoundary = (which: 'start' | 'end', value: number) => { if (!source) return; const next = clampSelection(which === 'start' ? value : effect.trimStart, which === 'end' ? value : effect.trimEnd, source.duration); changeEffect({ trimStart: next.start, trimEnd: next.end }); };
  const history = (direction: 'undo' | 'redo') => {
    const from = direction === 'undo' ? past : future, previous = from.at(-1);
    if (!previous) return;
    if (direction === 'undo') { setPast(from.slice(0, -1)); setFuture(items => [...items, effect]); }
    else { setFuture(from.slice(0, -1)); setPast(items => [...items, effect]); }
    processingRevision.current.invalidate(); setBusy(false); stopPreview(); setEffect(previous); setSelection(selectionForEffect(previous)); setPresetChoice('custom'); setProcessed(null);
  };
  const saveAsset = async (blob: Blob, label: string, speaker?: string) => { if (mounted.current) setSaving(true); try { const asset = await asAsset(blob, label, speaker); await onSaveAsset(asset); if (mounted.current) setMessage(`Saved “${asset.name}” to the Audio Library.`); return asset; } finally { if (mounted.current) setSaving(false); } };
  const generate = async () => {
    if (!voice || !text.trim()) { setMessage('Enter dialogue and choose an installed voice.'); return; }
    setBusy(true);
    try { stopPreview(); const blob = await synthesizeVoice(voice, text.trim(), ttsSpeed); const duration = await readDuration(blob); const speakerName = cast.find(item => item.id === speakerId)?.name ?? 'Voice'; const voiceName = voices.find(item => item.id === voice)?.name.split(' · ')[0] ?? voice; openSource({ blob, name: `${speakerName} — ${voiceName} — ${text.trim().slice(0, 55)}`, duration, speakerId }); const preferred = [...BUILTIN_VOICE_PRESETS, ...settings.presets].find(item => item.id === settings.defaults[speakerId]?.presetId); if (preferred) { setEffect({ ...naturalEffect(duration), ...preferred.effect }); setPresetChoice(preferred.id); } play(blob); setMessage(preferred ? 'Dialogue generated. The speaker default effect is ready in the editor.' : 'Dialogue generated. Preview it, save the original, or edit it.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Generation failed.'); }
    finally { setBusy(false); }
  };
  const startRecording = async () => {
    if (source && !source.assetId) { setMicrophoneMessage('Save the original or finish editing it before starting another recording. Use Record again only when you are ready to replace this unsaved take.'); return; }
    if (recordingStartLock.current || recording || finishingRecording) return;
    recordingStartLock.current = true;
    setStartingRecording(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Microphone recording is unavailable in this browser.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId }, echoCancellation: true } : { echoCancellation: true } });
      if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const captured: BlobPart[] = [];
      const mime = recordingMimeType(typeof MediaRecorder.isTypeSupported === 'function' ? MediaRecorder.isTypeSupported.bind(MediaRecorder) : () => false);
      const current = new MediaRecorder(media, mime ? { mimeType: mime } : undefined); recorder.current = current;
      let capturedBytes = 0, tooLarge = false;
      current.ondataavailable = event => { if (event.data.size) { capturedBytes += event.data.size; if (capturedBytes > 20_000_000) { tooLarge = true; if (mounted.current) setMicrophoneMessage('This take reached the 20 MB storage limit. Finishing and discarding it.'); if (current.state === 'recording') stopRecording(); } else captured.push(event.data); } };
      current.onstop = () => { void (async () => {
        try {
          if (tooLarge) throw new Error('This recording exceeded the 20 MB Audio Library limit. Record a shorter clip.');
          const encoded = recordedBlob(captured, current.mimeType || mime);
          const audio = new AudioContext();
          try { const decoded = await audio.decodeAudioData(await encoded.arrayBuffer()); if (!decoded.duration || decoded.duration > 600) throw new Error('Recordings must be under 10 minutes.'); if (decoded.length * 2 + 44 > 20_000_000) throw new Error('The decoded recording exceeds the 20 MB Audio Library limit. Record a shorter clip.'); const blob = wavBlob([decoded.getChannelData(0)], decoded.sampleRate); if (mounted.current) { openSource({ blob, name: 'My recording', duration: decoded.duration, speakerId }, false); setMicrophoneMessage('Recording ready. Play it, record again, or continue to edit.'); setMessage('Recording ready. The original is preserved until you save an edited copy.'); } }
          finally { await audio.close(); }
        } catch (error) { if (mounted.current) { const detail = error instanceof Error ? error.message : 'The recording could not be decoded.'; setMicrophoneMessage(`${detail} Check microphone access or import a supported audio file.`); setMessage(detail); } }
        finally { media.getTracks().forEach(track => track.stop()); if (stream.current === media) stream.current = null; if (recorder.current === current) recorder.current = null; if (mounted.current) setFinishingRecording(false); }
      })(); };
      current.onerror = () => { if (mounted.current) setMicrophoneMessage('The recorder stopped unexpectedly. Check that the microphone is connected, then record again.'); stopRecording(); };
      for (const track of media.getAudioTracks()) track.onended = () => { if (current.state === 'recording') { if (mounted.current) setMicrophoneMessage('The microphone disconnected. Reconnect it and record again.'); stopRecording(); } };
      current.start(250); recordingStartedAt.current = Date.now(); setRecordingSeconds(0); setRecording(true); setMicrophoneMessage(`Recording with ${media.getAudioTracks()[0]?.label || 'selected microphone'}.`); setMessage('Recording… Press Stop when you are finished.');
      void navigator.mediaDevices.enumerateDevices().then(inputs => { if (mounted.current) setDevices(inputs.filter(item => item.kind === 'audioinput')); }).catch(() => { if (mounted.current) setMicrophoneMessage('Recording is active. Microphone names are unavailable.'); });
      try {
        const context = new AudioContext(), analyser = context.createAnalyser(); analyser.fftSize = 512; audioContext.current = context; context.createMediaStreamSource(media).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        let lastDisplay = 0;
        const meter = () => { if (current.state !== 'recording') return; analyser.getByteTimeDomainData(samples); let sum = 0; for (const sample of samples) { const value = (sample - 128) / 128; sum += value * value; } const now = performance.now(); if (now - lastDisplay > 100) { setRecordingLevel(Math.min(1, Math.sqrt(sum / samples.length) * 2.5)); lastDisplay = now; } levelFrame.current = requestAnimationFrame(meter); };
        meter();
      } catch { if (audioContext.current) { void audioContext.current.close().catch(() => {}); audioContext.current = null; } setMicrophoneMessage('Recording is active. Live level display is unavailable in this browser.'); }
    } catch (error) { const kind = error instanceof DOMException ? error.name : ''; const detail = kind === 'NotAllowedError' || kind === 'SecurityError' ? 'Microphone permission was denied. Allow microphone access in the browser site settings.' : kind === 'NotFoundError' ? 'No microphone was found. Connect one or import an audio file.' : kind === 'NotReadableError' ? 'The microphone is busy in another app. Close that app or choose another microphone.' : error instanceof Error ? error.message : 'Microphone access failed.'; if (mounted.current) { setMicrophoneMessage(detail); setMessage(detail); stopRecording(); } }
    finally { recordingStartLock.current = false; if (mounted.current) setStartingRecording(false); }
  };
  const importFile = async (file: File) => {
    try { const asset = await importAudioFile(file, 'speech'); if (asset.duration > 600) throw new Error('Voice recordings must be 10 minutes or shorter.'); await onSaveAsset(asset); openSource({ blob: asset.blob, name: asset.name, duration: asset.duration, assetId: asset.id }); setMessage('Original imported and saved. You can edit a separate copy.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Import failed.'); }
  };
  const previewEdit = async () => {
    if (!source) return;
    const ticket = processingRevision.current.begin(), sourceAtRequest = source, effectAtRequest = structuredClone(effect);
    stopPreview(); setBusy(true);
    try { const blob = await processVoice(sourceAtRequest.blob, effectAtRequest); if (!mounted.current || !processingRevision.current.isCurrent(ticket)) return; setProcessed(blob); play(blob); setMessage('Edited preview ready. Effects are processed locally; save it as a new voice to keep this edit.'); }
    catch (error) { if (processingRevision.current.isCurrent(ticket)) setMessage(error instanceof Error ? error.message : 'Editing failed.'); }
    finally { if (processingRevision.current.isCurrent(ticket) && mounted.current) setBusy(false); }
  };
  const savePreset = () => {
    if (!presetName.trim()) { setMessage('Give your preset a name.'); return; }
    const { trimStart: _start, trimEnd: _end, cuts: _cuts, ...sound } = effect;
    const preset: VoicePreset = { id: crypto.randomUUID(), name: presetName.trim().slice(0, 60), effect: sound };
    if (onSettingsChange({ ...settings, presets: [...settings.presets, preset] })) { setPresetName(''); setPresetChoice(preset.id); setMessage('Preset saved for future recordings.'); }
    else setMessage('Preset could not be saved. Existing presets were kept.');
  };
  const applyPreset = (id: string) => { const preset = [...BUILTIN_VOICE_PRESETS, ...settings.presets].find(item => item.id === id); if (preset) { changeEffect({ ...preset.effect, noiseReduction: preset.effect.noiseReduction ?? 0 }); setPresetChoice(id); setTab('editor'); } };
  const previewPreset = async (preset: VoicePreset) => { if (!source) return; const ticket = processingRevision.current.begin(), sourceAtRequest = source; stopPreview(); setBusy(true); try { const blob = await processVoice(sourceAtRequest.blob, { ...effect, ...preset.effect, noiseReduction: preset.effect.noiseReduction ?? 0 }); if (!mounted.current || !processingRevision.current.isCurrent(ticket)) return; play(blob); setMessage(`Previewing ${preset.name} on ${sourceAtRequest.name}.`); } catch (error) { if (processingRevision.current.isCurrent(ticket)) setMessage(error instanceof Error ? error.message : 'Preset preview failed.'); } finally { if (processingRevision.current.isCurrent(ticket) && mounted.current) setBusy(false); } };
  const duplicatePreset = (preset: VoicePreset) => { const copy = { ...preset, id: crypto.randomUUID(), name: `${preset.name} copy`.slice(0, 60) }; if (!onSettingsChange({ ...settings, presets: [...settings.presets, copy] })) setMessage('Preset could not be duplicated.'); };
  const renamePreset = (preset: VoicePreset) => { const label = window.prompt('Preset name', preset.name)?.trim(); if (label && !onSettingsChange({ ...settings, presets: settings.presets.map(item => item.id === preset.id ? { ...item, name: label.slice(0, 60) } : item) })) setMessage('Preset could not be renamed.'); };
  const deletePreset = (preset: VoicePreset) => { if (!window.confirm(`Delete preset "${preset.name}"?`)) return; const defaults = Object.fromEntries(Object.entries(settings.defaults).map(([id, item]) => [id, { ...item, presetId: item.presetId === preset.id ? null : item.presetId }])); if (onSettingsChange({ ...settings, presets: settings.presets.filter(item => item.id !== preset.id), defaults })) { if (presetChoice === preset.id) setPresetChoice('custom'); setMessage('Preset deleted. Existing saved voices are unchanged.'); } else setMessage('Preset could not be deleted.'); };
  const updateDefault = (id: string, patch: Partial<{ voice: string | null; presetId: string | null; speed: number }>) => { const previous = settings.defaults[id] ?? { voice: null, presetId: null }; if (!onSettingsChange({ ...settings, defaults: { ...settings.defaults, [id]: { ...previous, ...patch } } })) setMessage('Voice default could not be saved.'); else setMessage('Voice and speaking pace saved for future sessions.'); };

  return <section className="voice-maker"><div className="scene-heading"><div><p className="eyebrow">VOICE MAKER</p><h1>Make voices for your cartoons</h1><p>Generate a local voice or record your own, then shape it and use it in a scene.</p></div></div>{issue && <p className="storage-alert" role="alert">{issue}</p>}
    <div className={`voice-service-status ${serviceStatus}`} role="status"><strong>Voice engine: {serviceStatus[0].toUpperCase() + serviceStatus.slice(1)}</strong><span>{serviceError || 'Installed local voice models passed the health check.'}</span>{(serviceStatus === 'unavailable' || serviceStatus === 'error') && <button disabled={recording || startingRecording || finishingRecording || saving} onClick={() => void retryService()}>Retry voice engine</button>}</div>
    <div className="voice-tabs" role="tablist" aria-label="Voice Maker tabs">{([['ai', 'AI Voices'], ['record', 'Record Voice'], ['editor', 'Voice Editor']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} disabled={recording || startingRecording || finishingRecording} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === 'ai' && <section className="voice-card" aria-label="AI Voices"><h2>Local AI voices</h2><p>{serviceError || `${voices.length} installed voices available. Speech stays on this computer.`}</p><label>Dialogue<textarea aria-label="Dialogue text" maxLength={500} value={text} disabled={recording || startingRecording || finishingRecording || saving} onChange={event => setText(event.target.value)} placeholder="What should your character say?" /></label><div className="voice-fields"><label>Who is speaking?<select aria-label="Dialogue speaker" value={speakerId} disabled={recording || startingRecording || finishingRecording || saving} onChange={event => { const id = event.target.value; setSpeakerId(id); setTtsSpeed(settings.defaults[id]?.speed ?? 1); const preferred = settings.defaults[id]?.voice; if (preferred && voices.some(item => item.id === preferred)) setVoice(preferred); }}>{cast.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Voice<select aria-label="AI voice" value={voice} disabled={recording || startingRecording || finishingRecording || saving} onChange={event => setVoice(event.target.value)}>{voices.length ? voices.map(item => <option key={item.id} value={item.id}>{item.name} ({item.engine})</option>) : <option value="">No voices available</option>}</select></label><label>Speaking speed <strong>{ttsSpeed.toFixed(2)}×</strong><input aria-label="AI speaking speed" type="range" min="0.6" max="1.8" step="0.05" value={ttsSpeed} disabled={recording || startingRecording || finishingRecording || saving} onChange={event => setTtsSpeed(Number(event.target.value))} /></label></div><button className="voice-primary" disabled={busy || saving || recording || startingRecording || finishingRecording || serviceStatus !== 'ready' || !voice || !text.trim()} onClick={() => void generate()}>{busy ? 'Generating…' : 'Generate dialogue'}</button><button disabled={recording || startingRecording || finishingRecording || saving || !voice || !!issue} onClick={() => updateDefault(speakerId, { voice, speed: ttsSpeed })}>Save voice and pace for this speaker</button>
      <details><summary>Default voices for Brightlings and narrator</summary><div className="voice-defaults">{cast.map(item => <div key={item.id}><strong>{item.name}</strong><select aria-label={`${item.name} default voice`} value={settings.defaults[item.id]?.voice ?? ''} onChange={event => updateDefault(item.id, { voice: event.target.value || null })}><option value="">No voice</option>{voices.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select><select aria-label={`${item.name} default effect`} value={settings.defaults[item.id]?.presetId ?? ''} onChange={event => updateDefault(item.id, { presetId: event.target.value || null })}><option value="">No effect preset</option>{[...BUILTIN_VOICE_PRESETS, ...settings.presets].map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></div>)}</div></details>
    </section>}
    {tab === 'record' && <section className="voice-card" aria-label="Record Voice">
      <h2>Record your voice</h2>
      <p>Record with a microphone, or import a WAV, MP3 or OGG file. Recording and original playback work even when the local voice-effects service is unavailable.</p>
      <label>Who is speaking?<select aria-label="Recording speaker" value={speakerId} disabled={recording || startingRecording || finishingRecording || saving} onChange={event => setSpeakerId(event.target.value)}>{cast.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Microphone<select aria-label="Microphone" value={deviceId} disabled={recording || startingRecording || finishingRecording} onChange={event => setDeviceId(event.target.value)}><option value="">Default microphone</option>{devices.map((item, index) => <option key={item.deviceId || index} value={item.deviceId}>{item.label || `Microphone ${index + 1}`}</option>)}</select></label>
      {!devices.length && <p>No microphone is listed yet. Allow microphone access, then reload the list, or import an audio file instead.</p>}
      <div className="voice-actions">
        <button className="voice-primary" disabled={recording || finishingRecording || startingRecording || busy || saving} onClick={() => void startRecording()}>{startingRecording ? 'Connecting microphone...' : finishingRecording ? 'Finishing recording...' : 'Record'}</button>
        <button disabled={!recording} onClick={stopRecording}>Stop</button>
        <button disabled={!source || recording || finishingRecording || busy || saving} onClick={() => source && play(source.blob)}>Play recording</button>
        <button disabled={recording || finishingRecording || busy || saving} onClick={() => { if (source && !source.assetId && !window.confirm('Discard this unsaved recording and start again?')) return; stopPreview(); setSource(null); setProcessed(null); setMicrophoneMessage('Ready for a new recording.'); setMessage('Ready to record again.'); }}>Record again</button>
        {source && !recording && !finishingRecording && <button disabled={saving} onClick={() => setTab('editor')}>Continue to edit</button>}
      </div>
      {recording && <div className="voice-recording-meter"><span>Recording - {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{Math.floor(recordingSeconds % 60).toString().padStart(2, '0')}</span><meter min="0" max="1" value={recordingLevel} aria-label="Microphone recording level" /></div>}
      <p className="voice-microphone-message" role="status">{microphoneMessage}</p>
      <label className="voice-import">Import recording<input type="file" aria-label="Import voice recording" disabled={recording || startingRecording || finishingRecording || saving} accept=".wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file); }} /></label>
    </section>}
    {tab === 'editor' && <section className="voice-card" aria-label="Voice Editor">
      <h2>Voice Editor</h2>
      {source ? <>
        <p><strong>Original:</strong> {source.name} - {source.duration.toFixed(2)}s. Changes affect a separate edited copy; the original stays unchanged.</p>
        <label>Who is speaking?<select aria-label="Edited voice speaker" value={speakerId || source.speakerId || 'narrator'} onChange={event => setSpeakerId(event.target.value)}>{cast.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <Waveform blob={source.blob} duration={source.duration} selection={selection} playhead={playhead} onSelection={setSelection} />
        <p>Drag across the waveform to select a range. You can also type exact times below.</p>
        <div className="voice-fields voice-selection-fields">
          <label>Selection starts at (seconds)<input aria-label="Selection start" type="number" min="0" max={source.duration} step="0.01" value={selection.start} disabled={recording || saving} onChange={event => setSelection(clampSelection(Number(event.target.value), selection.end, source.duration))} /></label>
          <label>Selection ends at (seconds)<input aria-label="Selection end" type="number" min="0" max={source.duration} step="0.01" value={selection.end} disabled={recording || saving} onChange={event => setSelection(clampSelection(selection.start, Number(event.target.value), source.duration))} /></label>
        </div>
        <div className="voice-actions">
          <button disabled={recording || saving} onClick={() => play(source.blob)}>Play original</button>
          <button disabled={recording || saving || selection.end - selection.start < .01} onClick={() => play(source.blob, selection)}>Play selected portion</button>
          {!source.assetId && <button disabled={recording || saving} onClick={() => void saveAsset(source.blob, source.name, speakerId || source.speakerId).then(asset => setSource(value => value && { ...value, assetId: asset.id })).catch(error => setMessage(error instanceof Error ? error.message : 'Save failed.'))}>Save original</button>}
          <button disabled={recording || saving} onClick={() => { changeEffect(trimToSelection(effect, selection, source.duration)); setMessage('Trim set to the selected range. Preview before saving.'); }}>Trim to selection</button>
          <button disabled={recording || saving || effect.cuts.length >= 20} onClick={() => { const next = cutSelection(effect, selection, source.duration); if (next === effect) setMessage('A selection must be at least 0.01 seconds and no more than 20 cuts can be added.'); else { changeEffect({ cuts: next.cuts }); setMessage('Selected section marked for removal. Preview before saving.'); } }}>Cut selection</button>
          <button disabled={recording || saving} onClick={() => setSelection({ start: 0, end: source.duration })}>Reset selection</button>
        </div>
        <div className="voice-actions"><button disabled={!past.length || recording || saving} onClick={() => history('undo')}>Undo</button><button disabled={!future.length || recording || saving} onClick={() => history('redo')}>Redo</button><button disabled={recording || saving} onClick={() => { changeEffect(naturalEffect(source.duration)); setSelection({ start: 0, end: source.duration }); setMessage('Edits reset. The original recording is unchanged.'); }}>Reset edits</button></div>
        <div className="voice-fields">
          <label>Effect preset<select aria-label="Voice effect preset" value={presetChoice} disabled={recording || saving} onChange={event => applyPreset(event.target.value)}><option value="custom" disabled>Custom settings</option>{[...BUILTIN_VOICE_PRESETS, ...settings.presets].map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Trim from (s)<input aria-label="Trim start" type="number" min="0" max={source.duration} step="0.01" value={effect.trimStart} disabled={recording || saving} onChange={event => changeTrimBoundary('start', Number(event.target.value))} /></label>
          <label>Trim to (s)<input aria-label="Trim end" type="number" min="0" max={source.duration} step="0.01" value={effect.trimEnd} disabled={recording || saving} onChange={event => changeTrimBoundary('end', Number(event.target.value))} /></label>
          <label>Pitch (semitones) <strong>{effect.pitch}</strong><input aria-label="Voice pitch" type="range" min="-12" max="12" step="1" value={effect.pitch} disabled={recording || saving} onChange={event => changeEffect({ pitch: Number(event.target.value) })} /></label>
          <label>Speed <strong>{effect.speed.toFixed(2)}x</strong><input aria-label="Voice speed" type="range" min="0.5" max="2" step="0.05" value={effect.speed} disabled={recording || saving} onChange={event => changeEffect({ speed: Number(event.target.value) })} /></label>
          <label>Tone <strong>{effect.tone.toFixed(2)}</strong><input aria-label="Voice tone" type="range" min="-1" max="1" step="0.05" value={effect.tone} disabled={recording || saving} onChange={event => changeEffect({ tone: Number(event.target.value) })} /></label>
          <label>Volume <strong>{Math.round(effect.volume * 100)}%</strong><input aria-label="Voice volume" type="range" min="0" max="2" step="0.05" value={effect.volume} disabled={recording || saving} onChange={event => changeEffect({ volume: Number(event.target.value) })} /></label>
          <label>Noise reduction strength <strong>{Math.round(effect.noiseReduction * 100)}%</strong><input aria-label="Noise reduction strength" type="range" min="0" max="1" step="0.05" value={effect.noiseReduction} disabled={recording || saving} onChange={event => changeEffect({ noiseReduction: Number(event.target.value) })} /></label>
          <label>Fade in (s)<input aria-label="Voice fade in" type="number" min="0" max="10" step="0.05" value={effect.fadeIn} disabled={recording || saving} onChange={event => changeEffect({ fadeIn: Number(event.target.value) })} /></label>
          <label>Fade out (s)<input aria-label="Voice fade out" type="number" min="0" max="10" step="0.05" value={effect.fadeOut} disabled={recording || saving} onChange={event => changeEffect({ fadeOut: Number(event.target.value) })} /></label>
        </div>
        <p>{serviceStatus === 'ready' ? 'Effects, including noise reduction, are processed locally when you preview. Processing is not real time.' : `Local effects are unavailable while the voice engine is ${serviceStatus}. Recording and original playback still work; start or retry the local service to preview edits.`}</p>
        <div className="voice-switches">{(['normalize', 'echo', 'reverb', 'robot'] as const).map(key => <label key={key}><input type="checkbox" checked={effect[key]} disabled={recording || saving} onChange={event => changeEffect({ [key]: event.target.checked })} />{key[0].toUpperCase() + key.slice(1)}</label>)}</div>
        <div className="voice-cut"><span>Cut section (seconds)</span><input aria-label="Cut start" type="number" min="0" max={source.duration} step="0.01" value={cutStart} disabled={recording || saving} onChange={event => setCutStart(Number(event.target.value))} /><input aria-label="Cut end" type="number" min="0" max={source.duration} step="0.01" value={cutEnd} disabled={recording || saving} onChange={event => setCutEnd(Number(event.target.value))} /><button disabled={recording || saving || effect.cuts.length >= 20} onClick={() => { if (cutEnd > cutStart && cutEnd <= source.duration) changeEffect({ cuts: [...effect.cuts, [cutStart, cutEnd]] }); else setMessage('Choose a cut inside the recording.'); }}>Add cut</button>{effect.cuts.map(([a, b], index) => <button key={index} disabled={recording || saving} onClick={() => changeEffect({ cuts: effect.cuts.filter((_, i) => i !== index) })}>Remove {a.toFixed(1)} to {b.toFixed(1)}s</button>)}</div>
        <div className="voice-actions">
          <button className="voice-primary" disabled={busy || saving || recording || finishingRecording || serviceStatus !== 'ready'} onClick={() => void previewEdit()}>{busy ? 'Processing...' : 'Preview edited voice'}</button>
          {processed && <><button disabled={busy || saving || recording} onClick={() => play(processed)}>Play edited</button><label>Name<input aria-label="Edited voice name" maxLength={120} value={name} disabled={busy || saving || recording} onChange={event => setName(event.target.value)} /></label><button disabled={busy || saving || recording} onClick={() => void (async () => { const preview = processed; const editedName = name; const selectedSpeaker = speakerId || source.speakerId; try { setSaving(true); if (!source.assetId) { const original = await saveAsset(source.blob, source.name, source.speakerId); setSource(value => value && { ...value, assetId: original.id }); } await saveAsset(preview, editedName, selectedSpeaker); } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); } finally { setSaving(false); } })()}>{saving ? 'Saving...' : 'Save Voice'}</button></>}
        </div>
        <div className="voice-actions"><label>My preset name<input aria-label="Custom preset name" maxLength={60} value={presetName} disabled={recording || saving} onChange={event => setPresetName(event.target.value)} /></label><button disabled={recording || saving} onClick={savePreset}>Save my preset</button></div>
      </> : <p>Generate dialogue, record, import, or choose a saved voice below to edit it.</p>}
    </section>}
    <section className="voice-card" aria-label="Voice Library"><h2>Voice Library</h2><p>Original and edited speech assets stay in the existing Audio Library and Studio Backup.</p><div className="voice-library">{assets.filter(item => item.kind === 'speech').map(item => <article key={item.id}><div><strong>{item.name}</strong><small>{item.duration.toFixed(1)}s · {item.speakerId ?? 'Unassigned'}</small></div><button disabled={recording || startingRecording || finishingRecording || saving} onClick={() => play(item.blob)}>Preview</button><button disabled={recording || startingRecording || finishingRecording || saving} onClick={() => openSource({ blob: item.blob, name: item.name, duration: item.duration, assetId: item.id, speakerId: item.speakerId })}>Edit</button><button disabled={recording || startingRecording || finishingRecording || saving} onClick={() => void saveAsset(item.blob, `${item.name} copy`, item.speakerId).catch(error => setMessage(error instanceof Error ? error.message : 'Duplicate failed.'))}>Duplicate</button><button disabled={recording || startingRecording || finishingRecording || saving} onClick={() => { if (window.confirm(`Delete “${item.name}”? Scene references to it will be removed.`)) void onDeleteAsset(item.id).catch(error => setMessage(error instanceof Error ? error.message : 'Delete failed.')); }}>Delete</button></article>)}</div>{!assets.some(item => item.kind === 'speech') && <p>No voices saved yet.</p>}</section>
    <section className="voice-card" aria-label="My voice effect presets"><h2>My effect presets</h2><p>Save settings once, then use them on another recording.</p><div className="voice-library">{settings.presets.map(preset => <article key={preset.id}><div><strong>{preset.name}</strong><small>Reusable voice effect</small></div><button disabled={!source || busy || recording || finishingRecording || saving || serviceStatus !== 'ready'} onClick={() => void previewPreset(preset)}>Preview</button><button disabled={!source || recording || finishingRecording || saving} onClick={() => applyPreset(preset.id)}>Edit on current voice</button><button disabled={recording || finishingRecording || saving} onClick={() => renamePreset(preset)}>Rename</button><button disabled={recording || finishingRecording || saving} onClick={() => duplicatePreset(preset)}>Duplicate</button><button disabled={recording || finishingRecording || saving} onClick={() => deletePreset(preset)}>Delete</button></article>)}</div>{settings.presets.length === 0 && <p>No custom presets saved yet.</p>}</section>
    <p className="voice-message" role="status">{message}</p>
  </section>;
}

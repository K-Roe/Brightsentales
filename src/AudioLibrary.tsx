import { useEffect, useRef, useState } from 'react';
import type { AudioAsset, AudioKind } from './audio';

type Props = { assets: AudioAsset[]; issue: string | null; onImport: (file: File, kind: AudioKind) => Promise<void>; onDelete: (id: string) => Promise<void> };
export default function AudioLibrary({ assets, issue, onImport, onDelete }: Props) {
  const [kind, setKind] = useState<AudioKind>('music');
  const [message, setMessage] = useState('Import an MP3, WAV or OGG file from this device.');
  const [preview, setPreview] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const stop = () => { player.current?.pause(); player.current = null; if (url.current) URL.revokeObjectURL(url.current); url.current = null; setPreview(null); };
  useEffect(() => () => { player.current?.pause(); if (url.current) URL.revokeObjectURL(url.current); }, []);
  const toggle = (asset: AudioAsset) => {
    if (preview === asset.id) { stop(); return; }
    stop(); url.current = URL.createObjectURL(asset.blob);
    const audio = new Audio(url.current); player.current = audio; audio.onended = stop;
    void audio.play().then(() => setPreview(asset.id)).catch(() => { stop(); setMessage('This browser blocked audio preview. Press Preview again.'); });
  };
  return <section className="audio-library-page"><div className="scene-heading"><div><p className="eyebrow">AUDIO LIBRARY</p><h1>Your sounds</h1><p>Keep music and sound effects on this device for your cartoons.</p></div></div>
    {issue && <p className="storage-alert" role="alert">{issue}</p>}
    <div className="audio-import"><label>Audio type<select aria-label="Imported audio type" value={kind} onChange={event => setKind(event.target.value as AudioKind)}><option value="music">Music</option><option value="effect">Sound Effect</option></select></label><label className="audio-file-button">Import audio<input aria-label="Import audio file" type="file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" disabled={!!issue} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void onImport(file, kind).then(() => setMessage(`${file.name} added to your Audio Library.`)).catch(error => setMessage(error instanceof Error ? error.message : 'Audio import failed.')); }} /></label></div>
    <div className="audio-asset-list">{assets.map(asset => <article key={asset.id}><div><strong>{asset.name}</strong><span>{asset.kind === 'music' ? 'Music' : 'Sound Effect'} · {asset.duration.toFixed(1)}s</span></div><button onClick={() => toggle(asset)}>{preview === asset.id ? 'Stop' : 'Preview'}</button><button onClick={() => { stop(); void onDelete(asset.id).catch(error => setMessage(error instanceof Error ? error.message : 'Could not delete audio.')); }}>Delete</button></article>)}</div>
    {assets.length === 0 && <p>No audio imported yet.</p>}<p role="status">{message}</p><p className="storage-note">Audio files are stored locally in this browser. Download a Studio Backup to keep a separate copy.</p>
  </section>;
}

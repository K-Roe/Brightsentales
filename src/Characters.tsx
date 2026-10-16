import { useEffect, useRef, useState } from 'react';
import { Brightling, DEFAULT_COLOURS, LIBRARY_KEY, makeFrame, nameAvailable, PALETTES, Template } from './maker';
import { backupLibrary, ImportMode, validateLibrary } from './library';
import { StudioBackup, validateStudioBackup } from './studioBackup';

type Colours = Pick<Brightling, 'body' | 'hair' | 'clothing'>;
type Props = {
  library: Brightling[];
  thumbnails: Record<string, string>;
  inScene: string[];
  storageIssue: string | null;
  sceneIssue: string | null;
  onSave: (item: Brightling) => Promise<boolean>;
  onDelete: (id: string) => boolean;
  onImport: (items: Brightling[], mode: ImportMode) => boolean;
  onAdd: (item: Brightling) => void;
  onExportStudio: () => StudioBackup | null;
  onImportStudio: (backup: StudioBackup) => Promise<boolean>;
};

export default function Characters({ library, thumbnails, inScene, storageIssue, sceneIssue, onSave, onDelete, onImport, onAdd, onExportStudio, onImportStudio }: Props) {
  const [view, setView] = useState<'overview' | 'maker'>('overview');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template>('male');
  const [name, setName] = useState('');
  const [colours, setColours] = useState<Colours>(DEFAULT_COLOURS.male);
  const [preview, setPreview] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const fileRef = useRef<HTMLInputElement>(null);
  const studioFileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view !== 'maker') return;
    let active = true;
    setPreview(''); setPreviewError(false);
    makeFrame({ template, ...colours }, '0').then(canvas => { if (active) setPreview(canvas.toDataURL('image/png')); }).catch(() => { if (active) setPreviewError(true); });
    return () => { active = false; };
  }, [view, template, colours]);

  const resetForm = () => { setView('overview'); setEditingId(null); setTemplate('male'); setName(''); setColours(DEFAULT_COLOURS.male); setMessage(''); };
  const create = () => { setEditingId(null); setTemplate('male'); setName(''); setColours(DEFAULT_COLOURS.male); setMessage(''); setView('maker'); };
  const edit = (item: Brightling) => {
    setView('maker');
    setEditingId(item.id); setTemplate(item.template); setName(item.name);
    setColours({ body: item.body, hair: item.hair, clothing: item.clothing });
    setMessage(`Editing ${item.name}. Their scene placements will stay linked to this ID.`);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const save = async () => {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName || cleanName.length > 32) { setMessage('Enter a name between 1 and 32 characters.'); return; }
    if (!nameAvailable(cleanName, library, editingId ?? undefined)) { setMessage('That name is already in use. Choose another.'); return; }
    setBusy(true);
    const item: Brightling = { id: editingId ?? `brightling-${crypto.randomUUID()}`, name: cleanName, template, ...colours };
    const ok = await onSave(item);
    setBusy(false);
    if (ok) { resetForm(); setMessage(`${cleanName} ${editingId ? 'updated' : 'saved'}.`); }
    else setMessage('Could not save. Check the artwork and browser storage.');
  };
  const remove = (item: Brightling) => {
    if (!window.confirm(`Delete ${item.name}? This also removes them from the saved living room scene.`)) return;
    if (onDelete(item.id)) { if (editingId === item.id) resetForm(); setMessage(`${item.name} deleted.`); }
    else setMessage('Delete failed. The character and scene were left unchanged.');
  };
  const exportLibrary = () => {
    try {
      const contents = storageIssue ? localStorage.getItem(LIBRARY_KEY) : backupLibrary(library);
      if (contents === null) throw new Error('No stored library data was found.');
      const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = storageIssue ? 'brightsenappstales-original-data.json' : 'brightsenappstales-brightlings.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(storageIssue ? 'Original stored data downloaded unchanged.' : 'Library backup downloaded.');
    } catch { setMessage('Could not export library data from this browser.'); }
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('The backup is too large.');
      const result = validateLibrary(JSON.parse(await file.text()));
      if (!result.ok) throw new Error(result.error);
      if (storageIssue && importMode === 'merge') throw new Error('The current library is invalid. Export the original storage data before replacing it.');
      const action = importMode === 'replace' ? 'replace the current custom character library' : 'merge these characters into the current library';
      if (!window.confirm(`Import ${result.characters.length} Brightling(s) and ${action}? ${importMode === 'replace' ? 'Scene references to characters absent from the backup will be removed.' : 'Matching IDs will be updated.'}`)) return;
      if (!onImport(result.characters, importMode)) throw new Error('Import could not be saved. Existing data was kept.');
      resetForm(); setMessage(`Imported ${result.characters.length} Brightling(s).`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Invalid backup file.'); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  const exportStudio = () => {
    try {
      const backup = onExportStudio();
      if (!backup) throw new Error('Stored characters or scene could not be read. Existing data was left unchanged.');
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `brightsenappstales-studio-${backup.createdAt.slice(0, 10)}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Studio Backup downloaded. Keep this file somewhere safe.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not export Studio Backup.'); }
  };
  const importStudio = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 20_000_000) throw new Error('The Studio Backup is too large.');
      const result = validateStudioBackup(JSON.parse(await file.text()));
      if (!result.ok) throw new Error(result.error);
      if (!window.confirm(`Restore Studio Backup from ${result.backup.createdAt}? This replaces the current custom Brightling library, saved Playground scene and Places library with ${result.backup.characters.length} character(s), ${result.backup.scene ? 'a saved scene' : 'no saved scene'}, ${result.backup.places.folders.length} folder(s) and ${result.backup.places.customPlaces.length} custom place(s). Export your current Studio Backup first if you want to keep it.`)) return;
      if (!await onImportStudio(result.backup)) throw new Error('Studio restore failed. Check browser storage and artwork.');
      resetForm(); setMessage('Studio Backup restored. Characters, Playground scene and Places library are ready.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Invalid Studio Backup.'); }
    finally { if (studioFileRef.current) studioFileRef.current.value = ''; }
  };

  return <div className="characters-page">
    <div className="page-intro">
      <p className="eyebrow">CHARACTER STUDIO</p>
      <h1>Meet your <em>Brightlings.</em></h1>
      <p>Your cast lives here. Choose a character to play, or create someone new.</p>
    </div>
    {storageIssue && <p className="storage-alert" role="alert">Saved library needs attention: {storageIssue} Existing storage has not been changed. You can export its original data before replacing it.</p>}
    {sceneIssue && <p className="storage-alert" role="alert">{sceneIssue} Delete and library replacement are unavailable until the scene is repaired.</p>}
    {view === 'overview' ? <>
      <div className="overview-heading">
        <div><p className="eyebrow">YOUR CHARACTERS</p><h2>Character Library <span>{library.length} custom</span></h2><p>Max and Maxine are protected originals. Your saved Brightlings appear beside them.</p></div>
        <button className="create-brightling" onClick={create}><span aria-hidden="true">＋</span> Create Brightling</button>
      </div>
      <section className="character-library" aria-label="Brightling library">
        <div className="portrait-grid">
          <article className="portrait-card default-character"><div className="portrait-art"><img src="/art/max-0.png" alt="Max, front-facing" /></div><div className="portrait-info"><span className="portrait-tag">Original · Protected</span><h3>Max</h3><p>Male · Max template</p><span className="portrait-presence">Always in Playground</span></div></article>
          <article className="portrait-card default-character"><div className="portrait-art"><img src="/art/maxine-0.png" alt="Maxine, front-facing" /></div><div className="portrait-info"><span className="portrait-tag">Original · Protected</span><h3>Maxine</h3><p>Female · Maxine template</p><span className="portrait-presence">Always in Playground</span></div></article>
          {library.map(item => <article className="portrait-card" key={item.id}>
            <div className="portrait-art">{thumbnails[item.id] ? <img src={thumbnails[item.id]} alt={item.name + ', front-facing'} /> : <span className="art-missing">Artwork unavailable</span>}</div>
            <div className="portrait-info"><span className="portrait-tag">Custom Brightling</span><h3>{item.name}</h3><p>{item.template === 'male' ? 'Male · Max template' : 'Female · Maxine template'}</p>
              <div className="portrait-actions"><button onClick={() => edit(item)}>Edit</button><button onClick={() => remove(item)}>Delete</button><button className="add-action" onClick={() => onAdd(item)} disabled={!thumbnails[item.id]}>{inScene.includes(item.id) ? 'Open in Playground' : 'Add to Playground'}</button></div>
            </div>
          </article>)}
        </div>
        {library.length === 0 && <p className="overview-empty">Your own Brightlings will appear here after you create one.</p>}
      </section>
      <section className="library-backup overview-backup" aria-label="Library backup">
        <div><h3>Keep a copy of your characters</h3><p>Export and import custom Brightlings. A library export does not include saved scenes.</p></div>
        <div className="backup-controls"><button onClick={exportLibrary}>{storageIssue ? 'Export Stored Data' : 'Export Library'}</button><label htmlFor="import-mode">Import as<select id="import-mode" value={importMode} onChange={event => setImportMode(event.target.value as ImportMode)}><option value="merge">Merge with library</option><option value="replace">Replace library</option></select></label><label className="import-file">Import Library<input ref={fileRef} type="file" accept=".json,application/json" onChange={event => void importFile(event.target.files?.[0])} /></label></div>
      </section>
      <section className="library-backup overview-backup" aria-label="Studio backup">
        <div><h3>Back up the whole Studio</h3><p>Includes custom Brightlings, the saved Playground scene, Places folders and uploaded artwork. Keep the downloaded file somewhere safe; clearing browser data removes local copies.</p></div>
        <div className="backup-controls"><button onClick={exportStudio}>Export Studio Backup</button><label className="import-file">Import Studio Backup<input ref={studioFileRef} type="file" accept=".json,application/json" onChange={event => void importStudio(event.target.files?.[0])} /></label></div>
      </section>
    </> : <section className="maker-panel character-maker" ref={formRef} aria-label="Brightling Maker">
      <div className="maker-fields">
        <p className="eyebrow">{editingId ? 'EDIT CHARACTER' : 'NEW CHARACTER'}</p>
        <h2>{editingId ? 'Edit Brightling' : 'Create a Brightling'}</h2>
        <p>Choose from the approved templates and colours. The animation artwork stays intact.</p>
        <label htmlFor="template-choice">Template<select id="template-choice" value={template} onChange={event => { const value = event.target.value as Template; setTemplate(value); setColours(DEFAULT_COLOURS[value]); }}><option value="male">Male · Max template</option><option value="female">Female · Maxine template</option></select></label>
        <label htmlFor="brightling-name">Name<input id="brightling-name" value={name} maxLength={32} onChange={event => setName(event.target.value)} placeholder="e.g. Charlie" /></label>
        {(['body', 'hair', 'clothing'] as const).map(key => <fieldset className="colour-field" key={key}><legend>{key === 'clothing' ? 'Main clothing colour' : key[0].toUpperCase() + key.slice(1) + ' colour'}</legend><div className="swatches">{PALETTES[key].map(value => <button key={value} type="button" className={'swatch ' + (colours[key] === value ? 'chosen' : '')} style={{ background: value }} onClick={() => setColours({ ...colours, [key]: value })} aria-label={key + ' ' + value} aria-pressed={colours[key] === value} />)}</div></fieldset>)}
        <div className="form-actions"><button className="maker-save" disabled={!preview || busy || !!storageIssue} onClick={save}>{busy ? 'Preparing frames…' : editingId ? 'Update Brightling' : 'Save Brightling'}</button><button className="cancel-button" onClick={resetForm}>Cancel</button></div>
      </div>
      <div className="maker-preview"><strong>Live preview</strong>{preview ? <img src={preview} alt={(name.trim() || 'New Brightling') + ' front-facing preview'} /> : <span>{previewError ? 'Artwork unavailable' : 'Preparing preview…'}</span>}<small>The saved character uses this same artwork and colours.</small></div>
    </section>}
    <p className="form-message" role="status">{message}</p>
  </div>;
}

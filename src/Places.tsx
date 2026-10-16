import { useState } from 'react';
import { type Place } from './placeCatalog';
import { preparePlaceArtwork } from './placeArtwork';
import { addPlace, movePlace, PlaceOrganisation, placesIn, removeEmptyFolder, removePlace, setPlaceArtwork } from './placeFolders';

type Props = { organisation: PlaceOrganisation; storageIssue: string | null; onSave: (next: PlaceOrganisation) => boolean };

export default function Places({ organisation, storageIssue, onSave }: Props) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Place | null>(null);
  const [editing, setEditing] = useState<'new' | 'rename' | null>(null);
  const [folderName, setFolderName] = useState('');
  const [message, setMessage] = useState('');
  const [movingId, setMovingId] = useState<string | null>(null);
  const [addingPlace, setAddingPlace] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [placeFile, setPlaceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const folder = organisation.folders.find(item => item.id === folderId);
  const allPlaces = placesIn(organisation);
  const visiblePlaces = allPlaces.filter(place => organisation.assignments[place.id] === (folder?.id ?? null));
  const openFolder = (id: string) => { setFolderId(id); setPreview(null); setEditing(null); setMovingId(null); setAddingPlace(false); setMessage(''); };
  const back = () => { setFolderId(null); setPreview(null); setEditing(null); setMovingId(null); setAddingPlace(false); setMessage(''); };
  const beginCreate = () => { setEditing('new'); setFolderName(''); setMessage(''); };
  const beginRename = () => { if (!folder || folder.protected) return; setEditing('rename'); setFolderName(folder.name); setMessage(''); };
  const saveFolder = () => {
    const clean = folderName.trim().replace(/\s+/g, ' ');
    if (!clean || clean.length > 40) { setMessage('Enter a folder name between 1 and 40 characters.'); return; }
    if (organisation.folders.some(item => item.name.toLocaleLowerCase() === clean.toLocaleLowerCase() && item.id !== (editing === 'rename' ? folderId : null))) { setMessage('A folder with that name already exists.'); return; }
    const next: PlaceOrganisation = editing === 'rename' && folder
      ? { ...organisation, folders: organisation.folders.map(item => item.id === folder.id ? { ...item, name: clean } : item) }
      : { ...organisation, folders: [...organisation.folders, { id: `folder-${crypto.randomUUID()}`, name: clean, protected: false }] };
    if (!onSave(next)) { setMessage('Could not save the folder. Existing Places were left unchanged.'); return; }
    setEditing(null); setMessage(editing === 'rename' ? 'Folder renamed.' : 'Folder created.');
  };
  const deleteFolder = () => {
    if (!folder || folder.protected) return;
    const next = removeEmptyFolder(organisation, folder.id);
    if (!next) { setMessage('Move all places out before deleting this folder.'); return; }
    if (!window.confirm(`Delete the empty folder ${folder.name}?`)) return;
    if (!onSave(next)) { setMessage('Could not delete the folder. Existing Places were left unchanged.'); return; }
    back(); setMessage('Empty folder deleted.');
  };
  const move = (place: Place, destination: string | null) => {
    const next = movePlace(organisation, place.id, destination);
    if (!next || !onSave(next)) { setMessage('Could not move the place. Existing Places were left unchanged.'); return; }
    setPreview(null); setMovingId(null); setFolderId(destination);
    setMessage(`${place.name} moved to ${organisation.folders.find(item => item.id === destination)?.name ?? 'Top-level Places'}.`);
    requestAnimationFrame(() => document.querySelector('.places-page .overview-heading')?.scrollIntoView({ block: 'start' }));
  };
  const createPlace = async () => {
    const draft = addPlace(organisation, `place-${crypto.randomUUID()}`, placeName, folder?.id ?? null);
    if (!draft) { setMessage('Enter a unique place name between 1 and 60 characters.'); return; }
    if (!placeFile) { setMessage('Choose a background image to add this place.'); return; }
    setBusy(true);
    try {
      const artwork = await preparePlaceArtwork(placeFile);
      const id = draft.customPlaces.at(-1)!.id;
      const next = setPlaceArtwork(draft, id, artwork)!;
      if (!onSave(next)) throw new Error('Could not save the place and artwork. Browser storage may be full; existing Places were left unchanged.');
      setAddingPlace(false); setPlaceName(''); setPlaceFile(null);
      setMessage(`${draft.customPlaces.at(-1)!.name} and its artwork added to ${folder?.name ?? 'Top-level Places'}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not add this place.'); }
    finally { setBusy(false); }
  };
  const uploadArtwork = async (place: Place, file: File | undefined) => {
    if (!file || place.protected) return;
    if (place.background && !window.confirm(`Replace the current artwork for ${place.name}?`)) return;
    setBusy(true);
    try {
      const artwork = await preparePlaceArtwork(file);
      const next = setPlaceArtwork(organisation, place.id, artwork);
      if (!next || !onSave(next)) throw new Error('Could not save the artwork. Browser storage may be full; existing artwork was left unchanged.');
      if (preview?.id === place.id) setPreview(placesIn(next).find(item => item.id === place.id) ?? null);
      setMessage(`${place.name} artwork ${place.background ? 'replaced' : 'uploaded'} and saved.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not upload the artwork.'); }
    finally { setBusy(false); }
  };
  const deletePlace = (place: Place) => {
    if (place.protected || !window.confirm(`Delete ${place.name} from Places? This does not change the Playground or saved scene.`)) return;
    const next = removePlace(organisation, place.id);
    if (!next || !onSave(next)) { setMessage('Could not delete the place. Existing Places were left unchanged.'); return; }
    setMovingId(null); setPreview(null); setMessage(`${place.name} deleted from Places.`);
  };
  const placeCard = (place: Place) => <article className="place-card" key={place.id} id={`place-${place.id}`}>
    <div className={'place-art' + (place.artworkAvailable ? '' : ' artwork-needed')}>
      {place.artworkAvailable && place.background ? <img src={place.background} alt={`${place.name} background`} /> : <span>Artwork Needed</span>}
    </div>
    <div className="place-info">
      <span className={'portrait-tag' + (place.artworkAvailable ? ' approved-place' : '')}>{place.protected ? 'Approved Artwork' : place.artworkAvailable ? 'Uploaded Artwork' : 'Artwork Needed'}</span>
      <h3>{place.name}</h3>
      <p>{place.protected ? 'Default · Protected' : place.artworkAvailable ? 'Your background artwork' : 'Awaiting background artwork'}</p>
      <div className="place-actions">
        <button type="button" disabled={!place.artworkAvailable || !place.background} onClick={() => setPreview(place)} aria-label={`Preview ${place.name}`}>Preview</button>
        <button type="button" className="place-move-button" disabled={!!storageIssue} onClick={() => { setMovingId(movingId === place.id ? null : place.id); setMessage(''); }} aria-expanded={movingId === place.id} aria-controls={`move-options-${place.id}`}>Move</button>
        {!place.protected && <label className="place-upload">{place.background ? 'Replace Artwork' : 'Upload Artwork'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!!storageIssue || busy} onChange={event => { void uploadArtwork(place, event.target.files?.[0]); event.target.value = ''; }} /></label>}
        {!place.protected && <button type="button" className="place-delete-button" disabled={!!storageIssue} onClick={() => deletePlace(place)}>Delete</button>}
      </div>
      {movingId === place.id && <div className="move-panel" id={`move-options-${place.id}`} aria-label={`Move ${place.name}`}>
        <strong>Move {place.name} to:</strong>
        <div className="move-destinations">
          <button type="button" disabled={organisation.assignments[place.id] === null} onClick={() => move(place, null)}>Move to Places (top level){organisation.assignments[place.id] === null ? ' (current location)' : ''}</button>
          {organisation.folders.map(item => <button type="button" key={item.id} disabled={organisation.assignments[place.id] === item.id} onClick={() => move(place, item.id)}>Move to {item.name}{organisation.assignments[place.id] === item.id ? ' (current location)' : ''}</button>)}
        </div>
        <button type="button" className="move-cancel" onClick={() => setMovingId(null)}>Cancel</button>
      </div>}
    </div>
  </article>;

  return <div className="places-page">
    <div className="page-intro"><p className="eyebrow">CARTOON PLACES</p><h1>Explore your <em>places.</em></h1><p>Organise and preview approved backgrounds. Your Playground scene stays unchanged.</p></div>
    {storageIssue && <p className="storage-alert" role="alert">Places folders need attention: {storageIssue} Existing data has not been changed.</p>}
    <div className="overview-heading">
      <div><p className="eyebrow">YOUR BACKGROUNDS</p><h2>{folder ? folder.name : 'Places Library'}</h2><p>{folder ? 'Open a place preview or move a place to another folder.' : 'Open a folder to see its places. Bedroom and Garden still need approved artwork.'}</p></div>
      <div className="places-heading-actions">
        {folder ? <button className="places-primary" onClick={back}>← Back to Places</button> : <button className="places-primary" onClick={beginCreate} disabled={!!storageIssue}>+ New Folder</button>}
        <button className="places-primary" onClick={() => { setAddingPlace(true); setPlaceName(''); setPlaceFile(null); setMessage(''); }} disabled={!!storageIssue}>+ Add Place</button>
      </div>
    </div>
    {message && <p className="place-notice" role="status">{message}</p>}
    {editing && <div className="folder-form"><label htmlFor="folder-name">Folder name<input id="folder-name" autoFocus maxLength={40} value={folderName} onChange={event => setFolderName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveFolder(); }} /></label><button onClick={saveFolder}>{editing === 'rename' ? 'Save name' : 'Create Folder'}</button><button onClick={() => { setEditing(null); setMessage(''); }}>Cancel</button></div>}
    {addingPlace && <div className="folder-form" aria-label="Add Place"><label htmlFor="place-name">Place name<input id="place-name" autoFocus maxLength={60} value={placeName} onChange={event => setPlaceName(event.target.value)} /></label><label htmlFor="place-image">Background artwork<input id="place-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setPlaceFile(event.target.files?.[0] ?? null)} /></label><button type="button" disabled={busy} onClick={() => void createPlace()}>{busy ? 'Saving…' : 'Add Place'}</button><button type="button" disabled={busy} onClick={() => { setAddingPlace(false); setPlaceFile(null); setMessage(''); }}>Cancel</button><p className="place-form-note">Choose a PNG, JPEG or WebP image. The image is saved in this browser and included in Studio Backup.</p></div>}
    {folder && !folder.protected && <div className="folder-tools"><button onClick={beginRename} disabled={!!storageIssue}>Rename</button><button onClick={deleteFolder} disabled={!!storageIssue}>Delete empty folder</button></div>}
    <section className="character-library" aria-label={folder ? `${folder.name} places` : 'Places folders'}>
      {visiblePlaces.length > 0 && <>{!folder && <h3 className="top-level-heading">Top-level Places</h3>}<div className="places-grid">{visiblePlaces.map(placeCard)}</div></>}
      {!folder && <div className="folder-grid">{organisation.folders.map(item => { const count = allPlaces.filter(place => organisation.assignments[place.id] === item.id).length; return <button className="folder-card" key={item.id} onClick={() => openFolder(item.id)}><span className="folder-icon" aria-hidden="true">▰</span><strong>{item.name}</strong><small>{count} {count === 1 ? 'place' : 'places'}{item.protected ? ' · Default' : ''}</small><span className="folder-open">Open folder →</span></button>; })}</div>}
      {visiblePlaces.length === 0 && <p className="folder-empty">{folder ? 'This folder is empty. Open another folder and use Move on a place to put it here.' : 'No places at the top level.'}</p>}
    </section>
    {preview?.background && <section className="place-preview" aria-label={`${preview.name} preview`}>
      <div className="place-preview-heading"><div><p className="eyebrow">BACKGROUND PREVIEW</p><h2>{preview.name}</h2></div><button type="button" onClick={() => setPreview(null)}>Close preview</button></div>
      <img src={preview.background} alt={`Full ${preview.name} background`} />
      <p>Preview only. Your Playground and saved scene are unchanged.</p>
    </section>}
  </div>;
}

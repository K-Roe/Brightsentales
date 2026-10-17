import { AUDIO_MIMES, type AudioAsset, type AudioBackupAsset, type AudioKind, validAudioBackup } from './audio';

const DB = 'brightsenappstales.audio.v1';
const STORE = 'assets';
const RECOVERY = 'restore-recovery';
const db = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB, 2);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    if (!request.result.objectStoreNames.contains(RECOVERY)) request.result.createObjectStore(RECOVERY);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('Audio Library storage is unavailable.'));
});
const transaction = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> => {
  const database = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    let value: T;
    tx.oncomplete = () => { database.close(); resolve(value); };
    tx.onerror = () => { database.close(); reject(new Error('Audio Library storage failed or is full.')); };
    tx.onabort = () => { database.close(); reject(new Error('Audio Library storage was interrupted.')); };
    run(tx.objectStore(STORE), result => { value = result; });
  });
};

export const listAudioAssets = () => transaction<AudioAsset[]>('readonly', (store, done) => { const request = store.getAll(); request.onsuccess = () => done(request.result as AudioAsset[]); });
export const saveAudioAsset = (asset: AudioAsset) => transaction<void>('readwrite', store => { store.put(asset); });
export const removeAudioAsset = (id: string) => transaction<void>('readwrite', store => { store.delete(id); });
export const replaceAudioAssets = (assets: AudioAsset[]) => transaction<void>('readwrite', store => { store.clear(); assets.forEach(asset => store.put(asset)); });

// The snapshot and replacement commit in one IndexedDB transaction. A crash
// cannot leave half an audio library, and startup can restore the old one.
export async function replaceAudioAssetsWithSnapshot(assets: AudioAsset[]): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE, RECOVERY], 'readwrite');
    const current = tx.objectStore(STORE);
    const recovery = tx.objectStore(RECOVERY);
    const read = current.getAll();
    read.onsuccess = () => {
      recovery.put(read.result, 'pending');
      current.clear();
      assets.forEach(asset => current.put(asset));
    };
    tx.oncomplete = () => { database.close(); resolve(); };
    tx.onerror = () => { database.close(); reject(new Error('Audio restore storage failed.')); };
    tx.onabort = () => { database.close(); reject(new Error('Audio restore was interrupted.')); };
  });
}

export async function rollbackAudioRestore(): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE, RECOVERY], 'readwrite');
    const current = tx.objectStore(STORE);
    const recovery = tx.objectStore(RECOVERY);
    const read = recovery.get('pending');
    read.onsuccess = () => {
      if (read.result === undefined) return;
      current.clear();
      (read.result as AudioAsset[]).forEach(asset => current.put(asset));
      recovery.delete('pending');
    };
    tx.oncomplete = () => { database.close(); resolve(); };
    tx.onerror = () => { database.close(); reject(new Error('Audio rollback failed.')); };
    tx.onabort = () => { database.close(); reject(new Error('Audio rollback was interrupted.')); };
  });
}

export async function finishAudioRestore(): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(RECOVERY, 'readwrite');
    tx.objectStore(RECOVERY).delete('pending');
    tx.oncomplete = () => { database.close(); resolve(); };
    tx.onerror = () => { database.close(); reject(new Error('Audio restore cleanup failed.')); };
    tx.onabort = () => { database.close(); reject(new Error('Audio restore cleanup was interrupted.')); };
  });
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let output = '';
  for (let i = 0; i < bytes.length; i += 32768) output += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(output);
};
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const hash = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer))).map(n => n.toString(16).padStart(2, '0')).join('');

export async function audioBackupAssets(assets: AudioAsset[]): Promise<AudioBackupAsset[]> {
  return Promise.all(assets.map(async ({ blob, ...info }) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { ...info, data: bytesToBase64(bytes), sha256: await hash(bytes) };
  }));
}

export async function decodeAudioBackup(assets: unknown): Promise<AudioAsset[]> {
  if (!validAudioBackup(assets)) throw new Error('Backup audio data is invalid. Nothing was changed.');
  return Promise.all(assets.map(async ({ data, sha256, ...info }) => {
    const bytes = base64ToBytes(data);
    if (bytes.length !== info.size || await hash(bytes) !== sha256) throw new Error(`Audio file “${info.name}” is corrupt. Nothing was changed.`);
    return { ...info, blob: new Blob([bytes], { type: info.mime }) };
  }));
}

export async function importAudioFile(file: File, kind: AudioKind): Promise<AudioAsset> {
  const mime = file.type.toLowerCase();
  if (!AUDIO_MIMES.includes(mime)) throw new Error('Choose an MP3, WAV or OGG audio file supported by this browser.');
  if (!file.size || file.size > 20_000_000) throw new Error('Audio files must be between 1 byte and 20 MB.');
  const context = new AudioContext();
  let duration: number;
  try { duration = (await context.decodeAudioData(await file.arrayBuffer())).duration; }
  catch { throw new Error('This browser could not decode the audio file.'); }
  finally { await context.close(); }
  if (!Number.isFinite(duration) || duration <= 0 || duration > 36000) throw new Error('The audio duration is not supported.');
  return { id: crypto.randomUUID(), name: file.name.slice(0, 120).trim(), kind, mime, duration, size: file.size, blob: file };
}

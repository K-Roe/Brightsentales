import type { AudioAsset } from './audio';
import { finishAudioRestore, replaceAudioAssetsWithSnapshot, rollbackAudioRestore } from './audioStore';
import { LIBRARY_KEY } from './maker';
import { STORAGE_KEY } from './scene';
import { finalizeStudioRestore, recoverStudioRestore, restoreStudioBackup, type StudioBackup } from './studioBackup';

export const AUDIO_RESTORE_KEY = 'brightsenappstales.audio-restore.v1';
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type AudioRestoreOperations = {
  replaceWithSnapshot: (assets: AudioAsset[]) => Promise<void>;
  rollback: () => Promise<void>;
  finish: () => Promise<void>;
};
const audioOperations: AudioRestoreOperations = {
  replaceWithSnapshot: replaceAudioAssetsWithSnapshot,
  rollback: rollbackAudioRestore,
  finish: finishAudioRestore,
};
type Result = { ok: true } | { ok: false; error: string };

// Called before App reads either store. An interrupted restore rolls both
// stores back; a committed restore finishes cleanup while keeping both new.
export async function recoverCoordinatedRestore(storage: Storage, audio: AudioRestoreOperations = audioOperations): Promise<Result> {
  let phase: string | null;
  try { phase = storage.getItem(AUDIO_RESTORE_KEY); }
  catch { return { ok: false, error: 'Studio restore recovery cannot read browser storage.' }; }
  if (phase === null) return recoverStudioRestore(storage, LIBRARY_KEY, STORAGE_KEY) as Result;
  if (phase !== 'pending' && phase !== 'committed') return { ok: false, error: 'Studio audio restore marker is invalid. Existing data was left untouched.' };
  try {
    if (phase === 'pending') {
      const result = recoverStudioRestore(storage, LIBRARY_KEY, STORAGE_KEY);
      if (!result.ok) return { ok: false, error: result.error ?? 'Studio restore recovery failed.' };
      await audio.rollback();
    } else {
      const result = finalizeStudioRestore(storage);
      if (!result.ok) return { ok: false, error: result.error ?? 'Studio restore finalisation failed.' };
      await audio.finish();
    }
    storage.removeItem(AUDIO_RESTORE_KEY);
    return { ok: true };
  } catch { return { ok: false, error: 'Studio audio restore recovery is incomplete. Reload and retry before editing.' }; }
}

export async function restoreStudioWithAudio(storage: Storage, backup: StudioBackup, assets: AudioAsset[], audio: AudioRestoreOperations = audioOperations): Promise<Result> {
  try {
    if (storage.getItem(AUDIO_RESTORE_KEY) !== null) return { ok: false, error: 'Finish the previous Studio restore before starting another.' };
    storage.setItem(AUDIO_RESTORE_KEY, 'pending');
    await audio.replaceWithSnapshot(assets);
    const result = restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, backup, undefined, undefined, undefined, true);
    if (!result.ok) throw new Error(result.error ?? 'Studio restore failed.');
    storage.setItem(AUDIO_RESTORE_KEY, 'committed');
    const finished = await recoverCoordinatedRestore(storage, audio);
    return finished;
  } catch (error) {
    const recovered = await recoverCoordinatedRestore(storage, audio);
    if (!recovered.ok) return recovered;
    return { ok: false, error: error instanceof Error ? error.message : 'Studio restore failed. Existing data was kept.' };
  }
}

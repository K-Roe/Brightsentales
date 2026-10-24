export const WORKSPACE_KEY = 'brightsenappstales.preferred-workspace';

export type Workspace = 'studio3' | 'classic';

/** Presentation only. Scene and backup storage never depend on this key. */
export function readWorkspace(storage?: Pick<Storage, 'getItem'> | null): Workspace {
  try {
    const value = (storage === undefined ? localStorage : storage)?.getItem(WORKSPACE_KEY);
    return value === 'classic' ? 'classic' : 'studio3';
  } catch {
    return 'studio3';
  }
}

export function saveWorkspace(workspace: Workspace, storage?: Pick<Storage, 'setItem'> | null): boolean {
  try {
    (storage === undefined ? localStorage : storage)?.setItem(WORKSPACE_KEY, workspace);
    return true;
  } catch {
    return false;
  }
}

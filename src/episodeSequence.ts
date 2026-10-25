/** Sequence operations address occurrences by position, so repeated scene IDs stay independent. */
export function moveSceneOccurrence(ids: string[], from: number, to: number): string[] {
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length || from === to) return ids;
  const next = [...ids];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

export function duplicateSceneOccurrence(ids: string[], index: number): string[] {
  if (index < 0 || index >= ids.length) return ids;
  const next = [...ids];
  next.splice(index + 1, 0, ids[index]);
  return next;
}

export function removeSceneOccurrence(ids: string[], index: number): string[] {
  if (index < 0 || index >= ids.length) return ids;
  return ids.filter((_, position) => position !== index);
}

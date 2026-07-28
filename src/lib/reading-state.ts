// Client-side reading state for published technology signals (P4 v0.4).
// Read marks and read-later marks live only in the reader's browser
// localStorage — no accounts, no server-side profile, exactly the boundary
// the followed-topic radar already set in `followed-tags.ts`. Reads are
// guarded so this module stays safe to import from components that also
// render on the server.

export type ReadingMark = "read" | "saved";

const storageKeys: Record<ReadingMark, string> = {
  read: "ai-tech-radar:read-technology-ids",
  saved: "ai-tech-radar:saved-technology-ids"
};

export const readingStateChangedEventName =
  "ai-tech-radar:reading-state-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function readMarkedTechnologyIds(mark: ReadingMark): string[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKeys[mark]);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeMarkedTechnologyIds(
  mark: ReadingMark,
  technologyIds: string[]
): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(
      storageKeys[mark],
      JSON.stringify(Array.from(new Set(technologyIds)))
    );
    window.dispatchEvent(new CustomEvent(readingStateChangedEventName));
  } catch {
    // Storage unavailable (private mode, quota) — marks simply do not persist.
  }
}

export function toggleMarkedTechnologyId(
  mark: ReadingMark,
  technologyId: string
): string[] {
  const next = toggleIdInList(readMarkedTechnologyIds(mark), technologyId);

  writeMarkedTechnologyIds(mark, next);

  return next;
}

/**
 * Pure core: appends an id or removes it. New ids go to the end, so the
 * stored order is "oldest mark first" — the read-later view reverses it to
 * show the most recently saved signal at the top.
 */
export function toggleIdInList(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

/**
 * Pure core: the saved signals in most-recently-saved-first order. Saved ids
 * that no longer resolve to a published signal are dropped rather than
 * rendered as a dead row — a signal can be archived after it was saved.
 */
export function selectSavedTechnologies<T extends { id: string }>(
  technologies: T[],
  savedIds: string[]
): T[] {
  return savedIds
    .map((id) => technologies.find((item) => item.id === id))
    .filter((item): item is T => Boolean(item))
    .reverse();
}

/**
 * Pure core: drops read signals when the reader turned the "hide read"
 * switch on. Kept separate from the components so the rule is testable
 * without rendering.
 */
export function applyReadFilter<T extends { id: string }>(
  technologies: T[],
  readIds: string[],
  hideRead: boolean
): T[] {
  if (!hideRead) {
    return technologies;
  }

  return technologies.filter((item) => !readIds.includes(item.id));
}

/** Pure core: how many of the given signals the reader has already read. */
export function countReadTechnologies<T extends { id: string }>(
  technologies: T[],
  readIds: string[]
): number {
  return technologies.filter((item) => readIds.includes(item.id)).length;
}

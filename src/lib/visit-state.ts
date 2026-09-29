// Client-side "new since your last visit" state for published technology
// signals. Like the read / read-later marks (`reading-state.ts`) and the
// followed topics (`followed-tags.ts`) it lives only in this browser's
// localStorage — no account, no server-side profile — so the served HTML is
// identical for everyone and the 新 stamp appears after mount.
//
// "New" is judged by the set of signals the browser already knew, not by
// `publishDate`. `publishDate` is the source's own date, and a signal reaches
// the site one to five days after it (measured 2026-09-30: 85 of 91
// published signals entered the workspace a day or more after their
// publishDate, median two), so a reader who comes daily would almost never
// see a signal whose date is later than their last visit.
//
// One key holds everything:
//   baselineKeys  the signals known when this visit began — the comparison
//                 set, fixed for the whole visit; null until a second visit,
//                 so a first visit marks nothing
//   knownKeys     the published signals at the latest recording
//   lastActiveAt  when a list page last recorded; a gap longer than
//                 `visitGapMs` starts a new visit
//
// Signals are stored as short hashes of their ids (`toVisitKey`), not the ids
// themselves: workspace ids run to ~100 characters, so the home page would
// otherwise ship ~9 KB of ids to record a visit. A collision can only hide
// one 新 stamp.
//
// A visit is a run of page loads with no gap over 30 minutes — the same
// rule analytics sessions use. It survives reloads and new tabs (both read
// the same key), which a sessionStorage baseline would not: a new tab has an
// empty sessionStorage and would advance the baseline, wiping the marks.
//
// Only pages that hold the full published list may record (the home page,
// the 精选 and 我关注的 views). A detail page knows a handful of signals; had
// it recorded them, the next home visit would mark nearly everything 新.

const storageKey = "ai-tech-radar:visit-state";

/** A gap longer than this between recordings starts a new visit. */
export const visitGapMs = 30 * 60 * 1000;

/**
 * Safety cap on stored keys. knownKeys is replaced, not accumulated, on
 * every recording, so it is naturally the published count (91 on
 * 2026-09-30, ~0.7 KB) and archived signals drop out; the cap only guards
 * against a corrupt or foreign value growing the key.
 */
export const maxKnownKeys = 5000;

export interface VisitState {
  baselineKeys: string[] | null;
  knownKeys: string[];
  lastActiveAt: number;
}

/**
 * Pure core: a short, stable key for a signal id — 32-bit FNV-1a in base 36
 * (at most 7 characters). Used identically on the server (to build the list
 * the home page passes down) and in the browser.
 */
export function toVisitKey(technologyId: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < technologyId.length; index += 1) {
    hash ^= technologyId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

export function toVisitKeys(technologyIds: string[]): string[] {
  return Array.from(new Set(technologyIds.map(toVisitKey)));
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/** Pure core: tolerant parse of the stored value; anything odd is "no state". */
export function parseVisitState(raw: string | null): VisitState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const { baselineKeys, knownKeys, lastActiveAt } = parsed as Record<
      string,
      unknown
    >;

    if (
      !(baselineKeys === null || isStringArray(baselineKeys)) ||
      !isStringArray(knownKeys) ||
      typeof lastActiveAt !== "number" ||
      !Number.isFinite(lastActiveAt)
    ) {
      return null;
    }

    return {
      baselineKeys: baselineKeys?.slice(0, maxKnownKeys) ?? null,
      knownKeys: knownKeys.slice(0, maxKnownKeys),
      lastActiveAt
    };
  } catch {
    return null;
  }
}

/**
 * Pure core: the state after a list page loads holding `publishedKeys` (the
 * whole published list) at time `now`.
 *
 * - no stored state: a first visit. Nothing is new; the list is remembered.
 * - stored, last activity over `visitGapMs` ago: a new visit. What the
 *   browser knew last time becomes the baseline.
 * - stored, recent activity: the same visit (a reload, another tab, another
 *   list page). The baseline stays put, so the marks do too.
 *
 * knownKeys is replaced by the current list rather than merged with it:
 * every caller holds the whole published list, so a key missing from it is
 * an archived signal and does not need remembering.
 */
export function advanceVisitState(
  stored: VisitState | null,
  publishedKeys: string[],
  now: number,
  gapMs: number = visitGapMs
): VisitState {
  const knownKeys = Array.from(new Set(publishedKeys)).slice(0, maxKnownKeys);

  if (!stored) {
    return { baselineKeys: null, knownKeys, lastActiveAt: now };
  }

  // A clock that went backwards reads as the same visit rather than a new
  // one, so it cannot wipe the marks.
  const isNewVisit = now - stored.lastActiveAt > gapMs;

  return {
    baselineKeys: isNewVisit
      ? // An empty known list (an older, broken write) would make every
        // signal new; treat it like a first visit instead.
        stored.knownKeys.length > 0
        ? stored.knownKeys
        : null
      : stored.baselineKeys,
    knownKeys,
    lastActiveAt: now
  };
}

/**
 * Pure core: whether a signal is new to this reader. Nothing is new on a
 * first visit, and a signal the reader has marked read is never new — they
 * have seen it, whatever visit they did it in.
 */
export function isNewSinceLastVisit(
  baselineKeys: string[] | null,
  technologyId: string,
  readIds: string[] = []
): boolean {
  if (baselineKeys === null || readIds.includes(technologyId)) {
    return false;
  }

  return !baselineKeys.includes(toVisitKey(technologyId));
}

/** Pure core: how many of the given signals are new to this reader. */
export function countNewSinceLastVisit<T extends { id: string }>(
  technologies: T[],
  baselineKeys: string[] | null,
  readIds: string[] = []
): number {
  return technologies.filter((item) =>
    isNewSinceLastVisit(baselineKeys, item.id, readIds)
  ).length;
}

/**
 * Browser side: advances and stores the visit state for a list page, and
 * returns the baseline to compare against. Returns null (nothing new) when
 * storage is unavailable, so a private window simply shows no stamps.
 */
export function recordVisit(publishedKeys: string[]): string[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const next = advanceVisitState(
      parseVisitState(window.localStorage.getItem(storageKey)),
      publishedKeys,
      Date.now()
    );

    window.localStorage.setItem(storageKey, JSON.stringify(next));

    return next.baselineKeys;
  } catch {
    return null;
  }
}

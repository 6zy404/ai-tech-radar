// Client-side followed-topic storage for the personal radar (P4 v0).
// Follows live only in the reader's browser localStorage — no accounts, no
// server-side profile state. Reads are guarded so the module is safe to
// import from components that also render on the server.

const followedTagsStorageKey = "ai-tech-radar:followed-tag-ids";

export const followedTagsChangedEventName =
  "ai-tech-radar:followed-tags-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function readFollowedTagIds(): string[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(followedTagsStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeFollowedTagIds(tagIds: string[]): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(
      followedTagsStorageKey,
      JSON.stringify(Array.from(new Set(tagIds)))
    );
    window.dispatchEvent(new CustomEvent(followedTagsChangedEventName));
  } catch {
    // Storage unavailable (private mode, quota) — follows simply do not persist.
  }
}

export function toggleFollowedTagId(tagId: string): string[] {
  const current = readFollowedTagIds();
  const next = current.includes(tagId)
    ? current.filter((id) => id !== tagId)
    : [...current, tagId];

  writeFollowedTagIds(next);

  return next;
}

// The follow set with `tagId` in or out, whatever it was before. Unlike a
// toggle, the outcome does not depend on the current state, so a control
// whose view of the state is stale (another tab changed it) still does what
// its label said.
export function withTagFollowed(
  tagIds: string[],
  tagId: string,
  followed: boolean
): string[] {
  if (followed) {
    return tagIds.includes(tagId) ? [...tagIds] : [...tagIds, tagId];
  }

  return tagIds.filter((id) => id !== tagId);
}

export function setTagFollowed(tagId: string, followed: boolean): string[] {
  const next = withTagFollowed(readFollowedTagIds(), tagId, followed);

  writeFollowedTagIds(next);

  return next;
}

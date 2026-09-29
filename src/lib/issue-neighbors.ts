/**
 * Previous / next neighbours of one issue in a dated series — the published
 * daily digests (keyed by `YYYY-MM-DD`) and the weekly reviews (keyed by
 * their Monday date). Keys sort lexically in date order, so no date parsing
 * is needed.
 *
 * `previous` is the latest key before `currentKey`, `next` the earliest key
 * after it. `currentKey` does not have to be in `keys`: the current week's
 * review renders even when that week has no signals, and still needs a way
 * back. Keys above `maxKey` are ignored, so a series can never page into the
 * future.
 */
export interface IssueNeighbors {
  previous?: string;
  next?: string;
}

export function findIssueNeighbors(
  keys: readonly string[],
  currentKey: string,
  options: { maxKey?: string } = {}
): IssueNeighbors {
  let previous: string | undefined;
  let next: string | undefined;

  for (const key of keys) {
    if (options.maxKey !== undefined && key > options.maxKey) {
      continue;
    }

    if (key < currentKey && (previous === undefined || key > previous)) {
      previous = key;
    } else if (key > currentKey && (next === undefined || key < next)) {
      next = key;
    }
  }

  return { previous, next };
}

import {
  getLocalStoreFingerprint,
  getStoreRevision
} from "@/lib/repositories/local-json-store";

/**
 * Memoizes one store read per store revision.
 *
 * The key has two halves on purpose. `getStoreRevision()` counts writes made
 * by *this* process; `getLocalStoreFingerprint()` (mtime and size of the named
 * files) catches writes made by another one, because `tasks:run-once` writes
 * the same files from its own process. Under the SQLite driver the fingerprint
 * is null and the counter alone applies, which is why the two are combined
 * rather than either used alone. `statSync` costs microseconds against the
 * milliseconds a parse costs, so the key is checked on every call.
 *
 * Memoize the **source read**, never the value a getter hands out, unless that
 * value is provably never mutated by a caller: the content pools and the
 * relation list still build a fresh array per call on top of this, so no
 * caller can reorder another's list. Every cache built on it needs a test for
 * both write paths — `content-pool-cache.test.ts` and
 * `link-relation-store-cache.test.ts` are the pattern — and removing the
 * fingerprint half must fail only the other-process one.
 */
export function memoizeStoreRead<T>(
  fileNames: string[],
  load: () => T
): () => T {
  let cached: { key: string; value: T } | undefined;

  return () => {
    const key = `${getStoreRevision()}::${getLocalStoreFingerprint(fileNames)}`;

    if (cached?.key === key) {
      return cached.value;
    }

    const value = load();
    cached = { key, value };

    return value;
  };
}

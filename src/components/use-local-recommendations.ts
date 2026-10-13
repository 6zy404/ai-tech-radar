"use client";

import { useEffect, useMemo, useState } from "react";

import {
  followedTagsChangedEventName,
  readFollowedTagIds
} from "@/lib/followed-tags";
import {
  decodeSignalVectorFile,
  recommendFromReading,
  signalVectorsPath,
  type DecodedSignalPool,
  type LocalRecommendation,
  type SignalCardFields
} from "@/lib/local-recommend";
import { toVisitKeys } from "@/lib/visit-state";

export const localRecommendMeasureName = "local-recommend:compute";
export const localRecommendDecodeMeasureName = "local-recommend:decode";

// Readable from the console (performance.getEntriesByName), nothing else.
function measure(name: string, start: number) {
  try {
    performance.measure(name, { start, end: performance.now() });
  } catch {
    // Older browsers without the options form; the measurement is optional.
  }
}

// One download per page load, shared by every block on the page. A failed or
// unusable file resolves to undefined and is not retried until the next load.
let poolPromise: Promise<DecodedSignalPool | undefined> | undefined;

function loadSignalPool(): Promise<DecodedSignalPool | undefined> {
  if (!poolPromise) {
    poolPromise = fetch(signalVectorsPath, {
      headers: { Accept: "application/json" }
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((file) => {
        const start = performance.now();
        const pool = decodeSignalVectorFile(file);

        measure(localRecommendDecodeMeasureName, start);
        return pool;
      })
      .catch(() => undefined);
  }

  return poolPromise;
}

export interface ShownRecommendation extends LocalRecommendation {
  card: SignalCardFields;
  seed: SignalCardFields;
}

/**
 * 「和你读过的相近」 for one block. Takes the reading marks from the host's
 * own `useReadingState`, so the block and the list beside it agree.
 *
 * Nothing is requested until the reader has at least one mark: a reader
 * without history downloads nothing, and the request that is made carries no
 * mark — it is the same file for everyone. The marks are hashed with
 * `toVisitKey`, the key the file uses, before they are matched.
 */
export function useLocalRecommendations({
  readIds,
  savedIds,
  isLoaded,
  limit
}: {
  readIds: string[];
  savedIds: string[];
  isLoaded: boolean;
  limit: number;
}): ShownRecommendation[] {
  const [pool, setPool] = useState<DecodedSignalPool | undefined>();
  const [followedTagIds, setFollowedTagIds] = useState<string[]>([]);
  const hasMarks = readIds.length > 0 || savedIds.length > 0;

  useEffect(() => {
    if (!isLoaded || !hasMarks || pool) {
      return;
    }

    let cancelled = false;

    loadSignalPool().then((loaded) => {
      if (!cancelled) {
        setPool(loaded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, hasMarks, pool]);

  useEffect(() => {
    const sync = () => setFollowedTagIds(readFollowedTagIds());

    sync();
    window.addEventListener(followedTagsChangedEventName, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(followedTagsChangedEventName, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return useMemo(() => {
    if (!pool || !hasMarks) {
      return [];
    }

    const start = performance.now();
    const result = recommendFromReading(
      {
        pool,
        readIds: toVisitKeys(readIds),
        savedIds: toVisitKeys(savedIds),
        followedTagIds
      },
      { limit }
    ).flatMap((recommendation) => {
      const card = pool.cards.get(recommendation.id);
      const seed = pool.cards.get(recommendation.seedId);

      return card && seed ? [{ ...recommendation, card, seed }] : [];
    });

    measure(localRecommendMeasureName, start);

    return result;
  }, [pool, hasMarks, readIds, savedIds, followedTagIds, limit]);
}

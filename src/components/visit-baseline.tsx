"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { useReadingState } from "@/components/use-reading-state";
import { isNewSinceLastVisit, recordVisit } from "@/lib/visit-state";

/**
 * Records this page load as part of a visit and returns the baseline to
 * compare against (`src/lib/visit-state.ts`). Call it only where
 * `publishedKeys` covers the whole published list — see that module for why.
 * Null until mounted, so the server render and hydration mark nothing.
 */
export function useVisitBaseline(publishedKeys: string[]): string[] | null {
  const [baselineKeys, setBaselineKeys] = useState<string[] | null>(null);

  // The list comes from the server and does not change while the page is
  // open; recording once on mount keeps the key from being rewritten on
  // every render (callers build a fresh array each time).
  useEffect(() => {
    setBaselineKeys(recordVisit(publishedKeys));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return baselineKeys;
}

const NewSignalContext = createContext<(technologyId: string) => boolean>(
  () => false
);

/**
 * For server-rendered cards (the home page's priority signals): records the
 * visit once for the section and lets each card's `NewSignalStamp` ask
 * whether its signal is new.
 */
export function VisitBaselineProvider({
  publishedKeys,
  children
}: {
  publishedKeys: string[];
  children: ReactNode;
}) {
  const baselineKeys = useVisitBaseline(publishedKeys);
  const { readIds } = useReadingState();

  return (
    <NewSignalContext.Provider
      value={(technologyId) =>
        isNewSinceLastVisit(baselineKeys, technologyId, readIds)
      }
    >
      {children}
    </NewSignalContext.Provider>
  );
}

/** The 新 stamp on a server-rendered card, inside `VisitBaselineProvider`. */
export function NewSignalStamp({ technologyId }: { technologyId: string }) {
  const isNew = useContext(NewSignalContext);

  return isNew(technologyId) ? <NewStamp /> : null;
}

export function NewStamp() {
  return (
    <DossierStampTag className="dossier-stamp-tag--new">新</DossierStampTag>
  );
}

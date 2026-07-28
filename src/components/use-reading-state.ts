"use client";

import { useCallback, useEffect, useState } from "react";

import {
  readMarkedTechnologyIds,
  readingStateChangedEventName,
  toggleMarkedTechnologyId
} from "@/lib/reading-state";

export interface ReadingState {
  readIds: string[];
  savedIds: string[];
  /** False until the first client-side read, so SSR and hydration agree. */
  isLoaded: boolean;
  isRead: (technologyId: string) => boolean;
  isSaved: (technologyId: string) => boolean;
  toggleRead: (technologyId: string) => void;
  toggleSaved: (technologyId: string) => void;
}

/**
 * Subscribes a signal list to the reader's local read / read-later marks.
 * Mirrors the followed-tags pattern: the custom event keeps components in
 * the same tab in sync, the storage event covers other tabs.
 */
export function useReadingState(): ReadingState {
  const [readIds, setReadIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => {
      setReadIds(readMarkedTechnologyIds("read"));
      setSavedIds(readMarkedTechnologyIds("saved"));
      setIsLoaded(true);
    };

    syncFromStorage();
    window.addEventListener(readingStateChangedEventName, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener(readingStateChangedEventName, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const toggleRead = useCallback((technologyId: string) => {
    setReadIds(toggleMarkedTechnologyId("read", technologyId));
  }, []);

  const toggleSaved = useCallback((technologyId: string) => {
    setSavedIds(toggleMarkedTechnologyId("saved", technologyId));
  }, []);

  const isRead = useCallback(
    (technologyId: string) => readIds.includes(technologyId),
    [readIds]
  );

  const isSaved = useCallback(
    (technologyId: string) => savedIds.includes(technologyId),
    [savedIds]
  );

  return {
    readIds,
    savedIds,
    isLoaded,
    isRead,
    isSaved,
    toggleRead,
    toggleSaved
  };
}

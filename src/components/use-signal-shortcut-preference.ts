"use client";

import { useCallback, useEffect, useState } from "react";

import {
  readSingleKeyShortcutsEnabled,
  signalShortcutPreferenceChangedEventName,
  writeSingleKeyShortcutsEnabled
} from "@/lib/signal-shortcut-preference";

/**
 * Whether j / k / o / s / x are on. Shared by the key handler and the switch
 * in the ? overlay; the custom event keeps the two in step within a tab (and
 * carries the value when storage is blocked), the storage event covers other
 * tabs.
 */
export function useSignalShortcutPreference(): [
  boolean,
  (enabled: boolean) => void
] {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const handleChanged = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;

      setEnabled(
        typeof detail === "boolean" ? detail : readSingleKeyShortcutsEnabled()
      );
    };
    const handleStorage = () => setEnabled(readSingleKeyShortcutsEnabled());

    setEnabled(readSingleKeyShortcutsEnabled());
    window.addEventListener(
      signalShortcutPreferenceChangedEventName,
      handleChanged
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        signalShortcutPreferenceChangedEventName,
        handleChanged
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const update = useCallback((next: boolean) => {
    setEnabled(next);
    writeSingleKeyShortcutsEnabled(next);
  }, []);

  return [enabled, update];
}

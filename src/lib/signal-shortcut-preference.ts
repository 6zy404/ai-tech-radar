// The reader's choice to turn the single-key list shortcuts off (WCAG 2.1.4:
// a shortcut made of one character key must be possible to turn off). A
// preference, not a reading mark: it lives only in this browser's
// localStorage, the same boundary as the theme choice in `theme.ts`, and
// every read and write is guarded so a blocked store just means "on".

const storageKey = "ai-tech-radar:signal-shortcuts-off";

export const signalShortcutPreferenceChangedEventName =
  "ai-tech-radar:signal-shortcut-preference-changed";

/** Pure core: the stored value means "off" only when it is exactly "1". */
export function parseSingleKeyShortcutsEnabled(raw: string | null): boolean {
  return raw !== "1";
}

export function readSingleKeyShortcutsEnabled(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    return parseSingleKeyShortcutsEnabled(
      window.localStorage.getItem(storageKey)
    );
  } catch {
    return true;
  }
}

export function writeSingleKeyShortcutsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (enabled) {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, "1");
    }
  } catch {
    // Storage unavailable — the choice holds for this page only.
  }

  window.dispatchEvent(
    new CustomEvent(signalShortcutPreferenceChangedEventName, {
      detail: enabled
    })
  );
}

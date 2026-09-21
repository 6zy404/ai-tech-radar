// Reader-chosen colour scheme (2026-09-21).
//
// Dark mode shipped 2026-07-15 as `@media (prefers-color-scheme: dark)` with no
// control. The CSS is now keyed off `:root[data-theme="dark"]` instead, and this
// module owns the one attribute that switches it.
//
// The boundary is the same as `followed-tags.ts` and `reading-state.ts`: the
// choice lives only in this browser's localStorage. There is no account, no
// server-side profile, and the served HTML is identical for everyone — which is
// also why the attribute has to be set by a script rather than rendered.
//
// Default is unchanged behaviour: with nothing stored, the OS preference wins.
// A stored value is an explicit override and beats the OS.

export type ThemeChoice = "light" | "dark";

export const themeStorageKey = "ai-tech-radar:theme";

export const themeChangedEventName = "ai-tech-radar:theme-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark";
}

/** The explicit choice this reader made, or null if they never made one. */
export function readStoredTheme(): ThemeChoice | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(themeStorageKey);

    return isThemeChoice(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** What the OS/browser asks for. */
export function readSystemTheme(): ThemeChoice {
  if (!isBrowser() || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(): ThemeChoice {
  return readStoredTheme() ?? readSystemTheme();
}

/**
 * Writes the attribute the stylesheet keys off, plus `color-scheme` so the
 * browser's own chrome — form controls, scrollbars, the canvas behind the page
 * — flips with it rather than staying light under a dark page.
 */
export function applyTheme(theme: ThemeChoice): void {
  if (!isBrowser()) {
    return;
  }

  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

export function writeTheme(theme: ThemeChoice): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // A private window can refuse to store. The attribute below still applies,
    // so the toggle works for this page view and simply does not persist.
  }

  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(themeChangedEventName));
}

/** The theme currently painted, read back from the attribute the script set. */
export function readAppliedTheme(): ThemeChoice {
  if (!isBrowser()) {
    return "light";
  }

  const attr = document.documentElement.getAttribute("data-theme");

  return isThemeChoice(attr) ? attr : resolveTheme();
}

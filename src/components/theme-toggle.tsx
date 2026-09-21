"use client";

import { useEffect } from "react";

import {
  readAppliedTheme,
  readStoredTheme,
  readSystemTheme,
  applyTheme,
  themeStorageKey,
  writeTheme
} from "@/lib/theme";

/**
 * The colour-scheme control in the top nav.
 *
 * Both icons are always in the markup and CSS decides which one shows, keyed on
 * the same `data-theme` attribute the stylesheet uses. That is deliberate: if
 * the icon depended on React state, the server would have to guess a theme it
 * cannot know, so the first paint would either mismatch on hydration or flip
 * visibly a moment later. Rendering both and letting CSS choose has neither
 * problem, and it also means the icon is correct before React hydrates.
 *
 * For the same reason the accessible name is fixed ("切换深浅色主题") rather than
 * naming the current state — a label that changes would have to come from state.
 */
export function ThemeToggle() {
  useEffect(() => {
    // Another tab changed the choice.
    const onStorage = (event: StorageEvent) => {
      if (event.key === themeStorageKey) {
        applyTheme(readStoredTheme() ?? readSystemTheme());
      }
    };

    // The OS flipped while the page is open. Only follow it when this reader
    // has not made an explicit choice — otherwise their choice would be
    // overridden by the machine going dark at sunset.
    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const onSystemChange = () => {
      if (readStoredTheme() === null) {
        applyTheme(readSystemTheme());
      }
    };

    window.addEventListener("storage", onStorage);
    media?.addEventListener("change", onSystemChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      media?.removeEventListener("change", onSystemChange);
    };
  }, []);

  return (
    <button
      type="button"
      className="top-nav__search-toggle top-nav__theme-toggle"
      aria-label="切换深浅色主题"
      title="切换深浅色主题"
      onClick={() => {
        writeTheme(readAppliedTheme() === "dark" ? "light" : "dark");
      }}
    >
      <svg
        className="top-nav__theme-icon top-nav__theme-icon--sun"
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="7.5"
          cy="7.5"
          r="3"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <line x1="7.5" y1="0.8" x2="7.5" y2="2.4" />
          <line x1="7.5" y1="12.6" x2="7.5" y2="14.2" />
          <line x1="0.8" y1="7.5" x2="2.4" y2="7.5" />
          <line x1="12.6" y1="7.5" x2="14.2" y2="7.5" />
          <line x1="2.8" y1="2.8" x2="3.9" y2="3.9" />
          <line x1="11.1" y1="11.1" x2="12.2" y2="12.2" />
          <line x1="12.2" y1="2.8" x2="11.1" y2="3.9" />
          <line x1="3.9" y1="11.1" x2="2.8" y2="12.2" />
        </g>
      </svg>
      <svg
        className="top-nav__theme-icon top-nav__theme-icon--moon"
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12.4 9.3A5.2 5.2 0 0 1 5.7 2.6 5.4 5.4 0 1 0 12.4 9.3Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

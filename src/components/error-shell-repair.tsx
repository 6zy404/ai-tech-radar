"use client";

import { useEffect } from "react";

import { applyTheme, resolveTheme } from "@/lib/theme";

/** The id Next puts on the `<html>` of the shell it serves after a render error. */
export const nextErrorShellId = "__next_error__";

// Read when this module loads, which is before React renders anything: once
// the client render commits, React applies the layout's props to the
// existing <html> and the id is gone, so an effect can no longer tell.
const servedAsErrorShell =
  typeof document !== "undefined" &&
  document.documentElement.id === nextErrorShellId;

/**
 * Restores what the root layout's `<html>` would have carried on a page Next
 * served as its error shell — the `lang` attribute and the colour scheme.
 *
 * Why this exists (Next 15.5, upstream behaviour): a `notFound()` thrown by a
 * dynamic page — an unknown signal slug, a digest date with no issue, a topic
 * with no content — fails the server render's shell, because server rendering
 * has no error boundaries. Next then answers 404 with an empty
 * `<html id="__next_error__">` document and renders the whole tree in the
 * browser instead of hydrating it. That client render brings back the nav and
 * the not-found page, and React then applies the layout's `lang` to the
 * `<html>` it takes over — but the theme script in the layout's `<head>` never
 * runs, because a script React inserts on the client does not execute. The
 * page stayed light for a dark reader, and until the bundle ran the document
 * had no language for a screen reader. Only the colour scheme can be restored
 * here; the served HTML is still Next's empty shell.
 * `/no-such-page` is unaffected: an unmatched route renders the not-found page
 * as an ordinary page.
 *
 * On every other page this does nothing and renders nothing, so it cannot
 * cause a hydration mismatch. The theme goes through the same functions the
 * toggle uses, which resolve it exactly as the inline script does.
 */
export function ErrorShellRepair({ lang }: { lang: string }) {
  useEffect(() => {
    if (!servedAsErrorShell) {
      return;
    }

    const root = document.documentElement;

    if (!root.lang) {
      root.lang = lang;
    }

    applyTheme(resolveTheme());
  }, [lang]);

  return null;
}

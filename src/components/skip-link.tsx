"use client";

import type { MouseEvent } from "react";

import { mainContentId, workspaceContentId } from "@/lib/skip-link-targets";

/**
 * 跳到正文: the first focusable element on every page. Invisible until it is
 * focused (see styles/components/skip-link.css).
 *
 * The href works without JavaScript — the browser moves focus to the
 * `tabIndex={-1}` <main>. With JavaScript the click prefers the workspace
 * content column when the page has one, and moves focus without writing a
 * `#main-content` fragment into the address bar.
 */
export function SkipLink() {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const target =
      document.getElementById(workspaceContentId) ??
      document.getElementById(mainContentId);

    if (!target) {
      return;
    }

    event.preventDefault();
    target.focus();
  };

  return (
    <a className="skip-link" href={`#${mainContentId}`} onClick={handleClick}>
      跳到正文
    </a>
  );
}

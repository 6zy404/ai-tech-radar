"use client";

import { useEffect, useRef, useState } from "react";

import { commonCopy } from "@/lib/i18n/copy/common";
import { useLocale } from "@/lib/i18n/use-locale";
import { buildPageLinkUrl } from "@/lib/page-link";
import { getSiteUrl } from "@/lib/site-metadata";

/** How long 「已复制」 stays on the button before it reads 复制链接 again. */
const copiedResetMs = 2000;

/**
 * 复制链接 in the hero of every public detail page (signal, skill, knowledge,
 * digest). Copies the page's canonical address — `sharePath` on the site URL,
 * never the address bar, which can carry a query or be `/digest/today` —
 * then reads 已复制 for two seconds; a screen reader hears it through the
 * status line. No request, no storage.
 *
 * When the browser refuses the clipboard, the address appears in a
 * read-only box, selected, to copy by hand — the 复制答案 fallback on /ask.
 */
export function CopyLinkButton({ sharePath }: { sharePath: string }) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const fallbackRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (fallbackUrl) {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }, [fallbackUrl]);

  const copy = commonCopy[useLocale()].copyLink;

  async function handleCopy() {
    const url = buildPageLinkUrl(getSiteUrl(), sharePath);
    window.clearTimeout(timerRef.current);

    try {
      await navigator.clipboard.writeText(url);
      setFallbackUrl("");
      setCopied(true);
      setStatus(copy.copiedStatus);
      timerRef.current = window.setTimeout(() => {
        setCopied(false);
        setStatus("");
      }, copiedResetMs);
    } catch {
      setCopied(false);
      setFallbackUrl(url);
      setStatus(copy.blocked);
    }
  }

  return (
    <div className="copy-link">
      <button
        type="button"
        className="copy-link-button"
        onClick={() => void handleCopy()}
      >
        {copied ? copy.copied : copy.copy}
      </button>
      {/* Heard, not seen, after a copy (the button already says 已复制);
          shown when it explains the fallback box. */}
      <span
        className={
          fallbackUrl
            ? "copy-link__status copy-link__status--shown"
            : "copy-link__status"
        }
        role="status"
      >
        {status}
      </span>
      {fallbackUrl ? (
        <input
          ref={fallbackRef}
          className="copy-link__fallback"
          type="text"
          readOnly
          value={fallbackUrl}
          aria-label={copy.fallbackLabel}
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}

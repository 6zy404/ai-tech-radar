"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

import { buildPageLinkUrl, getSectionLinkLabel } from "@/lib/page-link";
import { getSiteUrl } from "@/lib/site-metadata";

const feedbackResetMs = 2000;

interface SectionLinkProps {
  /** The section's element id — the same one 本页目录 links to. */
  sectionId: string;
  /** The page's public path; the copied address is its canonical URL. */
  sharePath: string;
  /** The section's h2 text, for the link's accessible name. */
  heading: string;
}

/**
 * The 「#」 beside a section heading. A click copies the section's canonical
 * address and puts `#id` in the address bar with replaceState (no history
 * entry, as 本页目录 does); without JS it is a plain in-page anchor.
 */
export function SectionLink({
  sectionId,
  sharePath,
  heading
}: SectionLinkProps) {
  const [feedback, setFeedback] = useState<"" | "copied" | "address-bar">("");
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.history.replaceState(null, "", `#${sectionId}`);
    window.clearTimeout(timerRef.current);

    try {
      await navigator.clipboard.writeText(
        buildPageLinkUrl(getSiteUrl(), sharePath, sectionId)
      );
      setFeedback("copied");
    } catch {
      // The address bar already holds the section's address.
      setFeedback("address-bar");
    }

    timerRef.current = window.setTimeout(
      () => setFeedback(""),
      feedbackResetMs
    );
  }

  return (
    <>
      <a
        className="section-link"
        href={`#${sectionId}`}
        aria-label={getSectionLinkLabel(heading)}
        onClick={(event) => void handleClick(event)}
      >
        #
      </a>
      <span className="section-link__status" role="status">
        {feedback === "copied"
          ? "已复制"
          : feedback === "address-bar"
            ? "已放进地址栏"
            : ""}
      </span>
    </>
  );
}

interface SectionHeadingProps {
  /** The section's element id. */
  sectionId?: string;
  /**
   * The page's public path. Omitted (the workspace previews), the heading is
   * a bare h2, exactly as before the 「#」 existed.
   */
  sharePath?: string;
  className?: string;
  children: string;
}

/**
 * A section's h2 with its 「#」 beside it. The link sits outside the h2, so
 * the heading's text and accessible name stay the section title alone.
 */
export function SectionHeading({
  sectionId,
  sharePath,
  className,
  children
}: SectionHeadingProps) {
  const heading = <h2 className={className}>{children}</h2>;

  if (!sectionId || !sharePath) {
    return heading;
  }

  return (
    <div className="section-heading-row">
      {heading}
      <SectionLink
        sectionId={sectionId}
        sharePath={sharePath}
        heading={children}
      />
    </div>
  );
}

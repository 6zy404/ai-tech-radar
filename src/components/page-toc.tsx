"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

import { commonCopy } from "@/lib/i18n/copy/common";
import { useLocale } from "@/lib/i18n/use-locale";
import { pickActiveTocId, type PageTocEntry } from "@/lib/page-toc";

interface PageTocProps {
  /** From `selectPageTocEntries`; an empty list renders nothing. */
  entries: PageTocEntry[];
  /**
   * `panel` sits in the aside and follows the reader down the page;
   * `disclosure` is the folded `<details>` at the top of the reading column
   * for widths where the aside has dropped below the article.
   */
  variant?: "panel" | "disclosure";
  /** The host page's own panel skin, so the table matches its neighbours. */
  className?: string;
  /**
   * The panel label's class, for a host whose panels label themselves with
   * something other than the shared eyebrow (the skill and knowledge aside
   * cards use `skill-detail-kicker`).
   */
  labelClassName?: string;
}

/**
 * Pixels below where an anchor jump lands a section (the html
 * scroll-padding-top plus its own scroll-margin-top) at which it counts as
 * the current one. A little slack, so the section just jumped to is current
 * even after sub-pixel rounding.
 */
const activationSlack = 16;

const intersectionThresholds = Array.from({ length: 21 }, (_, i) => i / 20);

function useActiveTocId(ids: string[]) {
  const [activeId, setActiveId] = useState<string>();
  const pinnedIdRef = useRef<string | undefined>(undefined);
  const idsKey = ids.join(" ");

  useEffect(() => {
    const elements = idsKey
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) {
      return;
    }

    // Called directly, without a requestAnimationFrame hop: observer
    // callbacks already arrive once per frame, and a dozen rect reads is
    // cheap.
    const update = () => {
      const root = document.documentElement;
      const landing =
        (Number.parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) +
        (Number.parseFloat(getComputedStyle(elements[0]).scrollMarginTop) || 0);
      const atBottom =
        window.innerHeight + window.scrollY >= root.scrollHeight - 2;

      setActiveId(
        pickActiveTocId(
          elements.map((element) => ({
            id: element.id,
            top: element.getBoundingClientRect().top
          })),
          {
            activationLine: landing + activationSlack,
            atBottom,
            pinnedId: pinnedIdRef.current
          }
        )
      );
    };

    // The observer is only the trigger: every change in how much of a
    // section is on screen asks for a recount, and the recount reads the
    // real geometry, so the answer never depends on which threshold fired.
    const observer = new IntersectionObserver(update, {
      threshold: intersectionThresholds
    });
    elements.forEach((element) => observer.observe(element));

    // A clicked entry stays current until the reader scrolls by hand.
    const unpin = () => {
      if (pinnedIdRef.current) {
        pinnedIdRef.current = undefined;
        update();
      }
    };
    const unpinOnKey = (event: KeyboardEvent) => {
      // Enter on a table link is the click that pins; Tab only moves focus.
      if (!["Enter", "Tab", "Shift"].includes(event.key)) {
        unpin();
      }
    };

    window.addEventListener("wheel", unpin, { passive: true });
    window.addEventListener("touchstart", unpin, { passive: true });
    window.addEventListener("keydown", unpinOnKey);
    window.addEventListener("resize", update);
    update();

    return () => {
      observer.disconnect();
      window.removeEventListener("wheel", unpin);
      window.removeEventListener("touchstart", unpin);
      window.removeEventListener("keydown", unpinOnKey);
      window.removeEventListener("resize", update);
    };
  }, [idsKey]);

  const pin = (id: string) => {
    pinnedIdRef.current = id;
    setActiveId(id);
  };

  return { activeId, pin };
}

export function PageToc({
  entries,
  variant = "panel",
  className,
  labelClassName = "eyebrow user-eyebrow"
}: PageTocProps) {
  const copy = commonCopy[useLocale()].pageToc;
  const tocLabel = copy.label;
  const { activeId, pin } = useActiveTocId(entries.map((entry) => entry.id));
  const detailsRef = useRef<HTMLDetailsElement>(null);

  if (entries.length === 0) {
    return null;
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);

    if (!target) {
      return;
    }

    event.preventDefault();
    // Fold first: the table sits above every section, so closing it after
    // the scroll started would pull the target up out of place.
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start"
    });
    window.history.replaceState(null, "", `#${id}`);
    pin(id);

    // Move focus with the view, onto the heading rather than the section, so
    // a keyboard reader's next Tab continues from there and the focus ring
    // (drawn only for keyboard use) wraps a line, not a whole section.
    const heading = target.querySelector<HTMLElement>("h2") ?? target;
    if (!heading.hasAttribute("tabindex")) {
      heading.setAttribute("tabindex", "-1");
    }
    heading.focus({ preventScroll: true });
  };

  const list = (
    <ol className="page-toc__list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <a
            className="page-toc__link"
            href={`#${entry.id}`}
            aria-current={entry.id === activeId ? "location" : undefined}
            onClick={(event) => handleClick(event, entry.id)}
          >
            {entry.label}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "disclosure") {
    return (
      <details
        ref={detailsRef}
        className={["page-toc page-toc--disclosure", className]
          .filter(Boolean)
          .join(" ")}
      >
        <summary className="page-toc__summary">
          {tocLabel}
          <span className="page-toc__count">{copy.count(entries.length)}</span>
        </summary>
        <nav aria-label={tocLabel}>{list}</nav>
      </details>
    );
  }

  return (
    <nav
      className={["page-toc page-toc--panel", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={tocLabel}
    >
      <p className={labelClassName}>{tocLabel}</p>
      {list}
    </nav>
  );
}

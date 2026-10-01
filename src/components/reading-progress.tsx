"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getReadingRatio, shouldShowBackToTop } from "@/lib/reading-progress";
import { mainContentId } from "@/lib/skip-link-targets";

/**
 * A thin progress line just under the top nav, and a 返回顶部 button in the
 * bottom-right corner once the reader is a screen down. Mounted by the long
 * reading pages only — the signal, skill, knowledge, digest and weekly-review
 * pages — each naming its reading region in `regionSelector`, so the line
 * measures the article, not the page around it.
 *
 * Both are `position: fixed`, so mounting them moves nothing. They sit inside
 * the page's `.dossier` element to inherit its colour tokens; nothing in that
 * chain sets a transform, which would make `fixed` mean "fixed to it".
 *
 * The line is hidden from assistive technology: where the reader is in the
 * page is already what a screen reader's own reading position tells them,
 * and a progressbar whose value changes on every scroll would only be noise.
 * The button is a real control.
 *
 * The workspace previews render the same components; under /workspace this
 * renders nothing. No request, no storage.
 */
export function ReadingProgress({
  regionSelector
}: {
  regionSelector: string;
}) {
  const pathname = usePathname();
  const inWorkspace = pathname?.startsWith("/workspace") ?? false;
  const barRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const bar = barRef.current;
    if (inWorkspace || !bar) {
      return;
    }

    let frame = 0;

    function update() {
      frame = 0;
      const nav = document.querySelector(".top-nav");
      const coveredTop = nav
        ? Math.max(0, nav.getBoundingClientRect().bottom)
        : 0;
      const box = document
        .querySelector(regionSelector)
        ?.getBoundingClientRect();
      const ratio = box
        ? getReadingRatio(box.top, box.height, coveredTop, window.innerHeight)
        : 0;

      // Written straight to the element: a re-render per scroll frame would
      // buy nothing. The button's state changes twice per page at most.
      bar!.style.top = `${coveredTop}px`;
      bar!.style.transform = `scaleX(${ratio})`;
      setShowBackToTop(shouldShowBackToTop(window.scrollY, window.innerHeight));
    }

    function schedule() {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // The region grows after first paint (the AI widgets, the 只看我关注的
    // filter, images), which moves the ratio without a scroll.
    const observer = new ResizeObserver(schedule);
    const region = document.querySelector(regionSelector);
    if (region) {
      observer.observe(region);
    }

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [inWorkspace, regionSelector]);

  if (inWorkspace) {
    return null;
  }

  function handleBackToTop() {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    // Where 跳到正文 lands, so the next Tab starts at the top of the page
    // rather than back at this button at its foot. preventScroll keeps the
    // focus change from cutting the smooth scroll short.
    document.getElementById(mainContentId)?.focus({ preventScroll: true });
  }

  return (
    <>
      <div ref={barRef} className="reading-progress" aria-hidden="true" />
      <button
        type="button"
        className={`reading-progress-top${showBackToTop ? " reading-progress-top--shown" : ""}`}
        aria-label="返回顶部"
        title="返回顶部"
        onClick={handleBackToTop}
      >
        <span aria-hidden="true">↑</span>
      </button>
    </>
  );
}

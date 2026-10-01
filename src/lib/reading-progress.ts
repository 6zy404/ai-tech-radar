// How far through a page's reading region the reader is, for the progress
// line under the top nav (src/components/reading-progress.tsx). Pure, so the
// arithmetic is tested without a browser.

/** Scroll past this many viewport heights before 返回顶部 appears. */
export const backToTopThresholdViewports = 1;

/**
 * 0 while the region's top is still below the nav, 1 once its bottom has
 * come into view at the foot of the window, linear in between.
 *
 * `regionTop` / `regionHeight` are the region's bounding box relative to the
 * viewport; `coveredTop` is the height the sticky nav hides at the top. A
 * region shorter than the uncovered window has no scroll range of its own:
 * it reads 1 once it is wholly in view and 0 before.
 */
export function getReadingRatio(
  regionTop: number,
  regionHeight: number,
  coveredTop: number,
  viewportHeight: number
): number {
  const visibleHeight = viewportHeight - coveredTop;
  const range = regionHeight - visibleHeight;

  if (range <= 0) {
    return regionTop + regionHeight <= viewportHeight ? 1 : 0;
  }

  const ratio = (coveredTop - regionTop) / range;
  return Math.min(1, Math.max(0, ratio));
}

export function shouldShowBackToTop(
  scrollY: number,
  viewportHeight: number
): boolean {
  return scrollY > viewportHeight * backToTopThresholdViewports;
}

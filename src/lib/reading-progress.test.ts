import { describe, expect, it } from "vitest";

import { getReadingRatio, shouldShowBackToTop } from "./reading-progress";

// A 900px window under a 60px nav: 840px of it is uncovered.
const nav = 60;
const viewport = 900;

describe("getReadingRatio", () => {
  it("is 0 while the region still starts below the nav", () => {
    expect(getReadingRatio(400, 3000, nav, viewport)).toBe(0);
    expect(getReadingRatio(nav, 3000, nav, viewport)).toBe(0);
  });

  it("is 1 once the region's bottom reaches the foot of the window", () => {
    // bottom = top + height = 900
    expect(getReadingRatio(viewport - 3000, 3000, nav, viewport)).toBe(1);
    expect(getReadingRatio(-5000, 3000, nav, viewport)).toBe(1);
  });

  it("is linear in between", () => {
    // range = 3000 - 840 = 2160; half of it scrolled past the nav
    expect(getReadingRatio(nav - 1080, 3000, nav, viewport)).toBeCloseTo(0.5);
  });

  it("treats a region shorter than the window as unread until wholly in view", () => {
    expect(getReadingRatio(700, 500, nav, viewport)).toBe(0);
    expect(getReadingRatio(300, 500, nav, viewport)).toBe(1);
  });
});

describe("shouldShowBackToTop", () => {
  it("waits for one full viewport of scrolling", () => {
    expect(shouldShowBackToTop(0, viewport)).toBe(false);
    expect(shouldShowBackToTop(viewport, viewport)).toBe(false);
    expect(shouldShowBackToTop(viewport + 1, viewport)).toBe(true);
  });
});

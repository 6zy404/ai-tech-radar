import { describe, expect, it, vi } from "vitest";

import { getPublishedDigestNeighbors } from "@/lib/digest-view";
import type { DailyDigest } from "@/types/content";

const { getDailyDigestsMock } = vi.hoisted(() => ({
  getDailyDigestsMock: vi.fn<() => Pick<DailyDigest, "date" | "status">[]>()
}));

vi.mock("@/lib/digest-workflow", () => ({
  getDailyDigests: getDailyDigestsMock,
  getDigestTechnologySections: vi.fn()
}));

vi.mock("@/lib/content", () => ({
  getAllKnowledge: vi.fn(() => []),
  getAllSkills: vi.fn(() => []),
  getAllTags: vi.fn(() => [])
}));

describe("getPublishedDigestNeighbors", () => {
  it("steps over draft and archived digests", () => {
    getDailyDigestsMock.mockReturnValue([
      { date: "2026-09-01", status: "published" },
      { date: "2026-09-05", status: "archived" },
      { date: "2026-09-10", status: "published" },
      { date: "2026-09-15", status: "draft" },
      { date: "2026-09-20", status: "published" }
    ]);

    expect(getPublishedDigestNeighbors("2026-09-10")).toEqual({
      previousDate: "2026-09-01",
      nextDate: "2026-09-20"
    });
    expect(getPublishedDigestNeighbors("2026-09-20")).toEqual({
      previousDate: "2026-09-10",
      nextDate: undefined
    });
    expect(getPublishedDigestNeighbors("2026-09-01")).toEqual({
      previousDate: undefined,
      nextDate: "2026-09-10"
    });
  });
});

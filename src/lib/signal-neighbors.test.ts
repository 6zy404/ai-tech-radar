import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  findSignalNeighbors,
  getSignalNeighbors,
  signalNeighborTitleMaxLength
} from "@/lib/signal-neighbors";
import { sortTechnologiesForBrowser } from "@/lib/technology-browser-query";
import { makeTechnologyItem } from "@/lib/test-factories";
import type { TechnologyItem } from "@/types/content";

const mocks = vi.hoisted(() => ({
  getAllTechnologies: vi.fn<() => TechnologyItem[]>()
}));

vi.mock("@/lib/content", () => ({
  getAllTechnologies: mocks.getAllTechnologies
}));

function signal(id: string, publishDate: string, zhTitle?: string) {
  return makeTechnologyItem({
    id,
    slug: `${id}-slug`,
    publishDate,
    title: { original: `${id} original`, zh: zhTitle }
  });
}

// Newest first, as getAllTechnologies returns it. b and c share a day and
// are in pool order, not slug order.
const list = [
  signal("a", "2026-09-30"),
  signal("c", "2026-09-20"),
  signal("b", "2026-09-20"),
  signal("d", "2026-09-01")
];

const titleOf = (item: TechnologyItem) => item.title.original;

describe("findSignalNeighbors", () => {
  it("gives the newest signal only an older neighbour", () => {
    expect(findSignalNeighbors(list, "a", titleOf)).toEqual({
      newer: undefined,
      older: { slug: "c-slug", title: "c original" }
    });
  });

  it("gives the oldest signal only a newer neighbour", () => {
    expect(findSignalNeighbors(list, "d", titleOf)).toEqual({
      newer: { slug: "b-slug", title: "b original" },
      older: undefined
    });
  });

  it("keeps the list's order for signals of the same day, not slug order", () => {
    expect(findSignalNeighbors(list, "c", titleOf)).toEqual({
      newer: { slug: "a-slug", title: "a original" },
      older: { slug: "b-slug", title: "b original" }
    });
    expect(findSignalNeighbors(list, "b", titleOf)).toEqual({
      newer: { slug: "c-slug", title: "c original" },
      older: { slug: "d-slug", title: "d original" }
    });
  });

  it("walks the same sequence as the 精选 list's default sort", () => {
    const shown = sortTechnologiesForBrowser(list, "latest", () => "watch");
    const walked = [list[0]];

    for (let step = 0; step < list.length - 1; step += 1) {
      const older = findSignalNeighbors(
        list,
        walked[walked.length - 1].id,
        titleOf
      ).older;
      walked.push(list.find((item) => item.slug === older?.slug)!);
    }

    expect(walked.map((item) => item.id)).toEqual(shown.map((item) => item.id));
  });

  it("returns nothing for a signal that is not in the list", () => {
    expect(findSignalNeighbors(list, "draft", titleOf)).toEqual({});
  });

  it("returns no neighbours for the only signal", () => {
    expect(findSignalNeighbors([list[0]], "a", titleOf)).toEqual({
      newer: undefined,
      older: undefined
    });
  });

  it("shortens a long title with an ellipsis", () => {
    const long = "一".repeat(signalNeighborTitleMaxLength + 10);
    const result = findSignalNeighbors(
      [signal("x", "2026-09-02", long), list[3]],
      "d",
      (item) => item.title.zh ?? item.title.original
    );

    expect(result.newer?.title.length).toBeLessThanOrEqual(
      signalNeighborTitleMaxLength
    );
    expect(result.newer?.title.endsWith("…")).toBe(true);
  });
});

describe("getSignalNeighbors", () => {
  beforeEach(() => {
    mocks.getAllTechnologies.mockReset();
  });

  it("reads the published list and shows the Chinese title when there is one", () => {
    mocks.getAllTechnologies.mockReturnValue([
      signal("a", "2026-09-30", "甲信号"),
      signal("b", "2026-09-20"),
      signal("c", "2026-09-10", "丙信号")
    ]);

    expect(getSignalNeighbors("b")).toEqual({
      newer: { slug: "a-slug", title: "甲信号" },
      older: { slug: "c-slug", title: "丙信号" }
    });
  });
});

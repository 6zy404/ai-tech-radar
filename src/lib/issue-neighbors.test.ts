import { describe, expect, it } from "vitest";

import { findIssueNeighbors } from "@/lib/issue-neighbors";

const keys = ["2026-09-01", "2026-09-10", "2026-09-20", "2026-09-28"];

describe("findIssueNeighbors", () => {
  it("gives the first issue only a next neighbour", () => {
    expect(findIssueNeighbors(keys, "2026-09-01")).toEqual({
      previous: undefined,
      next: "2026-09-10"
    });
  });

  it("gives the last issue only a previous neighbour", () => {
    expect(findIssueNeighbors(keys, "2026-09-28")).toEqual({
      previous: "2026-09-20",
      next: undefined
    });
  });

  it("gives a middle issue both neighbours, whatever order the keys come in", () => {
    expect(findIssueNeighbors([...keys].reverse(), "2026-09-10")).toEqual({
      previous: "2026-09-01",
      next: "2026-09-20"
    });
  });

  it("skips gaps: a key missing from the series is simply stepped over", () => {
    // 2026-09-14 is not an issue (an empty week); its neighbours are the
    // nearest issues on either side.
    expect(findIssueNeighbors(keys, "2026-09-14")).toEqual({
      previous: "2026-09-10",
      next: "2026-09-20"
    });
  });

  it("never returns a key above maxKey", () => {
    expect(
      findIssueNeighbors(keys, "2026-09-10", { maxKey: "2026-09-15" })
    ).toEqual({ previous: "2026-09-01", next: undefined });
  });

  it("returns nothing for a one-issue or empty series", () => {
    expect(findIssueNeighbors(["2026-09-01"], "2026-09-01")).toEqual({
      previous: undefined,
      next: undefined
    });
    expect(findIssueNeighbors([], "2026-09-01")).toEqual({
      previous: undefined,
      next: undefined
    });
  });
});

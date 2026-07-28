import { describe, expect, it } from "vitest";

import {
  applyReadFilter,
  countReadTechnologies,
  selectSavedTechnologies,
  toggleIdInList
} from "./reading-state";

const signals = [{ id: "tech-a" }, { id: "tech-b" }, { id: "tech-c" }];

describe("toggleIdInList", () => {
  it("appends a new id at the end so mark order is preserved", () => {
    expect(toggleIdInList(["tech-a"], "tech-b")).toEqual(["tech-a", "tech-b"]);
  });

  it("removes an id that is already marked", () => {
    expect(toggleIdInList(["tech-a", "tech-b"], "tech-a")).toEqual(["tech-b"]);
  });

  it("does not mutate the input list", () => {
    const ids = ["tech-a"];

    toggleIdInList(ids, "tech-b");

    expect(ids).toEqual(["tech-a"]);
  });
});

describe("selectSavedTechnologies", () => {
  it("returns saved signals most-recently-saved first", () => {
    expect(
      selectSavedTechnologies(signals, ["tech-a", "tech-c"]).map(
        (item) => item.id
      )
    ).toEqual(["tech-c", "tech-a"]);
  });

  it("drops saved ids that no longer resolve to a published signal", () => {
    expect(
      selectSavedTechnologies(signals, ["tech-a", "tech-archived"]).map(
        (item) => item.id
      )
    ).toEqual(["tech-a"]);
  });

  it("returns an empty list when nothing is saved", () => {
    expect(selectSavedTechnologies(signals, [])).toEqual([]);
  });
});

describe("applyReadFilter", () => {
  it("returns every signal when the reader has not hidden read ones", () => {
    expect(applyReadFilter(signals, ["tech-a"], false)).toHaveLength(3);
  });

  it("drops read signals when hiding is on", () => {
    expect(
      applyReadFilter(signals, ["tech-a", "tech-c"], true).map(
        (item) => item.id
      )
    ).toEqual(["tech-b"]);
  });

  it("can empty the list entirely, which the caller renders as a state", () => {
    expect(
      applyReadFilter(signals, ["tech-a", "tech-b", "tech-c"], true)
    ).toEqual([]);
  });
});

describe("countReadTechnologies", () => {
  it("counts only marks that appear in the given list", () => {
    expect(countReadTechnologies(signals, ["tech-a", "tech-elsewhere"])).toBe(
      1
    );
  });

  it("is zero for a reader with no marks", () => {
    expect(countReadTechnologies(signals, [])).toBe(0);
  });
});

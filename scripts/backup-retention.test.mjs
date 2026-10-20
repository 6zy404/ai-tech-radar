// @ts-check
import { describe, expect, it } from "vitest";

import { getSnapshotDay, planSnapshotRetention } from "./backup-retention.mjs";

/** @param {string} name @param {boolean} [verified] */
const snapshot = (name, verified = true) => ({ name, verified });

describe("getSnapshotDay", () => {
  it("reads the day from a snapshot name, with or without a collision suffix", () => {
    expect(getSnapshotDay("config-2026-10-12_074500")).toBe("2026-10-12");
    expect(getSnapshotDay("config-2026-10-12_074500-2")).toBe("2026-10-12");
  });

  it("rejects names that are not snapshots", () => {
    expect(getSnapshotDay("config-2026-10-12")).toBeUndefined();
    expect(getSnapshotDay("config-latest")).toBeUndefined();
    expect(getSnapshotDay("notes.txt")).toBeUndefined();
  });
});

describe("planSnapshotRetention", () => {
  it("keeps the newest N verified days and every snapshot on them", () => {
    const plan = planSnapshotRetention(
      [
        snapshot("config-2026-10-07_074500"),
        snapshot("config-2026-10-08_074500"),
        snapshot("config-2026-10-12_074500"),
        snapshot("config-2026-10-12_111000"),
        snapshot("config-2026-10-12_111400", false),
        snapshot("config-2026-10-13_074500"),
        snapshot("config-2026-10-14_074500")
      ],
      3
    );

    expect(plan.keptDays).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
    expect(plan.keep).toEqual([
      "config-2026-10-12_074500",
      "config-2026-10-12_111000",
      "config-2026-10-12_111400",
      "config-2026-10-13_074500",
      "config-2026-10-14_074500"
    ]);
    expect(plan.remove).toEqual([
      "config-2026-10-07_074500",
      "config-2026-10-08_074500"
    ]);
  });

  it("does not let extra copies on one day shorten the window", () => {
    const manyOnOneDay = Array.from({ length: 6 }, (_, index) =>
      snapshot(`config-2026-10-12_11${String(index).padStart(2, "0")}00`)
    );
    const plan = planSnapshotRetention(
      [
        snapshot("config-2026-10-01_074500"),
        snapshot("config-2026-10-02_074500"),
        ...manyOnOneDay
      ],
      3
    );

    expect(plan.keptDays).toEqual(["2026-10-01", "2026-10-02", "2026-10-12"]);
    expect(plan.remove).toEqual([]);
    expect(plan.keep).toHaveLength(8);
  });

  it("removes a day that only has unverified copies, even a recent one", () => {
    const plan = planSnapshotRetention(
      [
        snapshot("config-2026-10-12_074500"),
        snapshot("config-2026-10-13_074500", false),
        snapshot("config-2026-10-14_074500")
      ],
      14
    );

    expect(plan.keptDays).toEqual(["2026-10-12", "2026-10-14"]);
    expect(plan.remove).toEqual(["config-2026-10-13_074500"]);
  });

  it("keeps everything while there are fewer verified days than the window", () => {
    const plan = planSnapshotRetention(
      [
        snapshot("config-2026-10-12_074500"),
        snapshot("config-2026-10-13_074500")
      ],
      14
    );

    expect(plan.remove).toEqual([]);
    expect(plan.keep).toHaveLength(2);
  });

  it("neither counts nor removes a directory that is not a snapshot", () => {
    const plan = planSnapshotRetention(
      [
        snapshot("config-2026-10-12_074500"),
        snapshot("config-notes"),
        snapshot("config-2026-10-13_074500")
      ],
      1
    );

    expect(plan.ignored).toEqual(["config-notes"]);
    expect(plan.keep).toEqual(["config-2026-10-13_074500"]);
    expect(plan.remove).toEqual(["config-2026-10-12_074500"]);
  });

  it("treats a window under one day as one day", () => {
    const plan = planSnapshotRetention(
      [
        snapshot("config-2026-10-12_074500"),
        snapshot("config-2026-10-13_074500")
      ],
      0
    );

    expect(plan.keptDays).toEqual(["2026-10-13"]);
  });
});

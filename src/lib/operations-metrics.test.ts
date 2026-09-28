import { describe, expect, it } from "vitest";

import {
  CANDIDATE_BACKLOG_MAX_AGE_DAYS,
  CANDIDATE_BACKLOG_MAX_COUNT,
  IMPORT_STALL_THRESHOLD_HOURS,
  SCHEDULED_IMPORT_OVERDUE_HOURS,
  evaluateCandidateBacklog,
  evaluateImportStall,
  getLastCandidateIntakeAt
} from "@/lib/operations-metrics";
import type { ImportRun } from "@/types/content";

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const now = new Date("2026-09-29T08:00:00.000Z");

function ago(ms: number): string {
  return new Date(now.getTime() - ms).toISOString();
}

function importRun(
  finishedAt: string,
  overrides: Partial<ImportRun> = {}
): ImportRun {
  return {
    id: `run-${finishedAt}`,
    startedAt: finishedAt,
    finishedAt,
    status: "success",
    totalSources: 2,
    enabledSources: 2,
    skippedSources: 0,
    successfulSources: 2,
    failedSources: 0,
    partialSources: 0,
    totalCandidatesCreated: 3,
    totalCandidatesSkipped: 0,
    messages: [],
    sourceResults: [],
    ...overrides
  };
}

// nextRunAt in the near future: the schedule itself is on time.
const onTimeSchedule = { enabled: true, nextRunAt: ago(-2 * hour) };

function candidate(
  importStatus: "new" | "reviewed" | "converted" | "rejected",
  waitingMs: number
) {
  return {
    importStatus,
    importedAt: ago(waitingMs),
    publishDate: "2026-09-01"
  };
}

describe("the thresholds the tests below are written against", () => {
  it("are the documented values", () => {
    expect(IMPORT_STALL_THRESHOLD_HOURS).toBe(36);
    expect(SCHEDULED_IMPORT_OVERDUE_HOURS).toBe(6);
    expect(CANDIDATE_BACKLOG_MAX_COUNT).toBe(20);
    expect(CANDIDATE_BACKLOG_MAX_AGE_DAYS).toBe(7);
  });
});

describe("getLastCandidateIntakeAt", () => {
  it("takes the newest run in which a source actually succeeded", () => {
    const fallbackOnly = importRun(ago(1 * hour), {
      status: "partial",
      successfulSources: 0,
      partialSources: 2
    });
    const allFailed = importRun(ago(2 * hour), {
      status: "failed",
      successfulSources: 0,
      failedSources: 2
    });
    const real = importRun(ago(40 * hour), {
      status: "partial",
      successfulSources: 1,
      failedSources: 1
    });

    expect(getLastCandidateIntakeAt([fallbackOnly, allFailed, real])).toBe(
      real.finishedAt
    );
  });

  it("is undefined when no run ever brought anything in", () => {
    expect(getLastCandidateIntakeAt([])).toBeUndefined();
  });
});

describe("evaluateImportStall: last intake", () => {
  it("stays quiet at 35 hours", () => {
    expect(
      evaluateImportStall({
        schedule: onTimeSchedule,
        importRuns: [importRun(ago(35 * hour))],
        now
      })
    ).toEqual([]);
  });

  it("stays quiet at exactly 36 hours", () => {
    expect(
      evaluateImportStall({
        schedule: onTimeSchedule,
        importRuns: [importRun(ago(36 * hour))],
        now
      })
    ).toEqual([]);
  });

  it("raises a critical item at 37 hours", () => {
    const items = evaluateImportStall({
      schedule: onTimeSchedule,
      importRuns: [importRun(ago(37 * hour))],
      now
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "import-stall-intake",
      severity: "critical",
      href: "/workspace/delivery/schedules"
    });
    expect(items[0].description).toContain("37 小时前");
  });

  it("does not let a newer failed run hide the stall", () => {
    const items = evaluateImportStall({
      schedule: onTimeSchedule,
      importRuns: [
        importRun(ago(1 * hour), {
          status: "failed",
          successfulSources: 0,
          failedSources: 2
        }),
        importRun(ago(37 * hour))
      ],
      now
    });

    expect(items.map((item) => item.id)).toEqual(["import-stall-intake"]);
  });

  it("stays quiet while the scheduled import is disabled", () => {
    expect(
      evaluateImportStall({
        schedule: { enabled: false, nextRunAt: ago(30 * day) },
        importRuns: [importRun(ago(30 * day))],
        now
      })
    ).toEqual([]);
  });
});

describe("evaluateImportStall: overdue nextRunAt", () => {
  const freshRuns = [importRun(ago(1 * hour))];

  it("stays quiet 5 hours past the planned time", () => {
    expect(
      evaluateImportStall({
        schedule: { enabled: true, nextRunAt: ago(5 * hour) },
        importRuns: freshRuns,
        now
      })
    ).toEqual([]);
  });

  it("raises a critical item 7 hours past the planned time", () => {
    const items = evaluateImportStall({
      schedule: { enabled: true, nextRunAt: ago(7 * hour) },
      importRuns: freshRuns,
      now
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "import-stall-overdue",
      severity: "critical"
    });
    expect(items[0].description).toContain("7 小时");
  });

  it("treats a missing nextRunAt as due, not overdue", () => {
    expect(
      evaluateImportStall({
        schedule: { enabled: true },
        importRuns: freshRuns,
        now
      })
    ).toEqual([]);
  });

  it("reports both facts in the 09-25 shape: stale intake and a stuck schedule", () => {
    // The runner wrote into a throwaway copy for three days: the live store
    // saw neither a new run nor an advanced nextRunAt.
    const items = evaluateImportStall({
      schedule: { enabled: true, nextRunAt: ago(3 * day) },
      importRuns: [importRun(ago(4 * day))],
      now
    });

    expect(items.map((item) => item.id)).toEqual([
      "import-stall-intake",
      "import-stall-overdue"
    ]);
  });
});

describe("evaluateCandidateBacklog", () => {
  function newCandidates(count: number, waitingMs = 1 * day) {
    return Array.from({ length: count }, () => candidate("new", waitingMs));
  }

  it("stays quiet at 20 undecided candidates", () => {
    expect(
      evaluateCandidateBacklog({ candidates: newCandidates(20), now })
    ).toBeUndefined();
  });

  it("raises a warning at 21 undecided candidates", () => {
    const item = evaluateCandidateBacklog({
      candidates: newCandidates(21),
      now
    });

    expect(item).toMatchObject({
      severity: "warning",
      href: "/workspace/editorial-round"
    });
    expect(item?.description).toContain("未处置候选 21 条");
    expect(item?.description).toContain("已等待 1 天");
  });

  it("counts only undecided candidates", () => {
    const candidates = [
      ...newCandidates(20),
      candidate("reviewed", 1 * day),
      candidate("converted", 1 * day),
      candidate("rejected", 30 * day)
    ];

    expect(evaluateCandidateBacklog({ candidates, now })).toBeUndefined();
  });

  it("stays quiet when the oldest has waited exactly 7 days", () => {
    expect(
      evaluateCandidateBacklog({
        candidates: [candidate("new", 7 * day), candidate("new", 1 * hour)],
        now
      })
    ).toBeUndefined();
  });

  it("raises a warning once the oldest has waited past 7 days", () => {
    const item = evaluateCandidateBacklog({
      candidates: [candidate("new", 7 * day + hour), candidate("new", hour)],
      now
    });

    expect(item?.description).toContain("未处置候选 2 条");
    expect(item?.description).toContain("已等待 7 天");
  });

  it("falls back to the publish date when importedAt is missing", () => {
    const item = evaluateCandidateBacklog({
      candidates: [
        { importStatus: "new", publishDate: "2026-09-01", importedAt: "" }
      ],
      now
    });

    expect(item?.description).toContain("已等待 28 天");
  });

  it("is undefined for an empty pool", () => {
    expect(evaluateCandidateBacklog({ candidates: [], now })).toBeUndefined();
  });
});

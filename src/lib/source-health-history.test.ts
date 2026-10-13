import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendImportHistory,
  backfillImportHistory,
  buildImportHistoryEntry,
  getRecentImportSuccess,
  sourceImportHistoryLimit,
  summarizeImportError
} from "@/lib/source-health-history";
import type { ImportRun, SourceImportHistoryEntry } from "@/types/content";

function makeEntry(
  at: string,
  status: SourceImportHistoryEntry["status"] = "success"
): SourceImportHistoryEntry {
  return { at, status, candidatesCreated: 1, candidatesSkipped: 2 };
}

function makeRun(
  finishedAt: string,
  results: ImportRun["sourceResults"]
): ImportRun {
  return {
    id: `import-run-${finishedAt}`,
    startedAt: finishedAt,
    finishedAt,
    status: "success",
    totalSources: results.length,
    enabledSources: results.length,
    skippedSources: 0,
    successfulSources: results.length,
    failedSources: 0,
    partialSources: 0,
    totalCandidatesCreated: 0,
    totalCandidatesSkipped: 0,
    messages: [],
    sourceResults: results
  };
}

describe("summarizeImportError", () => {
  it("drops URLs and secrets and stays short", () => {
    const summary = summarizeImportError(
      `fetch https://feeds.example.com/rss?key=abc failed for bot123456:AAH_test-token-0123456789abcdef ${"x".repeat(400)}`
    );

    expect(summary).not.toContain("example.com");
    expect(summary).not.toContain("key=abc");
    expect(summary).not.toContain("AAH_test");
    expect(summary).toContain("[链接]");
    expect(summary!.length).toBeLessThanOrEqual(160);
  });

  it("is absent for a success", () => {
    expect(
      buildImportHistoryEntry({
        at: "2026-10-13T00:00:00.000Z",
        status: "success",
        candidatesCreated: 3,
        candidatesSkipped: 1,
        message: "导入 3 条新候选"
      })
    ).toEqual({
      at: "2026-10-13T00:00:00.000Z",
      status: "success",
      candidatesCreated: 3,
      candidatesSkipped: 1
    });
  });
});

describe("appendImportHistory", () => {
  it("keeps the newest 30, newest first", () => {
    let history: SourceImportHistoryEntry[] = [];

    for (let day = 1; day <= 35; day += 1) {
      history = appendImportHistory(
        history,
        makeEntry(new Date(Date.UTC(2026, 8, day)).toISOString())
      );
    }

    expect(history).toHaveLength(sourceImportHistoryLimit);
    expect(history[0].at).toBe("2026-10-05T00:00:00.000Z");
    expect(history.at(-1)?.at).toBe("2026-09-06T00:00:00.000Z");
  });
});

describe("backfillImportHistory", () => {
  const runs = [
    makeRun("2026-10-12T00:05:00.000Z", [
      {
        sourceId: "a",
        sourceName: "A",
        status: "failed",
        message: "HTTP 403 https://a.example/feed",
        candidateCount: 0,
        candidatesCreated: 0,
        candidatesSkipped: 0
      }
    ]),
    makeRun("2026-10-11T00:05:00.000Z", [
      {
        sourceId: "a",
        sourceName: "A",
        status: "success",
        message: "ok",
        candidateCount: 4,
        candidatesCreated: 1,
        candidatesSkipped: 3
      },
      {
        sourceId: "b",
        sourceName: "B",
        status: "success",
        message: "ok",
        candidateCount: 1,
        candidatesCreated: 1,
        candidatesSkipped: 0
      }
    ])
  ];

  it("takes the source's own lines from the stored batch runs", () => {
    const history = backfillImportHistory(
      { id: "a", createdAt: "2026-01-01T00:00:00.000Z" },
      runs
    );

    expect(history).toEqual([
      {
        at: "2026-10-12T00:05:00.000Z",
        status: "failed",
        candidatesCreated: 0,
        candidatesSkipped: 0,
        errorSummary: "HTTP 403 [链接]"
      },
      {
        at: "2026-10-11T00:05:00.000Z",
        status: "success",
        candidatesCreated: 1,
        candidatesSkipped: 3
      }
    ]);
  });

  it("ignores runs older than the source", () => {
    expect(
      backfillImportHistory(
        { id: "a", createdAt: "2026-10-11T12:00:00.000Z" },
        runs
      )
    ).toHaveLength(1);
  });
});

describe("getRecentImportSuccess", () => {
  it("counts only the window and treats partial as not successful", () => {
    const now = new Date("2026-10-13T12:00:00.000Z");
    const recent = getRecentImportSuccess(
      [
        makeEntry("2026-10-13T00:00:00.000Z"),
        makeEntry("2026-10-12T00:00:00.000Z", "partial"),
        makeEntry("2026-10-10T00:00:00.000Z", "failed"),
        makeEntry("2026-09-20T00:00:00.000Z")
      ],
      now
    );

    expect(recent).toEqual({ successful: 1, total: 3, rate: 1 / 3 });
    expect(getRecentImportSuccess([], now).rate).toBeUndefined();
  });
});

describe("source workflow: history and deletion", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  const sourceInput = {
    name: "测试信源",
    type: "rss" as const,
    url: "https://feeds.example.com/rss.xml",
    enabled: false,
    language: "en" as const,
    publisherType: "media" as const,
    defaultTags: [],
    defaultNormalizedType: "unknown" as const
  };

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(tmpdir(), "source-history-"));
    previousDataDir = process.env.LOCAL_DATA_DIR;
    process.env.LOCAL_DATA_DIR = dataDir;
    vi.resetModules();
  });

  afterEach(() => {
    if (previousDataDir === undefined) {
      delete process.env.LOCAL_DATA_DIR;
    } else {
      process.env.LOCAL_DATA_DIR = previousDataDir;
    }

    rmSync(dataDir, { recursive: true, force: true });
  });

  it("records every attempt and keeps the newest 30", async () => {
    const workflow = await import("@/lib/source-workflow");
    const source = workflow.createExternalSource(sourceInput);

    // A disabled source fails without touching the network, which makes it
    // a cheap way to record attempts.
    for (let attempt = 0; attempt < 32; attempt += 1) {
      await workflow.runImportForSource(source.id);
    }

    const history = workflow.getExternalSourceById(source.id)?.importHistory;

    expect(history).toHaveLength(sourceImportHistoryLimit);
    expect(history?.every((entry) => entry.status === "failed")).toBe(true);
    expect(history?.[0].errorSummary).toContain("已停用");
  });

  it("backfills a stored source from the batch runs once", async () => {
    writeFileSync(
      path.join(dataDir, "external-sources.json"),
      JSON.stringify({
        updatedAt: "2026-10-13T00:00:00.000Z",
        sources: [
          {
            id: "old-source",
            name: "旧信源",
            type: "rss",
            url: "https://old.example.com/rss",
            enabled: true,
            language: "en",
            publisherType: "media",
            defaultTags: [],
            defaultNormalizedType: "unknown",
            lastImportStatus: "success",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z"
          }
        ],
        importRuns: [
          makeRun("2026-10-12T00:05:00.000Z", [
            {
              sourceId: "old-source",
              sourceName: "旧信源",
              status: "success",
              message: "ok",
              candidateCount: 2,
              candidatesCreated: 2,
              candidatesSkipped: 0
            }
          ])
        ]
      })
    );

    const workflow = await import("@/lib/source-workflow");

    expect(
      workflow.getExternalSourceById("old-source")?.importHistory
    ).toHaveLength(1);

    workflow.setExternalSourceEnabled("old-source", false);

    const stored = JSON.parse(
      readFileSync(path.join(dataDir, "external-sources.json"), "utf8")
    ) as { sources: Array<{ importHistory?: unknown[] }> };

    expect(stored.sources[0].importHistory).toHaveLength(1);
  });

  it("deletes only a disabled source and records the deletion", async () => {
    const workflow = await import("@/lib/source-workflow");
    const { getWorkflowEvents } = await import("@/lib/workflow-events");
    const enabledSource = workflow.createExternalSource({
      ...sourceInput,
      name: "启用中的信源",
      url: "https://enabled.example.com/rss",
      enabled: true
    });
    const disabledSource = workflow.createExternalSource(sourceInput);

    expect(() => workflow.deleteExternalSource(enabledSource.id)).toThrow(
      workflow.ExternalSourceDeleteBlockedError
    );
    expect(() => workflow.deleteExternalSource("missing")).toThrow(/未找到/);

    workflow.deleteExternalSource(disabledSource.id);

    expect(workflow.getExternalSourceById(disabledSource.id)).toBeUndefined();
    expect(workflow.getExternalSourceById(enabledSource.id)).toBeDefined();

    const event = getWorkflowEvents().find(
      (item) => item.action === "source.deleted"
    );

    expect(event?.entityId).toBe(disabledSource.id);
    expect(event?.metadata).toMatchObject({ name: "测试信源" });
  });
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImportedCandidate } from "@/types/content";

/**
 * Pins that a re-import keeps the time and run that first brought a candidate
 * in. Until 2026-10-14 every import restamped `importedAt`, so the operations
 * backlog alert ("oldest undecided over 7 days") could never fire.
 */

const feed = vi.hoisted(() => ({ items: [] as ImportedCandidate[] }));

vi.mock("@/lib/external-import", () => ({
  importCandidatesForExternalSource: async () => feed.items
}));

function makeItem(slug: string): ImportedCandidate {
  return {
    id: `candidate-${slug}`,
    sourceType: "rss-feed",
    sourceName: "测试信源",
    sourceUrl: `https://news.example.com/${slug}`,
    originalTitle: `Example item ${slug}`,
    originalLanguage: "en",
    publishDate: "2026-10-01",
    publisherName: "Example",
    normalizedType: "unknown",
    tags: [],
    importStatus: "new",
    relatedCandidateIds: [],
    rawPayload: { item: { title: `Example item ${slug}` } }
  };
}

describe("runImportForSource: first-seen import time", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(tmpdir(), "source-import-"));
    previousDataDir = process.env.LOCAL_DATA_DIR;
    process.env.LOCAL_DATA_DIR = dataDir;
    writeFileSync(
      path.join(dataDir, "imported-candidates.live.json"),
      JSON.stringify({ syncedAt: "", sources: [], candidates: [] })
    );
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (previousDataDir === undefined) {
      delete process.env.LOCAL_DATA_DIR;
    } else {
      process.env.LOCAL_DATA_DIR = previousDataDir;
    }

    rmSync(dataDir, { recursive: true, force: true });
  });

  it("keeps importedAt and importRunId for a candidate seen before", async () => {
    const workflow = await import("@/lib/source-workflow");
    const { readImportedCandidateSnapshot } =
      await import("@/lib/candidate-import-snapshot-store");
    const source = workflow.createExternalSource({
      name: "测试信源",
      type: "rss",
      url: "https://feeds.example.com/rss.xml",
      enabled: true,
      language: "en",
      publisherType: "media",
      defaultTags: [],
      defaultNormalizedType: "unknown"
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T00:05:00.000Z"));
    feed.items = [makeItem("old")];
    await workflow.runImportForSource(source.id, { importRunId: "run-one" });

    vi.setSystemTime(new Date("2026-10-09T00:05:00.000Z"));
    // The same item comes back, once under a changed id (same URL), plus a
    // genuinely new one.
    feed.items = [
      { ...makeItem("old"), id: "candidate-old-renamed" },
      makeItem("new")
    ];
    const second = await workflow.runImportForSource(source.id, {
      importRunId: "run-two"
    });

    expect(second.candidatesCreated).toBe(1);
    expect(second.candidatesSkipped).toBe(1);

    const stored = readImportedCandidateSnapshot().candidates;
    const old = stored.find((item) => item.id === "candidate-old-renamed");
    const fresh = stored.find((item) => item.id === "candidate-new");

    expect(old?.importedAt).toBe("2026-10-01T00:05:00.000Z");
    expect(old?.importRunId).toBe("run-one");
    expect(old?.rawPayload).toMatchObject({
      importedAt: "2026-10-01T00:05:00.000Z",
      importRunId: "run-one"
    });
    expect(fresh?.importedAt).toBe("2026-10-09T00:05:00.000Z");
    expect(fresh?.importRunId).toBe("run-two");
  });
});

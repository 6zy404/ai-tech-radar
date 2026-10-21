import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The news lane shows candidates already in the rolling snapshot, and those
 * were stored before the importer learned a boilerplate — so the public map
 * cleans summaries again (`truncateSummary` → `cleanFeedText`). These pin that
 * the stored forms seen on 2026-09-30 reach readers without their boilerplate,
 * and that a summary which was nothing but boilerplate becomes no summary
 * (the card then renders no summary paragraph) rather than an empty string.
 */

let dataDir: string;
let previousDataDir: string | undefined;

function candidate(id: string, originalSummary: string) {
  return {
    id,
    sourceType: "rss-feed",
    sourceName: "Example",
    sourceUrl: `https://example.com/${id}`,
    originalTitle: `Title ${id}`,
    originalSummary,
    originalLanguage: "en",
    publishDate: "2026-09-29",
    publisherName: "Example",
    normalizedType: "tool",
    tags: [],
    importStatus: "new",
    relatedCandidateIds: [],
    rawPayload: {}
  };
}

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "news-lane-"));
  previousDataDir = process.env.LOCAL_DATA_DIR;
  process.env.LOCAL_DATA_DIR = dataDir;

  writeFileSync(
    path.join(dataDir, "imported-candidates.live.json"),
    JSON.stringify({
      lastSyncedAt: "2026-09-29T00:00:00.000Z",
      candidates: [
        candidate(
          "github-blog",
          "Enter canvases. The post When chat is the wrong UI appeared first on The GitHub Blog ."
        ),
        candidate(
          "infoq-link-only",
          "<div align='right'><a href='https://www.infoq.cn/article/x'>点击查看原文></a></div>"
        ),
        candidate("empty-release", "No content."),
        candidate("plain", "A plain summary."),
        {
          ...candidate("tagged", "Tagged."),
          tags: ["tag-workflow", "frontier-model", "首页轮播", "tag-workflow"]
        },
        {
          ...candidate("defaced", ""),
          originalTitle: "hacked by trenggalek6etar"
        }
      ]
    })
  );
  writeFileSync(
    path.join(dataDir, "candidate-review-state.json"),
    JSON.stringify({ updatedAt: "2026-09-29T00:00:00.000Z", items: {} })
  );
  writeFileSync(
    path.join(dataDir, "technology-workspace.json"),
    JSON.stringify({ records: [] })
  );
});

afterEach(() => {
  if (previousDataDir === undefined) delete process.env.LOCAL_DATA_DIR;
  else process.env.LOCAL_DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
});

describe("news lane summaries", () => {
  it("hides a defacement signature before auto-triage has rejected it", async () => {
    vi.resetModules();
    const { getPublicNewsItems } = await import("@/lib/news");

    const items = getPublicNewsItems(new Date("2026-09-30T12:00:00+08:00"));

    expect(
      items.some((item) => item.sourceUrl === "https://example.com/defaced")
    ).toBe(false);
  });

  it("drops stored feed boilerplate, and leaves no summary when that was all", async () => {
    vi.resetModules();
    const { getPublicNewsItems } = await import("@/lib/news");

    const items = getPublicNewsItems(new Date("2026-09-30T12:00:00+08:00"));
    const summaryOf = (id: string) =>
      items.find((item) => item.sourceUrl === `https://example.com/${id}`)
        ?.summary;

    expect(items).toHaveLength(5);
    expect(summaryOf("github-blog")).toBe("Enter canvases.");
    expect(summaryOf("infoq-link-only")).toBeUndefined();
    expect(summaryOf("empty-release")).toBeUndefined();
    expect(summaryOf("plain")).toBe("A plain summary.");
  });

  it("shows only canonical topic names, never a source's raw labels", async () => {
    vi.resetModules();
    const { getPublicNewsItems } = await import("@/lib/news");

    const items = getPublicNewsItems(new Date("2026-09-30T12:00:00+08:00"));
    const tagged = items.find(
      (item) => item.sourceUrl === "https://example.com/tagged"
    );

    expect(tagged?.tags).toEqual(["工作流"]);
  });
});

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ExternalSource,
  ImportedCandidate,
  ImportedCandidateSnapshot
} from "@/types/content";

/**
 * Pins the 2026-10-12 fix: all 12 InfoQ 中文 candidates in the live snapshot
 * held the feed's entity-escaped `<div><a>点击查看原文></a></div>` as their
 * summary and body, although the importer cleans that description down to "".
 *
 * The importer was right; the snapshot read was not. Every read refills an
 * empty summary from `rawPayload.item.description`, and that refill only
 * stripped literal tags — it never decoded entities or removed the feed's
 * boilerplate. The next source's merge in the same import run reads the
 * snapshot and writes every candidate back, so the refilled text was persisted.
 * Hence the test drives the real path: an InfoQ-shaped RSS item through the
 * importer, a merge, then a second source's merge.
 */

const infoqDescription =
  "&lt;div align=&#39;right&#39;&gt;&lt;a href=&#39;https://www.infoq.cn/article/2SNgaiHoK808v22dl5SJ?utm_source=rss&amp;utm_medium=article&#39;&gt;点击查看原文&gt;&lt;/a&gt;&lt;/div&gt;";

const infoqFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>InfoQ 推荐</title><link>https://www.infoq.cn</link><language>zh</language>
<item>
<title>Uber 在 Kubernetes 平台上将扩容意图与执行操作解耦</title>
<link>https://www.infoq.cn/article/2SNgaiHoK808v22dl5SJ?utm_source=rss&amp;utm_medium=article</link>
<description>${infoqDescription}</description>
<author>作者： Matt Saunders</author>
<guid>https://www.infoq.cn/article/2SNgaiHoK808v22dl5SJ?utm_source=rss&amp;utm_medium=article</guid>
<pubDate>Sun, 11 Oct 2026 15:00:00 GMT</pubDate>
</item>
</channel></rss>`;

const otherFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Other</title><link>https://example.com</link>
<item>
<title>Example release ships a new runtime</title>
<link>https://example.com/posts/runtime</link>
<description>A real summary of the new runtime.</description>
<pubDate>Sun, 11 Oct 2026 12:00:00 GMT</pubDate>
</item>
</channel></rss>`;

function source(id: string, name: string, url: string): ExternalSource {
  return {
    id,
    name,
    type: "rss",
    url,
    enabled: true,
    language: "zh",
    publisherName: name,
    publisherType: "media",
    defaultTags: [],
    defaultNormalizedType: "unknown",
    lastImportStatus: "success",
    maxItems: 12,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z"
  } as ExternalSource;
}

const infoq = source(
  "source-infoq-cn",
  "InfoQ 中文",
  "https://www.infoq.cn/feed"
);
const other = source("source-other", "Other", "https://example.com/feed");

let dataDir: string;
let previousDataDir: string | undefined;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "snapshot-refill-"));
  previousDataDir = process.env.LOCAL_DATA_DIR;
  process.env.LOCAL_DATA_DIR = dataDir;
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(String(url).includes("infoq") ? infoqFeed : otherFeed, {
          status: 200,
          headers: { "content-type": "application/rss+xml" }
        })
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (previousDataDir === undefined) delete process.env.LOCAL_DATA_DIR;
  else process.env.LOCAL_DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
});

async function runImport(...sources: ExternalSource[]) {
  const importer = await import("@/lib/external-import");
  const store = await import("@/lib/candidate-import-snapshot-store");

  for (const item of sources) {
    const candidates = await importer.importCandidatesForExternalSource(item);
    store.mergeImportedCandidatesForSource(
      importer.buildImportedCandidateSourceRecord(
        item,
        candidates.length,
        "live"
      ),
      candidates
    );
  }

  const stored = JSON.parse(
    readFileSync(path.join(dataDir, "imported-candidates.live.json"), "utf8")
  ) as ImportedCandidateSnapshot;

  return { store, stored };
}

const byName = (candidates: ImportedCandidate[], name: string) =>
  candidates.find((candidate) => candidate.sourceName === name);

describe("imported candidate snapshot: refilling an empty summary", () => {
  it("keeps InfoQ's link-only description empty through a later source's merge", async () => {
    const { store, stored } = await runImport(infoq, other);

    for (const candidate of [
      byName(stored.candidates, "InfoQ 中文"),
      byName(store.readImportedCandidateSnapshot().candidates, "InfoQ 中文")
    ]) {
      expect(candidate).toBeDefined();
      expect(candidate?.originalSummary ?? "").toBe("");
      expect(candidate?.originalContent ?? "").toBe("");
    }

    // the raw item is kept as it came, which is what the refill reads
    expect(
      (
        byName(stored.candidates, "InfoQ 中文")?.rawPayload as {
          item: { description: string };
        }
      ).item.description
    ).toBe(infoqDescription);
    expect(byName(stored.candidates, "Other")?.originalSummary).toBe(
      "A real summary of the new runtime."
    );
  });

  it("decodes a legacy candidate's escaped description when it refills", async () => {
    const store = await import("@/lib/candidate-import-snapshot-store");

    store.writeImportedCandidateSnapshot({
      syncedAt: "2026-10-12T00:00:00.000Z",
      sources: [],
      candidates: [
        {
          id: "candidate-legacy",
          sourceId: "source-other",
          sourceType: "rss-feed",
          sourceName: "Other",
          sourceUrl: "https://example.com/posts/legacy",
          originalTitle: "Legacy item",
          originalLanguage: "en",
          publishDate: "2026-10-01",
          publisherName: "Other",
          normalizedType: "tool",
          tags: [],
          importStatus: "new",
          relatedCandidateIds: [],
          rawPayload: {
            item: {
              description:
                "&lt;p&gt;Runtime 2.0 adds &amp;quot;streams&amp;quot; &amp; faster startup.&lt;/p&gt;"
            }
          }
        }
      ]
    });

    const legacy = store.readImportedCandidateSnapshot().candidates[0];
    expect(legacy.originalSummary).toBe(
      'Runtime 2.0 adds "streams" & faster startup.'
    );
    expect(legacy.originalContent).toBe(
      'Runtime 2.0 adds "streams" & faster startup.'
    );
  });
});

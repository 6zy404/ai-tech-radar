import { describe, expect, it } from "vitest";

import {
  planCandidateSnapshotRepair,
  planTechnologyRecordsRepair
} from "./entity-repair";
import { makeImportedCandidate, makeWorkspaceRecord } from "./test-factories";
import type { ImportedCandidateSnapshot } from "@/types/content";

const infoqUrl =
  "https://www.infoq.cn/article/abc?utm_source=rss&amp;utm_medium=article";
const infoqClean =
  "https://www.infoq.cn/article/abc?utm_source=rss&utm_medium=article";

function snapshotOf(
  ...candidates: ImportedCandidateSnapshot["candidates"]
): ImportedCandidateSnapshot {
  return {
    syncedAt: "2026-09-29T00:00:00.000Z",
    sources: [],
    candidates
  };
}

describe("planCandidateSnapshotRepair", () => {
  it("cleans links and text but never the id or the raw payload", () => {
    const candidate = makeImportedCandidate({
      id: "candidate-rss-keep-me",
      sourceUrl: infoqUrl,
      originalSummary: "<p>Keynote at the <a href='x'>Congress</a>.</p>",
      rawPayload: { link: infoqUrl }
    });
    const { next, changes } = planCandidateSnapshotRepair(
      snapshotOf(candidate)
    );

    expect(next.candidates[0]).toMatchObject({
      id: "candidate-rss-keep-me",
      sourceUrl: infoqClean,
      originalSummary: "Keynote at the Congress.",
      rawPayload: { link: infoqUrl }
    });
    expect(changes.map((change) => change.field)).toEqual([
      "sourceUrl",
      "originalSummary"
    ]);
  });

  it("is idempotent", () => {
    const first = planCandidateSnapshotRepair(
      snapshotOf(
        makeImportedCandidate({
          sourceUrl: infoqUrl,
          originalContent: "&lt;h2&gt;Notes&lt;/h2&gt; emits &lt;think&gt;"
        })
      )
    );
    const second = planCandidateSnapshotRepair(first.next);

    expect(first.changes).toHaveLength(2);
    expect(second.changes).toEqual([]);
  });

  it("leaves clean text alone, paragraph breaks included", () => {
    const body = "第一段，没有任何标记。\n\nSecond paragraph & more.";
    const { changes } = planCandidateSnapshotRepair(
      snapshotOf(makeImportedCandidate({ originalContent: body }))
    );

    expect(changes).toEqual([]);
  });
});

describe("planTechnologyRecordsRepair", () => {
  it("decodes the source link and every source reference", () => {
    const record = makeWorkspaceRecord({
      slug: "google-adk-kotlin-1-0",
      sourceUrl: infoqUrl,
      sourceReferences: [
        {
          sourceName: "InfoQ",
          sourceUrl: infoqUrl,
          candidateId: "c1",
          sourceType: "rss-feed"
        },
        {
          sourceName: "Clean",
          sourceUrl: "https://a.dev/x?y=1&z=2",
          candidateId: "c2",
          sourceType: "rss-feed"
        }
      ]
    });
    const { next, changes } = planTechnologyRecordsRepair([record]);

    expect(next[0].sourceUrl).toBe(infoqClean);
    expect(next[0].sourceReferences?.map((ref) => ref.sourceUrl)).toEqual([
      infoqClean,
      "https://a.dev/x?y=1&z=2"
    ]);
    expect(changes.map((change) => change.field)).toEqual([
      "sourceUrl",
      "sourceReferences[0].sourceUrl"
    ]);
  });

  it("touches localized text only with publishedText, and never empties it", () => {
    const record = makeWorkspaceRecord({
      summary: {
        original: "<div align='right'><a href='x'>点击查看原文></a></div>",
        zh: "干净的中文摘要"
      },
      content: {
        original: "<p>Yesterday was <a href='x'>Grok 4.7</a>.</p>",
        zh: "中文正文"
      }
    });

    expect(planTechnologyRecordsRepair([record]).changes).toEqual([]);

    const { next, changes } = planTechnologyRecordsRepair([record], {
      publishedText: true
    });

    expect(next[0].summary.original).toBe(record.summary.original);
    expect(next[0].content).toEqual({
      original: "Yesterday was Grok 4.7.",
      zh: "中文正文"
    });
    expect(changes.map((change) => change.field)).toEqual(["content.original"]);
  });
});

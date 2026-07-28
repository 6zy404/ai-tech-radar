import { describe, expect, it } from "vitest";

import { buildMergedCandidateSnapshot } from "@/lib/candidate-import-snapshot-store";
import type {
  ImportedCandidate,
  ImportedCandidateSnapshot,
  ImportedCandidateSourceRecord
} from "@/types/content";

const syncedAt = "2026-07-29T00:00:00.000Z";

function candidate(
  id: string,
  overrides: Partial<ImportedCandidate> = {}
): ImportedCandidate {
  return {
    id,
    sourceId: "source-ollama",
    sourceType: "github-release",
    sourceName: "Ollama Releases",
    sourceUrl: `https://github.com/ollama/ollama/releases/tag/${id}`,
    originalTitle: id,
    originalLanguage: "en",
    publishDate: "2026-07-28",
    publisherName: "Ollama",
    normalizedType: "release",
    tags: [],
    importStatus: "new",
    relatedCandidateIds: [],
    rawPayload: { sourceId: "source-ollama" },
    ...overrides
  };
}

function placeholder(date: string): ImportedCandidate {
  return candidate(`candidate-source-source-ollama-${date}`, {
    // every placeholder carries the source's own feed URL, not an item URL
    sourceUrl: "https://github.com/ollama/ollama/releases.atom",
    originalTitle: `Ollama Releases fallback import ${date}`,
    publishDate: date,
    tags: ["fallback"],
    rawPayload: { sourceId: "source-ollama", fallback: true }
  });
}

function sourceRecord(
  itemCount: number,
  syncStatus: ImportedCandidateSourceRecord["syncStatus"] = "live"
): ImportedCandidateSourceRecord {
  return {
    id: "source-ollama",
    sourceType: "github-release",
    sourceName: "Ollama Releases",
    sourceUrl: "https://github.com/ollama/ollama/releases.atom",
    syncStatus,
    itemCount,
    fetchedAt: syncedAt
  };
}

function snapshot(candidates: ImportedCandidate[]): ImportedCandidateSnapshot {
  return {
    syncedAt: "2026-07-28T00:05:00.000Z",
    sources: [sourceRecord(candidates.length)],
    candidates
  };
}

describe("buildMergedCandidateSnapshot", () => {
  it("replaces the source's candidates by default, because a live feed is the current truth", () => {
    const next = buildMergedCandidateSnapshot(
      snapshot([candidate("v0.32.4"), candidate("v0.32.5")]),
      sourceRecord(1),
      [candidate("v0.33.0")],
      syncedAt
    );

    expect(next.candidates.map((item) => item.id)).toEqual(["v0.33.0"]);
  });

  it("keeps the source's existing candidates when preserving, and appends the placeholder", () => {
    const next = buildMergedCandidateSnapshot(
      snapshot([candidate("v0.32.4"), candidate("v0.32.5")]),
      sourceRecord(1, "fallback"),
      [placeholder("2026-07-29")],
      syncedAt,
      { preserveExistingCandidates: true }
    );

    expect(next.candidates.map((item) => item.id)).toEqual([
      "candidate-source-source-ollama-2026-07-29",
      "v0.32.4",
      "v0.32.5"
    ]);
  });

  it("never drops a real candidate when a failed import falls back", () => {
    const before = snapshot([candidate("v0.32.5")]);
    const next = buildMergedCandidateSnapshot(
      before,
      sourceRecord(1, "fallback"),
      [placeholder("2026-07-29")],
      syncedAt,
      { preserveExistingCandidates: true }
    );

    expect(next.candidates.some((item) => item.id === "v0.32.5")).toBe(true);
  });

  it("does not stack a second placeholder carrying the same feed URL", () => {
    const next = buildMergedCandidateSnapshot(
      snapshot([candidate("v0.32.5"), placeholder("2026-07-28")]),
      sourceRecord(1, "fallback"),
      [placeholder("2026-07-29")],
      syncedAt,
      { preserveExistingCandidates: true }
    );

    const fallbacks = next.candidates.filter((item) =>
      item.tags.includes("fallback")
    );

    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0].id).toBe("candidate-source-source-ollama-2026-07-28");
  });

  it("skips an incoming candidate whose id already exists for the source", () => {
    const next = buildMergedCandidateSnapshot(
      snapshot([candidate("v0.32.5")]),
      sourceRecord(1, "fallback"),
      [candidate("v0.32.5")],
      syncedAt,
      { preserveExistingCandidates: true }
    );

    expect(next.candidates).toHaveLength(1);
  });

  it("leaves other sources' candidates untouched in both modes", () => {
    const foreign = candidate("vllm-v0.26.0", {
      sourceId: "source-vllm",
      sourceUrl: "https://github.com/vllm-project/vllm/releases/tag/v0.26.0",
      rawPayload: { sourceId: "source-vllm" }
    });

    for (const options of [{}, { preserveExistingCandidates: true }]) {
      const next = buildMergedCandidateSnapshot(
        snapshot([foreign, candidate("v0.32.5")]),
        sourceRecord(1, "fallback"),
        [placeholder("2026-07-29")],
        syncedAt,
        options
      );

      expect(next.candidates.some((item) => item.id === "vllm-v0.26.0")).toBe(
        true
      );
    }
  });

  it("resizes the source record to what the source actually holds after preserving", () => {
    const next = buildMergedCandidateSnapshot(
      snapshot([candidate("v0.32.4"), candidate("v0.32.5")]),
      sourceRecord(1, "fallback"),
      [placeholder("2026-07-29")],
      syncedAt,
      { preserveExistingCandidates: true }
    );

    const record = next.sources.find((item) => item.id === "source-ollama");

    expect(record?.itemCount).toBe(3);
    expect(record?.syncStatus).toBe("fallback");
  });

  it("keeps the caller's item count when replacing", () => {
    const next = buildMergedCandidateSnapshot(
      snapshot([candidate("v0.32.4"), candidate("v0.32.5")]),
      sourceRecord(1),
      [candidate("v0.33.0")],
      syncedAt
    );

    expect(
      next.sources.find((item) => item.id === "source-ollama")?.itemCount
    ).toBe(1);
  });

  it("stamps the passed-in sync time and sorts newest first", () => {
    const next = buildMergedCandidateSnapshot(
      snapshot([candidate("older", { publishDate: "2026-07-01" })]),
      sourceRecord(1, "fallback"),
      [placeholder("2026-07-29")],
      syncedAt,
      { preserveExistingCandidates: true }
    );

    expect(next.syncedAt).toBe(syncedAt);
    expect(next.candidates.map((item) => item.publishDate)).toEqual([
      "2026-07-29",
      "2026-07-01"
    ]);
  });

  it("does not mutate the snapshot it was given", () => {
    const before = snapshot([candidate("v0.32.5")]);
    const beforeJson = JSON.stringify(before);

    buildMergedCandidateSnapshot(
      before,
      sourceRecord(1, "fallback"),
      [placeholder("2026-07-29")],
      syncedAt,
      { preserveExistingCandidates: true }
    );

    expect(JSON.stringify(before)).toBe(beforeJson);
  });
});

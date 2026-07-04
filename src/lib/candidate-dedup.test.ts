import { describe, expect, it } from "vitest";

import { getDuplicateReasons } from "@/lib/candidate-duplicate-rules";
import { makeImportedCandidate } from "@/lib/test-factories";

describe("getDuplicateReasons", () => {
  it("flags two candidates that share a source URL", () => {
    const left = makeImportedCandidate({
      id: "a",
      sourceUrl: "https://example.com/posts/launch",
      originalTitle: "Company ships a brand new database engine"
    });
    const right = makeImportedCandidate({
      id: "b",
      sourceUrl: "https://example.com/posts/launch",
      originalTitle: "A totally different headline about something else"
    });

    expect(getDuplicateReasons(left, right)).toContain("same_source_url");
  });

  it("flags near-identical titles as similar", () => {
    const left = makeImportedCandidate({
      id: "a",
      sourceUrl: "https://a.example.com/1",
      originalTitle: "GPT-6 model released today"
    });
    const right = makeImportedCandidate({
      id: "b",
      sourceUrl: "https://b.example.com/2",
      originalTitle: "GPT-6 model released today"
    });

    expect(getDuplicateReasons(left, right)).toContain("similar_title");
  });

  it("flags same publisher within a few days and similar titles", () => {
    const left = makeImportedCandidate({
      id: "a",
      sourceUrl: "https://a.example.com/1",
      publisherName: "Acme Labs",
      publishDate: "2026-05-20",
      originalTitle: "Acme launches its agent platform"
    });
    const right = makeImportedCandidate({
      id: "b",
      sourceUrl: "https://b.example.com/2",
      publisherName: "Acme Labs",
      publishDate: "2026-05-22",
      originalTitle: "Acme launches its agent platform"
    });

    expect(getDuplicateReasons(left, right)).toContain(
      "same_publisher_near_date"
    );
  });

  it("flags two GitHub releases from the same repo family", () => {
    const left = makeImportedCandidate({
      id: "a",
      sourceType: "github-release",
      sourceUrl: "https://github.com/acme/sdk/releases/tag/v1.2.0",
      publisherName: "acme",
      publishDate: "2026-05-20",
      originalTitle: "sdk v1.2.0 release"
    });
    const right = makeImportedCandidate({
      id: "b",
      sourceType: "github-release",
      sourceUrl: "https://github.com/acme/sdk/releases/tag/v1.3.0",
      publisherName: "acme",
      publishDate: "2026-05-30",
      originalTitle: "sdk v1.3.0 release"
    });

    expect(getDuplicateReasons(left, right)).toContain(
      "same_repo_release_family"
    );
  });

  it("returns no reasons for clearly unrelated candidates", () => {
    const left = makeImportedCandidate({
      id: "a",
      sourceUrl: "https://a.example.com/apple-chip",
      publisherName: "Apple Newsroom",
      publishDate: "2026-01-01",
      originalTitle: "Apple announces a new silicon chip"
    });
    const right = makeImportedCandidate({
      id: "b",
      sourceUrl: "https://b.example.com/db-indexing",
      publisherName: "Database Weekly",
      publishDate: "2026-05-01",
      originalTitle: "Understanding database indexing strategies"
    });

    expect(getDuplicateReasons(left, right)).toEqual([]);
  });
});

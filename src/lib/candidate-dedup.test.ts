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

  /**
   * Hit for real on 2026-08-18, when it silently blocked a publish: title
   * normalization strips every non-latin character, so two unrelated Chinese
   * headlines whose only latin content is "AI" both normalize to `ai` and were
   * called the same title.
   */
  it("does not call two Chinese titles identical just because both contain AI", () => {
    const left = makeImportedCandidate({
      id: "a",
      sourceUrl: "https://a.example.com/maths",
      publisherName: "量子位",
      publishDate: "2026-08-17",
      originalTitle: "菲尔兹奖得主：AI现在主要靠「抬杠」突破重大数学猜想"
    });
    const right = makeImportedCandidate({
      id: "b",
      sourceUrl: "https://b.example.com/os",
      publisherName: "InfoQ 中文",
      publishDate: "2026-08-17",
      originalTitle:
        "当操作系统开始「理解意图」：鸿蒙 AI 如何改变开发者的工作方式"
    });

    expect(getDuplicateReasons(left, right)).toEqual([]);
  });

  it("still compares Chinese titles that carry a real latin token", () => {
    const left = makeImportedCandidate({
      id: "a",
      sourceUrl: "https://a.example.com/1",
      publisherName: "量子位",
      publishDate: "2026-08-17",
      originalTitle: "刚刚，Qwen3.8-27B 开源了！家用显卡也能跑"
    });
    const right = makeImportedCandidate({
      id: "b",
      sourceUrl: "https://b.example.com/2",
      publisherName: "量子位",
      publishDate: "2026-08-18",
      originalTitle: "重磅：Qwen3.8-27B 现已开源"
    });

    // The fix narrows the normalized-title branch, not Chinese titles as a
    // whole: `qwen3` and `27b` survive tokenization, so these still compare.
    expect(getDuplicateReasons(left, right)).toContain("similar_title");
  });

  /**
   * Pre-existing and unchanged by the fix above, pinned so it fails loudly if
   * anyone widens normalization without thinking it through: a title with no
   * latin characters at all normalizes to the empty string, so two byte-
   * identical Chinese headlines are not caught by the title rules either.
   */
  it("does not catch two identical all-Chinese titles by title alone", () => {
    const title = "阿里开源新一代推理模型，家用显卡也能跑";
    const left = makeImportedCandidate({
      id: "a",
      sourceUrl: "https://a.example.com/1",
      publisherName: "量子位",
      publishDate: "2026-08-17",
      originalTitle: title
    });
    const right = makeImportedCandidate({
      id: "b",
      sourceUrl: "https://b.example.com/2",
      publisherName: "InfoQ 中文",
      publishDate: "2026-08-17",
      originalTitle: title
    });

    expect(getDuplicateReasons(left, right)).toEqual([]);
  });

  it("still flags a short latin title that survives tokenization", () => {
    const left = makeImportedCandidate({
      id: "a",
      sourceUrl: "https://a.example.com/1",
      originalTitle: "vLLM v0.26.0"
    });
    const right = makeImportedCandidate({
      id: "b",
      sourceUrl: "https://b.example.com/2",
      originalTitle: "vLLM v0.26.0"
    });

    expect(getDuplicateReasons(left, right)).toContain("similar_title");
  });
});

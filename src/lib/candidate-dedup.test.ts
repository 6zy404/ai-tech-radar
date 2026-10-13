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

/**
 * The open groups in the 2026-10-13 snapshot, every one a cross-source pair a
 * short title had matched. Each hid a real item on the news lane.
 */
describe("getDuplicateReasons across sources", () => {
  const transformers = {
    sourceId: "source-transformers-releases",
    sourceName: "Transformers Releases",
    sourceType: "github-release" as const,
    publisherName: "Hugging Face"
  };
  const msSwift = {
    sourceId: "source-ms-swift-releases",
    sourceName: "ms-swift Releases",
    sourceType: "github-release" as const,
    publisherName: "ModelScope"
  };
  const mcpServers = {
    sourceId: "source-mcp-servers-releases",
    sourceName: "MCP Servers Releases",
    sourceType: "github-release" as const,
    publisherName: "modelcontextprotocol"
  };
  const qbitai = {
    sourceId: "source-qbitai",
    sourceName: "量子位",
    sourceType: "rss-feed" as const,
    publisherName: "量子位"
  };

  it("does not group two projects' patch releases", () => {
    const left = makeImportedCandidate({
      ...transformers,
      id: "a",
      sourceUrl:
        "https://github.com/huggingface/transformers/releases/tag/v5.13.1",
      publishDate: "2026-07-11",
      originalTitle: "Patch release v5.13.1"
    });
    const right = makeImportedCandidate({
      ...msSwift,
      id: "b",
      sourceUrl: "https://github.com/modelscope/ms-swift/releases/tag/v4.3.1",
      publishDate: "2026-06-17",
      originalTitle: "Patch release v4.3.1"
    });

    expect(getDuplicateReasons(left, right)).toEqual([]);
  });

  it("does not group a date-numbered release with a headline that mentions the year", () => {
    const release = makeImportedCandidate({
      ...mcpServers,
      id: "a",
      sourceUrl:
        "https://github.com/modelcontextprotocol/servers/releases/tag/2026.6.16",
      publishDate: "2026-06-16",
      originalTitle: "2026.6.16"
    });
    const headline = makeImportedCandidate({
      ...qbitai,
      id: "b",
      sourceUrl: "https://www.qbitai.com/2026/10/1.html",
      publishDate: "2026-10-10",
      originalTitle:
        "西门子将亮相2026工博会：以软硬协同的工业全栈能力，推动物理AI加速落地"
    });

    expect(getDuplicateReasons(release, headline)).toEqual([]);
  });

  it("does not group two date-numbered releases of one feed with an outside headline", () => {
    const release = makeImportedCandidate({
      ...mcpServers,
      id: "a",
      sourceUrl:
        "https://github.com/modelcontextprotocol/servers/releases/tag/2026.6.3",
      publishDate: "2026-06-04",
      originalTitle: "2026.6.3"
    });
    const headline = makeImportedCandidate({
      ...qbitai,
      id: "b",
      sourceUrl: "https://www.qbitai.com/2026/10/2.html",
      publishDate: "2026-10-10",
      originalTitle: "2026 年还剩三个月，这些 AI 公司已经交卷"
    });

    expect(getDuplicateReasons(release, headline)).toEqual([]);
  });

  it("does not group two bare version titles from different sources", () => {
    const left = makeImportedCandidate({
      ...transformers,
      id: "a",
      sourceUrl: "https://example.com/a/v1.0.0",
      originalTitle: "v1.0.0"
    });
    const right = makeImportedCandidate({
      ...msSwift,
      id: "b",
      sourceUrl: "https://example.com/b/v1.0.0",
      originalTitle: "v1.0.0"
    });

    expect(getDuplicateReasons(left, right)).toEqual([]);
  });

  it("does not group long titles that differ only in their version", () => {
    const left = makeImportedCandidate({
      ...transformers,
      id: "a",
      sourceUrl: "https://example.com/a",
      originalTitle: "Release notes for the inference server v0.31.0"
    });
    const right = makeImportedCandidate({
      ...qbitai,
      id: "b",
      sourceUrl: "https://example.com/b",
      originalTitle: "Release notes for the inference server v0.30.0"
    });

    expect(getDuplicateReasons(left, right)).not.toContain("similar_title");
  });

  it("still groups the same long headline from two outlets", () => {
    const left = makeImportedCandidate({
      ...transformers,
      id: "a",
      sourceUrl: "https://a.example.com/1",
      originalTitle: "Gemini 4 Argon: our next era of frontier models"
    });
    const right = makeImportedCandidate({
      ...qbitai,
      id: "b",
      sourceUrl: "https://b.example.com/2",
      originalTitle: "Gemini 4 Argon: our next era of frontier models"
    });

    expect(getDuplicateReasons(left, right)).toContain("similar_title");
  });

  it("still groups short titles within one source", () => {
    const left = makeImportedCandidate({
      ...transformers,
      id: "a",
      sourceUrl: "https://example.com/a",
      originalTitle: "Patch release v5.13.1"
    });
    const right = makeImportedCandidate({
      ...transformers,
      id: "b",
      sourceUrl: "https://example.com/b",
      originalTitle: "Patch release v5.14.1"
    });

    expect(getDuplicateReasons(left, right)).toContain("similar_title");
  });
});

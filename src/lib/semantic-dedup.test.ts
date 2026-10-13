import { describe, expect, it } from "vitest";

import { analyzeDuplicates } from "@/lib/candidate-duplicate-store";
import { getDuplicateReasons } from "@/lib/candidate-duplicate-rules";
import {
  SEMANTIC_DEDUP_RULES,
  buildCandidateDedupText,
  buildSignalDedupTexts,
  findSemanticCandidatePairs,
  findSemanticPublishedMatches,
  getDedupLanguage,
  isReleaseFeedItem,
  type SemanticDedupCandidate
} from "@/lib/semantic-dedup";
import { makeImportedCandidate } from "@/lib/test-factories";

/**
 * A stand-in for the embedding model: a normalized bag of character bigrams.
 * Crude, but it has the property the rules depend on — two wordings of one
 * story share most of their text, while two unrelated headlines that both say
 * "AI" share almost none of it.
 */
function fakeEmbed(text: string): number[] {
  const dimensions = 512;
  const vector = new Array<number>(dimensions).fill(0);
  const chars = Array.from(text.replace(/\s+/g, ""));

  for (let index = 0; index + 1 < chars.length; index += 1) {
    const bigram = chars[index] + chars[index + 1];
    let hash = 0;

    for (const char of bigram) {
      hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
    }

    vector[hash % dimensions] += 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  return vector.map((value) => value / norm);
}

function dedupCandidate(
  id: string,
  title: string,
  summary = "",
  overrides: Partial<SemanticDedupCandidate> = {}
): SemanticDedupCandidate {
  return {
    id,
    publishDate: "2026-09-30",
    isRelease: false,
    vector: fakeEmbed(buildCandidateDedupText(title, summary)),
    ...overrides
  };
}

// Two outlets filing one press release the same day, modelled on the
// 2026-09-30 DeepSeek pair the deterministic rules missed: the titles' latin
// tokens are `deepseek` against `deepseek tilelang`, a similarity of 0.5.
const deepseekSummary =
  "DeepSeek 今天开源了昇腾平台的基础设施组件，包括 TileLang 算子语言、计算库与分布式通信库。官方表示，这批组件的接口与 NVIDIA 版本保持一致，开发者可以把现有的推理与训练代码迁移到昇腾芯片上，几乎不用改动；DeepSeek 也将与昇腾共建高效易用的 AI 芯片软件生态。首批开源的还有面向大模型推理的 DeepGEMM 昇腾版与通信库 DeepEP 的适配版本，代码以 MIT 许可证发布在 GitHub 上，并附有从 CUDA 迁移的说明文档与性能对比数据。";
const qbitai = makeImportedCandidate({
  id: "qbitai-deepseek-ascend",
  sourceName: "量子位",
  publisherName: "量子位",
  sourceUrl: "https://www.qbitai.com/2026/09/1.html",
  originalTitle: "DeepSeek开源昇腾基础设施组件，与昇腾共建AI芯片软件生态",
  originalSummary: deepseekSummary,
  publishDate: "2026-09-30",
  importedAt: "2026-09-30T00:05:00.000Z"
});
const infoq = makeImportedCandidate({
  id: "infoq-deepseek-ascend",
  sourceName: "InfoQ 中文",
  publisherName: "InfoQ",
  sourceUrl: "https://www.infoq.cn/article/2",
  originalTitle: "DeepSeek开源昇腾基础设施组件，覆盖TileLang、计算库与通信库",
  originalSummary: deepseekSummary,
  publishDate: "2026-09-30",
  importedAt: "2026-09-30T06:05:00.000Z"
});
// Two unrelated Chinese headlines whose only latin content is "AI" — the shape
// that made the deterministic title rule group three unrelated items on
// 2026-08-18 (docs/data-model.md → CandidateQualitySignals).
const aiMaths = makeImportedCandidate({
  id: "ai-maths",
  sourceUrl: "https://www.qbitai.com/2026/08/3.html",
  originalTitle: "菲尔兹奖得主：AI现在主要靠抬杠突破重大数学猜想",
  publishDate: "2026-08-18"
});
const aiHarmony = makeImportedCandidate({
  id: "ai-harmony",
  sourceUrl: "https://www.infoq.cn/article/4",
  originalTitle: "当操作系统开始理解意图：鸿蒙 AI 如何改变开发者的工作方式",
  publishDate: "2026-08-18"
});

function toDedup(candidate: ReturnType<typeof makeImportedCandidate>) {
  return dedupCandidate(
    candidate.id,
    candidate.originalTitle,
    candidate.originalSummary,
    { publishDate: candidate.publishDate }
  );
}

describe("findSemanticCandidatePairs", () => {
  it("pairs two Chinese reports of one announcement", () => {
    const pairs = findSemanticCandidatePairs([toDedup(qbitai), toDedup(infoq)]);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].score).toBeGreaterThanOrEqual(
      SEMANTIC_DEDUP_RULES.candidateThreshold
    );
    // The point of the rule: nothing deterministic links these two.
    expect(getDuplicateReasons(qbitai, infoq)).toEqual([]);
  });

  it("does not pair unrelated Chinese headlines that both say AI", () => {
    expect(
      findSemanticCandidatePairs([toDedup(aiMaths), toDedup(aiHarmony)])
    ).toEqual([]);
    // Nor do the deterministic rules, since the 2026-08-18 fix.
    expect(getDuplicateReasons(aiMaths, aiHarmony)).toEqual([]);
  });

  it("ignores identical vectors more than the day window apart", () => {
    const vector = fakeEmbed("同一段文字");

    expect(
      findSemanticCandidatePairs([
        { id: "a", publishDate: "2026-09-01", isRelease: false, vector },
        { id: "b", publishDate: "2026-09-10", isRelease: false, vector }
      ])
    ).toEqual([]);
  });

  it("leaves release-feed items to the URL rules", () => {
    // v0.31.0 and v0.30.0 of one project read alike and are different releases.
    const vector = fakeEmbed("vLLM release notes: new models and kernels");

    expect(
      findSemanticCandidatePairs([
        { id: "a", publishDate: "2026-09-30", isRelease: true, vector },
        { id: "b", publishDate: "2026-09-30", isRelease: false, vector }
      ])
    ).toEqual([]);
  });

  it("reports each pair once, ids in sorted order", () => {
    const vector = fakeEmbed("同一段文字");

    expect(
      findSemanticCandidatePairs([
        { id: "z", publishDate: "2026-09-30", isRelease: false, vector },
        { id: "a", publishDate: "2026-09-30", isRelease: false, vector }
      ]).map(({ leftId, rightId }) => [leftId, rightId])
    ).toEqual([["a", "z"]]);
  });
});

describe("analyzeDuplicates with semantic pairs", () => {
  it("groups the semantic pair with a semantic_similar reason and its score", () => {
    const [pair] = findSemanticCandidatePairs([
      toDedup(qbitai),
      toDedup(infoq)
    ]);
    const analysis = analyzeDuplicates(
      [qbitai, infoq, aiMaths, aiHarmony].map((candidate) => ({
        ...candidate,
        relatedCandidateIds: []
      })),
      { semanticPairs: [pair] }
    );

    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0].candidateIds).toEqual([
      "infoq-deepseek-ascend",
      "qbitai-deepseek-ascend"
    ]);
    expect(analysis.groups[0].reasons).toEqual(["semantic_similar"]);
    expect(Object.values(analysis.pairSemanticScores)[0]).toBeCloseTo(
      pair.score
    );
    // Same score, same day: the one imported first stays primary.
    expect(analysis.groups[0].primaryCandidateId).toBe(
      "qbitai-deepseek-ascend"
    );
  });

  it("is the deterministic grouping when no semantic pairs are given", () => {
    const analysis = analyzeDuplicates(
      [qbitai, infoq].map((candidate) => ({
        ...candidate,
        relatedCandidateIds: []
      }))
    );

    expect(analysis.groups).toEqual([]);
  });

  it("drops a pair whose candidate has left the snapshot", () => {
    const analysis = analyzeDuplicates(
      [{ ...qbitai, relatedCandidateIds: [] }],
      {
        semanticPairs: [{ leftId: "gone", rightId: qbitai.id, score: 0.99 }]
      }
    );

    expect(analysis.groups).toEqual([]);
  });
});

describe("findSemanticPublishedMatches", () => {
  const signalTitle =
    "DeepSeek 开源昇腾版 DeepGEMM 等组件：接口与 NVIDIA 版相同";
  const signal = {
    id: "tech-deepseek-ascend",
    title: signalTitle,
    publishDate: "2026-09-30",
    vectors: [
      fakeEmbed(buildCandidateDedupText(infoq.originalTitle, deepseekSummary))
    ]
  };

  it("matches a candidate to the signal it reads like", () => {
    expect(
      findSemanticPublishedMatches([toDedup(qbitai)], [signal])
    ).toMatchObject([
      {
        candidateId: "qbitai-deepseek-ascend",
        technologyId: "tech-deepseek-ascend",
        technologyTitle: signalTitle
      }
    ]);
  });

  it("never matches a candidate to the signal it became", () => {
    expect(
      findSemanticPublishedMatches(
        [{ ...toDedup(qbitai), convertedTechnologyId: signal.id }],
        [signal]
      )
    ).toEqual([]);
    expect(
      findSemanticPublishedMatches(
        [toDedup(qbitai)],
        [{ ...signal, sourceCandidateId: qbitai.id }]
      )
    ).toEqual([]);
  });

  it("does not match an unrelated candidate", () => {
    expect(findSemanticPublishedMatches([toDedup(aiMaths)], [signal])).toEqual(
      []
    );
  });
});

describe("dedup texts", () => {
  it("detects a Chinese headline by any Chinese character", () => {
    expect(getDedupLanguage("Gemini 3.7 Flash 突袭")).toBe("zh");
    expect(getDedupLanguage("Introducing Gemini 3.7 Flash")).toBe("en");
  });

  it("embeds a signal in its original and, when it has one, its Chinese version", () => {
    expect(
      buildSignalDedupTexts({
        title: {
          original: "Introducing Gemini 3.7 Flash",
          zh: "Gemini 3.7 Flash：价格砍半"
        },
        summary: { original: "Faster and cheaper.", zh: "更快更便宜。" }
      })
    ).toEqual([
      {
        text: "Introducing Gemini 3.7 Flash\nFaster and cheaper.",
        language: "en"
      },
      { text: "Gemini 3.7 Flash：价格砍半\n更快更便宜。", language: "zh" }
    ]);
  });

  it("strips markup and caps the summary", () => {
    const text = buildCandidateDedupText("Title", `<p>${"x".repeat(500)}</p>`);

    expect(text.startsWith("Title\nx")).toBe(true);
    expect(text.length).toBe("Title\n".length + 300);
  });
});

describe("isReleaseFeedItem", () => {
  it("recognizes a GitHub release imported through its Atom feed", () => {
    // How every release source in the pool arrives; until v2 these took part.
    expect(
      isReleaseFeedItem({
        sourceType: "rss-feed",
        sourceUrl:
          "https://github.com/huggingface/transformers/releases/tag/v5.15.0"
      })
    ).toBe(true);
    expect(
      isReleaseFeedItem({
        sourceType: "github-release",
        sourceUrl: "https://api.github.com/repos/acme/sdk/releases/1"
      })
    ).toBe(true);
  });

  it("leaves blog posts and articles alone, even ones about releases", () => {
    expect(
      isReleaseFeedItem({
        sourceType: "rss-feed",
        sourceUrl: "https://hf-mirror.com/blog/muse-glimmer"
      })
    ).toBe(false);
    expect(
      isReleaseFeedItem({
        sourceType: "rss-feed",
        sourceUrl: "https://github.blog/changelog/2026-10-01-new-releases"
      })
    ).toBe(false);
  });
});

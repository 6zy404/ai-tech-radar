import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanDraftBody,
  normalizeDraftSlug,
  toChineseQuotes,
  validateCandidateDraftOutput,
  type DraftCatalog
} from "@/lib/candidate-llm-draft";
import type { LlmProvider } from "@/lib/llm/provider";
import { createMockLlmProvider } from "@/lib/llm/providers/mock";
import {
  fetchSourceText,
  getGitHubReleaseApiUrl
} from "@/lib/source-page-fetch";

const catalog: DraftCatalog = {
  topics: [
    { id: "tag-open-weights", name: "开放权重模型", description: "" },
    { id: "tag-benchmarks", name: "基准与评测", description: "" }
  ],
  knowledge: [{ id: "knowledge-a", title: "概念 A", summary: "" }],
  skills: [{ id: "skill-a", title: "技能 A", summary: "" }]
};

const validOutput = {
  title: "某模型开放权重，评测领先",
  summary: "一段足够长的中文摘要。",
  content: "## 发生了什么\n\n正文段落。",
  tags: ["tag-open-weights", "tag-made-up", "tag-benchmarks"],
  relatedKnowledge: [
    { id: "knowledge-a", relationType: "explains", note: "附注" },
    { id: "knowledge-ghost", relationType: "explains" }
  ],
  relatedSkills: [{ id: "skill-a", relationType: "builds-on" }, "skill-ghost"],
  type: "model",
  publisherType: "not-a-type"
};

describe("validateCandidateDraftOutput", () => {
  it("keeps catalog ids and drops the rest with a warning each", () => {
    const result = validateCandidateDraftOutput(
      JSON.stringify(validOutput),
      catalog
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.fields.tags).toEqual(["tag-open-weights", "tag-benchmarks"]);
    expect(result.fields.relatedKnowledge.map((item) => item.id)).toEqual([
      "knowledge-a"
    ]);
    expect(result.fields.relatedSkills).toEqual([
      { id: "skill-a", relationType: "supports" }
    ]);
    expect(result.fields.type).toBe("model");
    expect(result.fields.publisherType).toBeUndefined();
    expect(result.warnings.join("\n")).toMatch(/tag-made-up/);
    expect(result.warnings.join("\n")).toMatch(/knowledge-ghost/);
    expect(result.warnings.join("\n")).toMatch(/skill-ghost/);
    expect(result.warnings.join("\n")).toMatch(/builds-on/);
  });

  it("fails without a title, summary or body", () => {
    const result = validateCandidateDraftOutput(
      JSON.stringify({ ...validOutput, content: "   " }),
      catalog
    );

    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toMatch(/正文/);
  });

  it("fails on invalid JSON and on internal-only terms", () => {
    expect(validateCandidateDraftOutput("not json", catalog).ok).toBe(false);
    expect(
      validateCandidateDraftOutput(
        JSON.stringify({ ...validOutput, summary: "见 rawPayload" }),
        catalog
      ).ok
    ).toBe(false);
  });

  it("strips Markdown from plain fields and converts quotes", () => {
    const result = validateCandidateDraftOutput(
      JSON.stringify({
        ...validOutput,
        title: '**新模型** "开放" `v2`',
        summary: "摘要“引用”内容"
      }),
      catalog
    );

    expect(result.ok && result.fields.title).toBe("新模型 「开放」 v2");
    expect(result.ok && result.fields.summary).toBe("摘要「引用」内容");
  });
});

describe("cleanDraftBody", () => {
  it("rewrites what ContentBody cannot render", () => {
    const warnings: string[] = [];
    const body = cleanDraftBody(
      [
        "# 标题",
        "### 小节",
        "> 引用一句",
        "| a | b |",
        "|---|---|",
        "```",
        "code",
        "```",
        "* 列表项",
        "见 **`flag`** 与 [链接](https://example.com)"
      ].join("\n"),
      warnings
    );

    expect(body).toBe(
      ["## 标题", "## 小节", "引用一句", "- 列表项", "见 `flag` 与 链接"].join(
        "\n"
      )
    );
    expect(warnings).toHaveLength(3);
  });

  it("leaves English quotes alone and converts Chinese ones", () => {
    expect(toChineseQuotes('say "hello" and "你好"')).toBe(
      'say "hello" and 「你好」'
    );
  });
});

describe("normalizeDraftSlug", () => {
  it("accepts kebab case and repairs the rest", () => {
    expect(normalizeDraftSlug("Cloudflare Clef_Decision")).toBe(
      "cloudflare-clef-decision"
    );
    expect(normalizeDraftSlug("中文")).toBeUndefined();
  });
});

describe("fetchSourceText", () => {
  it("maps a GitHub release page to the REST endpoint", () => {
    expect(
      getGitHubReleaseApiUrl(
        "https://github.com/ollama/ollama/releases/tag/v0.40.3"
      )
    ).toBe("https://api.github.com/repos/ollama/ollama/releases/tags/v0.40.3");
    expect(getGitHubReleaseApiUrl("https://example.com/a")).toBeUndefined();
  });

  it("reads release notes from the API", async () => {
    const result = await fetchSourceText(
      "https://github.com/o/r/releases/tag/v1",
      {
        fetchImpl: (async () =>
          Response.json({
            name: "v1",
            tag_name: "v1",
            body: "## Changes\n\n- a long enough line of notes"
          })) as unknown as typeof fetch
      }
    );

    expect(result).toMatchObject({ ok: true, origin: "github_release" });
  });

  it("reports a refused or failed request without throwing", async () => {
    expect(
      await fetchSourceText("https://example.com/a", {
        fetchImpl: (async () =>
          new Response("no", { status: 403 })) as unknown as typeof fetch
      })
    ).toEqual({ ok: false, error: "HTTP 403" });
    expect(
      await fetchSourceText("https://example.com/a", {
        fetchImpl: (async () => {
          throw new Error("getaddrinfo ENOTFOUND");
        }) as unknown as typeof fetch
      })
    ).toEqual({ ok: false, error: "getaddrinfo ENOTFOUND" });
  });
});

// --- end to end, mock provider, throwaway data directory --------------------

let dataDir: string;
let previousDataDir: string | undefined;
const candidateId = "candidate-ai-draft-1";

const failingFetch = (async () => {
  throw new Error("fetch failed");
}) as unknown as typeof fetch;

function providerReturning(text: string): LlmProvider {
  return {
    name: "openai_compatible",
    modelName: "fake-model",
    isAvailable: () => ({ available: true }),
    generate: async () => ({
      text,
      providerName: "openai_compatible",
      modelName: "fake-model",
      tokenUsage: { totalTokens: 1234 }
    })
  };
}

const readJson = (file: string) =>
  JSON.parse(readFileSync(path.join(dataDir, file), "utf8"));

beforeEach(() => {
  previousDataDir = process.env.LOCAL_DATA_DIR;
  dataDir = mkdtempSync(path.join(tmpdir(), "ai-draft-"));
  process.env.LOCAL_DATA_DIR = dataDir;
  vi.resetModules();

  writeFileSync(
    path.join(dataDir, "imported-candidates.live.json"),
    JSON.stringify({
      lastSyncedAt: "2026-10-13T00:00:00.000Z",
      candidates: [
        {
          id: candidateId,
          sourceType: "rss-feed",
          sourceName: "Example Feed",
          sourceUrl: "https://example.com/post",
          originalTitle: "Example Model 2 released with open weights",
          originalSummary: "Example Lab releases Example Model 2.",
          originalLanguage: "en",
          publishDate: "2026-10-12",
          publisherName: "Example Feed",
          normalizedType: "model",
          tags: [],
          importStatus: "new",
          relatedCandidateIds: [],
          rawPayload: {}
        }
      ]
    })
  );
  writeFileSync(
    path.join(dataDir, "candidate-review-state.json"),
    JSON.stringify({ updatedAt: "2026-10-13T00:00:00.000Z", items: {} })
  );
  writeFileSync(
    path.join(dataDir, "technology-workspace.json"),
    JSON.stringify({ updatedAt: "2026-10-13T00:00:00.000Z", records: [] })
  );
});

afterEach(() => {
  if (previousDataDir === undefined) {
    delete process.env.LOCAL_DATA_DIR;
  } else {
    process.env.LOCAL_DATA_DIR = previousDataDir;
  }
  rmSync(dataDir, { recursive: true, force: true });
});

describe("generateCandidateAiDraft", () => {
  it("falls back to the candidate's own fields when the source cannot be read", async () => {
    const { generateCandidateAiDraft } =
      await import("@/lib/candidate-llm-draft-workflow");

    const result = await generateCandidateAiDraft(candidateId, {
      provider: createMockLlmProvider(),
      fetchImpl: failingFetch,
      blind: true
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { draft, metadata } = result;
    expect(draft.status).toBe("draft");
    expect(draft.title.original).toBe(
      "Example Model 2 released with open weights"
    );
    expect(draft.title.zh).toMatch(/mock/);
    expect(draft.content.zh).toMatch(/^## 发生了什么/);
    expect(draft.translationStatus).toBe("done");
    expect(draft.slug).toBe("mock-candidate-draft");
    expect(draft.tags).toEqual(["tag-agent-infra", "tag-benchmarks"]);
    expect(draft.relatedKnowledgeIds).toHaveLength(1);
    expect(draft.relatedSkillIds).toHaveLength(1);
    expect(metadata).toMatchObject({
      generationMode: "mock_llm",
      modelName: "mock-candidate-draft-v0",
      promptVersion: "candidate-draft-v2",
      sourceTextOrigin: "candidate_fallback",
      sourceFetchError: "fetch failed"
    });
    expect(draft.editorialNotes.join("\n")).toMatch(/原文取不到/);
    expect(result.blockingErrors).toEqual([]);

    // Converted, blind, and the relation types written.
    expect(
      readJson("candidate-review-state.json").items[candidateId]
    ).toMatchObject({
      importStatus: "converted",
      convertedTechnologyId: draft.id,
      blind: true
    });
    const relations = readJson("link-relation-workspace.json").relations as {
      relationType: string;
    }[];
    expect(relations.map((relation) => relation.relationType).sort()).toEqual([
      "explains",
      "supports"
    ]);
    const events = readJson("workflow-events.json").events as {
      action: string;
    }[];
    expect(
      events.some((event) => event.action === "candidate.ai_drafted")
    ).toBe(true);

    // The metadata stays in the workspace: the public mapping drops it.
    const { toUserFacingTechnologyItem } = await import("@/lib/content");
    expect(JSON.stringify(toUserFacingTechnologyItem(draft))).not.toMatch(
      /aiDraft|candidate-draft-v1|mock-candidate-draft-v0/
    );
  });

  it("drops ids the model made up and keeps the draft", async () => {
    const { generateCandidateAiDraft } =
      await import("@/lib/candidate-llm-draft-workflow");

    const result = await generateCandidateAiDraft(candidateId, {
      provider: providerReturning(
        JSON.stringify({
          ...validOutput,
          tags: ["tag-open-weights", "tag-invented"],
          relatedKnowledge: [{ id: "knowledge-invented" }],
          relatedSkills: [{ id: "skill-invented" }]
        })
      ),
      fetchImpl: failingFetch
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.draft.tags).toEqual(["tag-open-weights"]);
    expect(result.draft.relatedKnowledgeIds).toEqual([]);
    expect(result.draft.relatedSkillIds).toEqual([]);
    expect(result.metadata.generationMode).toBe("llm_assisted");
    expect(result.metadata.warnings.join("\n")).toMatch(/tag-invented/);
    expect(result.metadata.warnings.join("\n")).toMatch(/knowledge-invented/);
    expect(result.metadata.tokenUsage?.totalTokens).toBe(1234);
  });

  it("leaves no draft and no status change when validation fails", async () => {
    const { generateCandidateAiDraft } =
      await import("@/lib/candidate-llm-draft-workflow");

    const result = await generateCandidateAiDraft(candidateId, {
      provider: providerReturning(
        JSON.stringify({ ...validOutput, content: "" })
      ),
      fetchImpl: failingFetch
    });

    expect(result).toMatchObject({ ok: false, status: 422 });
    expect(!result.ok && result.error).toMatch(/没有生成草稿/);
    expect(readJson("technology-workspace.json").records).toEqual([]);
    expect(readJson("candidate-review-state.json").items).toEqual({});
    expect(existsSync(path.join(dataDir, "link-relation-workspace.json"))).toBe(
      false
    );
    const events = readJson("workflow-events.json").events as {
      action: string;
    }[];
    expect(events.map((event) => event.action)).toEqual([
      "candidate.ai_draft_failed"
    ]);
  });

  it("leaves no draft when the model call fails", async () => {
    const { generateCandidateAiDraft } =
      await import("@/lib/candidate-llm-draft-workflow");
    const provider: LlmProvider = {
      ...providerReturning(""),
      generate: async () => {
        throw new Error("Provider returned HTTP 401.");
      }
    };

    const result = await generateCandidateAiDraft(candidateId, {
      provider,
      fetchImpl: failingFetch
    });

    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(!result.ok && result.error).toMatch(/HTTP 401/);
    expect(readJson("technology-workspace.json").records).toEqual([]);
  });

  it("refuses a candidate that is already a draft", async () => {
    const { generateCandidateAiDraft } =
      await import("@/lib/candidate-llm-draft-workflow");
    const options = {
      provider: createMockLlmProvider(),
      fetchImpl: failingFetch
    };

    expect((await generateCandidateAiDraft(candidateId, options)).ok).toBe(
      true
    );
    expect(await generateCandidateAiDraft(candidateId, options)).toMatchObject({
      ok: false,
      status: 409
    });
    expect(await generateCandidateAiDraft("missing", options)).toMatchObject({
      ok: false,
      status: 404
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchPublicContent } from "@/lib/search";
import { makeTechnologyItem } from "@/lib/test-factories";
import type {
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
  TopicTag
} from "@/types/content";

const {
  getAllKnowledgeMock,
  getAllSkillsMock,
  getAllTagsMock,
  getAllTechnologiesMock
} = vi.hoisted(() => ({
  getAllKnowledgeMock: vi.fn<() => KnowledgeItem[]>(),
  getAllSkillsMock: vi.fn<() => SkillItem[]>(),
  getAllTagsMock: vi.fn<() => TopicTag[]>(),
  getAllTechnologiesMock: vi.fn<() => TechnologyItem[]>()
}));

const { getPublicNewsItemsMock } = vi.hoisted(() => ({
  getPublicNewsItemsMock: vi.fn()
}));

vi.mock("@/lib/content", () => ({
  getAllKnowledge: getAllKnowledgeMock,
  getAllSkills: getAllSkillsMock,
  getAllTags: getAllTagsMock,
  getAllTechnologies: getAllTechnologiesMock
}));

vi.mock("@/lib/news", () => ({
  getPublicNewsItems: getPublicNewsItemsMock
}));

function makeSkill(overrides: Partial<SkillItem> = {}): SkillItem {
  return {
    id: "skill-1",
    title: "Prompt Engineering",
    slug: "prompt-engineering",
    summary: "Design effective prompts for large language models.",
    content: "Full body.",
    skillType: "technique",
    heatLevel: "rising",
    learningCost: "low",
    tags: ["tag-agents"],
    relatedTechnologyIds: [],
    relatedKnowledgeIds: [],
    ...overrides
  };
}

function makeKnowledge(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    id: "knowledge-1",
    title: "Retrieval Basics",
    slug: "retrieval-basics",
    summary: "Foundational ideas behind retrieval-augmented generation.",
    content: "Full body.",
    category: "concept",
    difficulty: "beginner",
    tags: ["tag-agents"],
    relatedTechnologyIds: [],
    relatedSkillIds: [],
    ...overrides
  };
}

const tagFixtures: TopicTag[] = [
  { id: "tag-agents", name: "AI 智能体", description: "" },
  { id: "tag-inference", name: "推理与部署", description: "" }
];

beforeEach(() => {
  getAllTechnologiesMock.mockReset().mockReturnValue([]);
  getAllSkillsMock.mockReset().mockReturnValue([]);
  getAllKnowledgeMock.mockReset().mockReturnValue([]);
  getAllTagsMock.mockReset().mockReturnValue(tagFixtures);
  getPublicNewsItemsMock.mockReset().mockReturnValue([]);
});

describe("searchPublicContent", () => {
  it("returns an empty, zero-term result for a blank query without reading any content pool", () => {
    const result = searchPublicContent("   ");

    expect(result.query).toBe("");
    expect(result.terms).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(getAllTechnologiesMock).not.toHaveBeenCalled();
  });

  it("matches technologies by title case-insensitively", () => {
    getAllTechnologiesMock.mockReturnValue([
      makeTechnologyItem({
        id: "vllm",
        slug: "vllm-v0-25-0",
        title: { original: "vLLM v0.25.0 release" },
        status: "published"
      }),
      makeTechnologyItem({
        id: "other",
        slug: "unrelated",
        title: { original: "Something else entirely" },
        status: "published"
      })
    ]);

    const result = searchPublicContent("VLLM");

    expect(result.technologies).toHaveLength(1);
    expect(result.technologies[0].key).toBe("vllm");
    expect(result.totalCount).toBe(1);
  });

  it("matches technologies by summary and by resolved tag display name", () => {
    getAllTechnologiesMock.mockReturnValue([
      makeTechnologyItem({
        id: "by-summary",
        title: { original: "Untitled release" },
        summary: { original: "Ships a new inference engine." },
        tags: [],
        status: "published"
      }),
      makeTechnologyItem({
        id: "by-tag",
        title: { original: "Another release" },
        summary: { original: "No matching words here." },
        tags: ["tag-agents"],
        status: "published"
      })
    ]);

    const bySummary = searchPublicContent("inference");
    const byTag = searchPublicContent("智能体");

    expect(bySummary.technologies.map((item) => item.key)).toEqual([
      "by-summary"
    ]);
    expect(byTag.technologies.map((item) => item.key)).toEqual(["by-tag"]);
  });

  it("requires every space-separated term to match (AND, not OR)", () => {
    getAllTechnologiesMock.mockReturnValue([
      makeTechnologyItem({
        id: "both",
        title: { original: "vLLM inference engine" },
        status: "published"
      }),
      makeTechnologyItem({
        id: "only-vllm",
        title: { original: "vLLM release notes" },
        status: "published"
      })
    ]);

    const result = searchPublicContent("vllm inference");

    expect(result.technologies.map((item) => item.key)).toEqual(["both"]);
  });

  it("searches skills and knowledge independently of technologies", () => {
    getAllSkillsMock.mockReturnValue([makeSkill()]);
    getAllKnowledgeMock.mockReturnValue([makeKnowledge()]);

    const result = searchPublicContent("retrieval");

    expect(result.skills).toHaveLength(0);
    expect(result.knowledge).toHaveLength(1);
    expect(result.knowledge[0].key).toBe("knowledge-1");
    expect(result.totalCount).toBe(1);
  });

  it("includes matching news items and leaves totalCount inclusive of them", () => {
    getPublicNewsItemsMock.mockReturnValue([
      {
        key: "2026-07-14::https://example.com/a",
        title: "Ollama ships an agent-first release",
        summary: "New interactive agent experience.",
        sourceName: "Ollama Releases",
        sourceUrl: "https://example.com/a",
        publishDate: "2026-07-14",
        tags: ["端侧 AI"]
      },
      {
        key: "2026-07-14::https://example.com/b",
        title: "Unrelated news item",
        summary: undefined,
        sourceName: "Other Source",
        sourceUrl: "https://example.com/b",
        publishDate: "2026-07-14",
        tags: []
      }
    ]);

    const result = searchPublicContent("agent");

    expect(result.news).toHaveLength(1);
    expect(result.news[0].key).toBe("2026-07-14::https://example.com/a");
    expect(result.totalCount).toBe(1);
  });

  it("returns no results when nothing matches across any pool", () => {
    getAllTechnologiesMock.mockReturnValue([
      makeTechnologyItem({ title: { original: "vLLM release" } })
    ]);

    const result = searchPublicContent("nonexistent-keyword-xyz");

    expect(result.totalCount).toBe(0);
    expect(result.technologies).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
    expect(result.knowledge).toHaveLength(0);
    expect(result.news).toHaveLength(0);
  });
});

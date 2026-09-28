import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeTechnologyItem } from "@/lib/test-factories";
import { buildTopicIndex, getTopicHub, getTopicIndex } from "@/lib/topic-hub";
import type {
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
  TopicTag
} from "@/types/content";

const content = vi.hoisted(() => ({
  tags: [] as TopicTag[],
  technologies: [] as TechnologyItem[],
  skills: [] as SkillItem[],
  knowledge: [] as KnowledgeItem[]
}));

vi.mock("@/lib/content", () => ({
  getAllTags: () => content.tags,
  getAllTechnologies: () => content.technologies,
  getAllSkills: () => content.skills,
  getAllKnowledge: () => content.knowledge,
  getContentGraph: () => ({ nodes: [], edges: [] })
}));

function tag(id: string, name: string): TopicTag {
  return { id, name, description: `${name}的说明` };
}

function tech(id: string, tags: string[]): TechnologyItem {
  return makeTechnologyItem({ id, slug: id, status: "published", tags });
}

function skill(id: string, tags: string[]): SkillItem {
  return {
    id,
    title: id,
    slug: id,
    summary: "",
    content: "",
    skillType: "engineering",
    heatLevel: "hot",
    learningCost: "low",
    tags,
    relatedTechnologyIds: [],
    relatedKnowledgeIds: []
  };
}

function knowledge(id: string, tags: string[]): KnowledgeItem {
  return {
    id,
    title: id,
    slug: id,
    summary: "",
    content: "",
    category: "software-architecture",
    difficulty: "foundation",
    tags,
    relatedTechnologyIds: [],
    relatedSkillIds: []
  };
}

beforeEach(() => {
  content.tags = [
    tag("agents", "智能体"),
    tag("rag", "检索增强"),
    tag("evals", "评测"),
    tag("safety", "安全"),
    tag("empty", "空话题")
  ];
  content.technologies = [
    tech("t1", ["agents", "rag"]),
    tech("t2", ["agents"]),
    tech("t3", ["rag"]),
    tech("t4", ["unknown-tag"])
  ];
  content.skills = [skill("s1", ["evals"]), skill("s2", ["agents"])];
  content.knowledge = [knowledge("k1", ["safety", "evals"])];
});

describe("buildTopicIndex", () => {
  it("counts each kind per topic and drops topics with no content", () => {
    const { topics } = getTopicIndex();

    expect(topics.map((entry) => entry.id)).not.toContain("empty");
    expect(topics.find((entry) => entry.id === "agents")).toEqual({
      id: "agents",
      name: "智能体",
      description: "智能体的说明",
      technologyCount: 2,
      skillCount: 1,
      knowledgeCount: 0
    });
    expect(topics.find((entry) => entry.id === "evals")).toMatchObject({
      technologyCount: 0,
      skillCount: 1,
      knowledgeCount: 1
    });
  });

  it("lists exactly the topics whose hub page exists", () => {
    const listed = getTopicIndex().topics.map((entry) => entry.id);
    const withHub = content.tags
      .map((item) => item.id)
      .filter((id) => getTopicHub(id) !== undefined);

    expect([...listed].sort()).toEqual([...withHub].sort());
  });

  it("orders by signal count, then by name", () => {
    const { topics } = getTopicIndex();

    // agents and rag both have 2 signals; evals and safety have none.
    expect(topics.map((entry) => entry.id)).toEqual([
      ...["agents", "rag"].sort((left, right) =>
        content.tags
          .find((item) => item.id === left)!
          .name.localeCompare(
            content.tags.find((item) => item.id === right)!.name,
            "zh-CN"
          )
      ),
      ...["evals", "safety"].sort((left, right) =>
        content.tags
          .find((item) => item.id === left)!
          .name.localeCompare(
            content.tags.find((item) => item.id === right)!.name,
            "zh-CN"
          )
      )
    ]);
  });

  it("counts an item once per topic even if the tag repeats", () => {
    const { topics } = buildTopicIndex(
      [tag("agents", "智能体")],
      [tech("t1", ["agents", "agents"])],
      [],
      []
    );

    expect(topics[0].technologyCount).toBe(1);
  });

  it("reports coverage as distinct items under a known topic", () => {
    // t4 carries only an unknown tag, so it is not reachable from any topic.
    expect(getTopicIndex().coverage).toEqual({
      technologies: 3,
      skills: 2,
      knowledge: 1
    });
  });

  it("returns no topics when nothing is tagged", () => {
    expect(buildTopicIndex(content.tags, [], [], []).topics).toEqual([]);
  });
});

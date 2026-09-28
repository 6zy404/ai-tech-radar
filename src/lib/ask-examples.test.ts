import { describe, expect, it } from "vitest";

import {
  buildAskExamples,
  getAskSignalName,
  maxAskExamples,
  type AskExampleInput,
  type AskExampleSignal
} from "@/lib/ask-examples";

function signal(
  id: string,
  publishDate: string,
  zhTitle: string,
  extra: Partial<AskExampleSignal> = {}
): AskExampleSignal {
  return {
    id,
    slug: id,
    publishDate,
    title: { original: `original ${id}`, zh: zhTitle },
    sourceLanguage: "en",
    tags: [],
    relatedTechnologyIds: [],
    relatedKnowledgeIds: [],
    relatedSkillIds: [],
    ...extra
  };
}

const knowledge = [
  { id: "k-tools", title: "工具使用与函数调用" },
  { id: "k-rag", title: "检索增强生成基础" }
];
const skills = [
  { id: "s-agent", title: "智能体工作流设计" },
  { id: "s-retrieval", title: "检索流水线调优" }
];
const tags = [
  { id: "tag-agents", name: "AI 智能体" },
  { id: "tag-retrieval", name: "检索" }
];

function input(technologies: AskExampleSignal[]): AskExampleInput {
  return { technologies, knowledge, skills, tags };
}

const site = input([
  signal("adk", "2026-09-27", "ADK Kotlin 1.0：智能体逻辑不必再绕回 Python", {
    tags: ["tag-agents"],
    relatedKnowledgeIds: ["k-tools"],
    relatedSkillIds: ["s-agent"]
  }),
  signal("vllm-30", "2026-09-22", "vLLM v0.30.0：快速启动，外加生成水印", {
    tags: ["tag-agents", "tag-retrieval"],
    relatedTechnologyIds: ["vllm-29"],
    relatedKnowledgeIds: ["k-tools", "k-rag"],
    relatedSkillIds: ["s-retrieval", "s-agent"]
  }),
  signal("vllm-29", "2026-09-01", "vLLM v0.29.0：分离式预填充", {
    tags: ["tag-retrieval"],
    relatedTechnologyIds: ["vllm-30"],
    relatedKnowledgeIds: ["k-rag"]
  })
]);

describe("getAskSignalName", () => {
  it("names a signal by the headline's part before the colon", () => {
    expect(
      getAskSignalName("ADK Kotlin 1.0：智能体逻辑不必再绕回 Python")
    ).toBe("ADK Kotlin 1.0");
    expect(getAskSignalName("Gemini 3.8 Live: talking while tools run")).toBe(
      "Gemini 3.8 Live"
    );
  });

  it("uses a short title without a colon as it is", () => {
    expect(getAskSignalName("  vLLM v0.30.0  ")).toBe("vLLM v0.30.0");
  });

  it("skips a name too long for a one-line chip", () => {
    expect(
      getAskSignalName("只能打开网址的智能体，是怎样把代码送出去的")
    ).toBeUndefined();
    expect(
      getAskSignalName("一个非常非常非常非常非常长的名字超过了二十个字：后半")
    ).toBeUndefined();
  });
});

describe("buildAskExamples", () => {
  it("asks about the newest signals, a linked pair, and the most-cited concept, topic and skill", () => {
    expect(buildAskExamples(site)).toEqual([
      "「ADK Kotlin 1.0」讲了什么，为什么值得关注？",
      "「vLLM v0.29.0」和「vLLM v0.30.0」有什么区别？",
      "「工具使用与函数调用」是什么？最近哪些信号和它有关？",
      "最近「AI 智能体」方向有哪些值得关注的信号？",
      "想掌握「智能体工作流设计」，应该先读哪些内容？",
      "「vLLM v0.30.0」讲了什么，为什么值得关注？"
    ]);
  });

  it("gives the same questions whatever order the signals arrive in", () => {
    const reversed = input([...site.technologies].reverse());
    expect(buildAskExamples(reversed)).toEqual(buildAskExamples(site));
  });

  it("breaks a count tie in favour of what a newer signal cited first", () => {
    const tied = input([
      signal("new", "2026-09-10", "新信号", { relatedKnowledgeIds: ["k-rag"] }),
      signal("old", "2026-09-01", "旧信号", {
        relatedKnowledgeIds: ["k-tools"]
      })
    ]);

    expect(buildAskExamples(tied)).toContain(
      "「检索增强生成基础」是什么？最近哪些信号和它有关？"
    );
  });

  it("never names an id the published pools do not hold", () => {
    const dangling = input([
      signal("a", "2026-09-10", "甲信号", {
        tags: ["tag-unknown"],
        relatedTechnologyIds: ["draft-signal"],
        relatedKnowledgeIds: ["k-draft"],
        relatedSkillIds: ["s-draft"]
      })
    ]);

    expect(buildAskExamples(dangling)).toEqual([
      "「甲信号」讲了什么，为什么值得关注？"
    ]);
  });

  it("returns nothing when nothing is published", () => {
    expect(buildAskExamples(input([]))).toEqual([]);
  });

  it("caps the set and keeps every question within the API's 200 characters", () => {
    const many = input(
      Array.from({ length: 30 }, (_, index) =>
        signal(
          `s${index}`,
          `2026-09-${String(index + 1).padStart(2, "0")}`,
          `信号 ${index}`,
          {
            tags: ["tag-agents"],
            relatedTechnologyIds: [`s${(index + 1) % 30}`],
            relatedKnowledgeIds: ["k-tools"],
            relatedSkillIds: ["s-agent"]
          }
        )
      )
    );
    const examples = buildAskExamples(many);

    expect(examples).toHaveLength(maxAskExamples);
    expect(new Set(examples).size).toBe(examples.length);
    for (const example of examples) {
      expect([...example].length).toBeLessThanOrEqual(200);
    }
  });
});

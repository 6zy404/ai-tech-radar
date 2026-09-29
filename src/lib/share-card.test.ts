import { describe, expect, it } from "vitest";

import { knowledgeItems } from "@/data/knowledge";
import { skillItems } from "@/data/skills";
import { topicTags } from "@/data/tags";
import { technologyItems } from "@/data/technologies";
import {
  buildDigestShareCard,
  buildKnowledgeShareCard,
  buildShareCard,
  buildSiteShareCard,
  buildSkillShareCard,
  buildTopicShareCard,
  buildWeeklyShareCard,
  firstSentence,
  estimateTextWidth,
  fitSingleLine,
  layoutShareCardTitle,
  shareCardTitleWidth,
  splitIntoBreakUnits,
  wrapUnits
} from "@/lib/share-card";
import type { TopicHubData } from "@/lib/topic-hub";
import type { WeeklyReviewData } from "@/lib/weekly-review";
import type { TechnologyItem } from "@/types/content";

const seed = technologyItems[0];

function signal(overrides: Partial<TechnologyItem>): TechnologyItem {
  return { ...seed, status: "published", ...overrides };
}

function expectLinesFit(lines: string[], fontSize: number) {
  for (const line of lines) {
    expect(estimateTextWidth(line)).toBeLessThanOrEqual(
      shareCardTitleWidth / fontSize
    );
  }
}

describe("layoutShareCardTitle", () => {
  it("keeps a short title on one line at the largest size", () => {
    expect(layoutShareCardTitle("模型上下文协议")).toEqual({
      fontSize: 68,
      lines: ["模型上下文协议"],
      truncated: false
    });
  });

  it("steps the size down before it cuts anything", () => {
    const title =
      "OpenAI 发布 GPT-5.5：更长的上下文窗口、原生工具调用与更低的推理成本，同时开放企业级微调接口";
    const layout = layoutShareCardTitle(title);

    expect(layout.fontSize).toBeLessThan(68);
    expect(layout.truncated).toBe(false);
    expect(layout.lines.join("").replace(/\s/g, "")).toBe(
      title.replace(/\s/g, "")
    );
    expectLinesFit(layout.lines, layout.fontSize);
  });

  it("cuts a title too long for four lines and ends it with an ellipsis", () => {
    const title = "这是一条非常长的技术信号标题，".repeat(8);
    const layout = layoutShareCardTitle(title);

    expect(layout.truncated).toBe(true);
    expect(layout.lines).toHaveLength(4);
    expect(layout.lines[3].endsWith("…")).toBe(true);
    // No dangling comma right before the ellipsis.
    expect(layout.lines[3]).not.toMatch(/，…$/);
    expectLinesFit(layout.lines, layout.fontSize);
  });

  it("never splits an English word across lines", () => {
    const title =
      "Anthropic releases Claude Agent SDK with persistent memory, sandboxed tool execution and multi-agent orchestration primitives";
    const layout = layoutShareCardTitle(title);
    const words = new Set(title.split(" "));

    for (const line of layout.lines) {
      for (const word of line.replace(/…$/, "").split(" ")) {
        if (line.endsWith("…") && line.endsWith(`${word}…`)) continue;
        expect(words.has(word)).toBe(true);
      }
    }
    expectLinesFit(layout.lines, layout.fontSize);
  });

  it("does not start a line with closing punctuation", () => {
    const title =
      "测试测试测试测试测试测试测试，测试测试测试测试测试测试测试。";
    const lines = wrapUnits(splitIntoBreakUnits(title), 14);

    for (const line of lines) {
      expect(line).not.toMatch(/^[，。、；：？！）》」]/);
    }
  });

  it("hard-splits a single word longer than a line", () => {
    const layout = layoutShareCardTitle(
      "https://github.com/example/extremely-long-repository-name-without-any-spaces-at-all"
    );

    expectLinesFit(layout.lines, layout.fontSize);
    expect(layout.lines.length).toBeGreaterThan(1);
  });
});

describe("splitIntoBreakUnits", () => {
  it("keeps brackets with the word they enclose", () => {
    expect(splitIntoBreakUnits("模型（Qwen3）发布")).toEqual([
      "模",
      "型",
      "（Qwen3）",
      "发",
      "布"
    ]);
  });
});

describe("fitSingleLine", () => {
  it("leaves a line that fits alone and cuts one that does not", () => {
    expect(fitSingleLine("来源 OpenAI", 20)).toBe("来源 OpenAI");

    const cut = fitSingleLine("很长的来源名称".repeat(10), 20);
    expect(cut.endsWith("…")).toBe(true);
    expect(estimateTextWidth(cut)).toBeLessThanOrEqual(20);
  });
});

describe("buildShareCard", () => {
  it("returns the site card when the slug matched nothing", () => {
    const card = buildShareCard(undefined);

    expect(card.kind).toBe("site");
    expect(card.date).toBeUndefined();
    expect(card.title.lines.length).toBeGreaterThan(0);
  });

  it("prefers the Chinese title and shows source, publisher type and date", () => {
    const card = buildShareCard(signal({}));

    expect(card.kind).toBe("signal");
    expect(card.title.lines).toEqual(["模型上下文协议"]);
    expect(card.stamp).toBe("技术信号 · 协议");
    expect(card.byline).toBe("来源 AI 工具标准简报 · 开源社区");
    expect(card.date).toBe("2026-04-10");
  });

  it("falls back to the original title when there is no Chinese one", () => {
    const card = buildShareCard(
      signal({ title: { original: "Model Context Protocol" } })
    );

    expect(card.title.lines.join(" ")).toBe("Model Context Protocol");
  });

  it("carries no internal or ranking field", () => {
    const serialized = JSON.stringify(
      buildShareCard(
        signal({
          intelligenceStatus: "needs_enrichment"
        } as Partial<TechnologyItem>)
      )
    );

    for (const field of [
      "intelligenceStatus",
      "needs_enrichment",
      "priority",
      "立即关注",
      "sourceUrl",
      "example.com"
    ]) {
      expect(serialized).not.toContain(field);
    }
  });
});

// Every card must fall back to exactly the site card when its page would
// 404, so a share image never names something the page does not show.
describe("fallback to the site card", () => {
  const site = buildSiteShareCard();

  it.each([
    ["signal", () => buildShareCard(undefined)],
    ["digest", () => buildDigestShareCard(undefined)],
    ["weekly", () => buildWeeklyShareCard(undefined)],
    ["skill", () => buildSkillShareCard(undefined)],
    ["knowledge", () => buildKnowledgeShareCard(undefined)],
    ["topic", () => buildTopicShareCard(undefined)]
  ])("%s with nothing to show", (_kind, build) => {
    expect(build()).toEqual(site);
  });

  it("a week with no shown signal", () => {
    expect(buildWeeklyShareCard(week({ totalCount: 0 }))).toEqual(site);
  });

  it("is the site card, with no date", () => {
    expect(site.kind).toBe("site");
    expect(site.date).toBeUndefined();
  });
});

function week(overrides: Partial<WeeklyReviewData> = {}): WeeklyReviewData {
  return {
    weekKey: "2026-09-21",
    weekStart: "2026-09-21",
    weekEnd: "2026-09-27",
    rangeLabel: "9 月 21 日 – 9 月 27 日",
    isCurrentWeek: false,
    totalCount: 17,
    highPriorityCount: 12,
    watchCount: 5,
    topicCount: 9,
    groups: [],
    ...overrides
  };
}

describe("firstSentence", () => {
  it("stops at the first Chinese full stop", () => {
    expect(firstSentence("第一句。第二句。")).toBe("第一句。");
  });

  it("keeps a closing quote that follows the stop", () => {
    expect(firstSentence("他说「够了。」然后走了。")).toBe("他说「够了。」");
  });

  it("does not stop at an ASCII dot in a version or a decimal", () => {
    expect(firstSentence("vLLM v0.26.0 快 3.7 倍。后面")).toBe(
      "vLLM v0.26.0 快 3.7 倍。"
    );
  });

  it("returns the whole text when there is no stop", () => {
    expect(firstSentence("  没有句号  的一段 ")).toBe("没有句号 的一段");
  });
});

describe("buildDigestShareCard", () => {
  const input = {
    date: "2026-09-28",
    title: "技术简报 - 2026-09-28",
    highPriorityCount: 7,
    watchCount: 3
  };

  it("heads the card with the editorial summary's first sentence", () => {
    const card = buildDigestShareCard({
      ...input,
      lede: "这一期的十条里，有六条在回答同一个问题。OpenAI 一个训练中的模型……"
    });

    expect(card.kind).toBe("digest");
    expect(card.stamp).toBe("技术简报");
    expect(card.title.lines.join("")).toBe(
      "这一期的十条里，有六条在回答同一个问题。"
    );
    expect(card.byline).toBe("7 条立即关注 · 3 条值得跟踪");
    expect(card.date).toBe("2026-09-28");
  });

  it("keeps the title when the sentence has a character the font lacks", () => {
    const card = buildDigestShareCard(
      { ...input, lede: "这期讲的是龘。第二句。" },
      { canDraw: (text) => !text.includes("龘") }
    );

    expect(card.title.lines.join("")).toBe("技术简报 - 2026-09-28");
  });

  it("keeps the title when there is no editorial summary", () => {
    expect(buildDigestShareCard(input).title.lines.join("")).toBe(
      "技术简报 - 2026-09-28"
    );
    expect(
      buildDigestShareCard({ ...input, lede: "   " }).title.lines.join("")
    ).toBe("技术简报 - 2026-09-28");
  });
});

describe("buildWeeklyShareCard", () => {
  it("shows the range, the counts and the year", () => {
    const card = buildWeeklyShareCard(week());

    expect(card.kind).toBe("weekly");
    expect(card.stamp).toBe("本周回顾");
    expect(card.title.lines.join("")).toBe("9 月 21 日 – 9 月 27 日");
    expect(card.byline).toBe(
      "17 条信号 · 12 条立即关注 · 5 条值得跟踪 · 9 个话题"
    );
    expect(card.date).toBe("2026 年");
  });
});

describe("buildSkillShareCard / buildKnowledgeShareCard", () => {
  it("labels a skill by type, heat and learning cost", () => {
    const skill = {
      ...skillItems[0],
      skillType: "product" as const,
      heatLevel: "hot" as const,
      learningCost: "medium" as const
    };
    const card = buildSkillShareCard(skill);

    expect(card.kind).toBe("skill");
    expect(card.stamp).toBe("技能 · 产品判断");
    expect(card.title.lines.join("")).toBe(skill.title.replace(/s+/g, ""));
    expect(card.byline).toBe("当前热门 · 学习成本中等");
    expect(card.date).toBeUndefined();
  });

  it("labels knowledge by category and difficulty", () => {
    const knowledge = {
      ...knowledgeItems[0],
      category: "software-architecture" as const,
      difficulty: "intermediate" as const
    };
    const card = buildKnowledgeShareCard(knowledge);

    expect(card.kind).toBe("knowledge");
    expect(card.stamp).toBe("知识 · 软件架构");
    expect(card.byline).toBe("难度 进阶");
    expect(card.date).toBeUndefined();
  });
});

describe("buildTopicShareCard", () => {
  it("shows the topic name and its three counts", () => {
    const hub: TopicHubData = {
      tag: topicTags[0],
      technologies: [
        {
          slug: "a",
          title: "A",
          summary: "",
          publishDate: "2026-09-01",
          sourceName: "S"
        }
      ],
      skills: skillItems.slice(0, 2),
      knowledge: [],
      relatedNodes: []
    };
    const card = buildTopicShareCard(hub);

    expect(card.kind).toBe("topic");
    expect(card.stamp).toBe("话题");
    expect(card.title.lines.join("")).toBe(
      topicTags[0].name.replace(/s+/g, "")
    );
    expect(card.byline).toBe("收录 1 信号 · 2 技能 · 0 知识");
  });
});

describe("new cards stay inside the public boundary", () => {
  it("carry no internal field even when handed a workspace record", () => {
    const serialized = JSON.stringify([
      buildSkillShareCard({
        ...skillItems[0],
        status: "draft",
        editorialNotes: "内部备注"
      } as (typeof skillItems)[number]),
      buildKnowledgeShareCard({
        ...knowledgeItems[0],
        status: "draft"
      } as (typeof knowledgeItems)[number])
    ]);

    for (const field of ["status", "draft", "editorialNotes", "内部备注"]) {
      expect(serialized).not.toContain(field);
    }
  });
});

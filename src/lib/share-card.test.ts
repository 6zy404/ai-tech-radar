import { describe, expect, it } from "vitest";

import { technologyItems } from "@/data/technologies";
import {
  buildShareCard,
  estimateTextWidth,
  fitSingleLine,
  layoutShareCardTitle,
  shareCardTitleWidth,
  splitIntoBreakUnits,
  wrapUnits
} from "@/lib/share-card";
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

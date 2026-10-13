import { describe, expect, it } from "vitest";

import { aiGeneratedDisclaimer } from "@/lib/ai-disclaimer";
import {
  buildAskConversationCopyText,
  buildAskCopyText,
  toAbsoluteUrl,
  toAnswerParagraphs,
  type AskCopyInput,
  type AskCopySource
} from "@/lib/ask-answer-copy";

const sources: AskCopySource[] = [
  {
    ref: 1,
    kind: "technology",
    title: "Ollama 0.34",
    href: "/technologies/ollama-0-34"
  },
  {
    ref: 2,
    kind: "skill",
    title: "本地推理部署",
    href: "/skills/local-inference"
  },
  {
    ref: 3,
    kind: "knowledge",
    title: "量化",
    href: "/knowledge/quantization"
  }
];

function input(overrides: Partial<AskCopyInput> = {}): AskCopyInput {
  return {
    question: "本地跑大模型要注意什么？",
    answer:
      "显存是第一道门槛[1]。\n\n量化可以把它压下来[3]，部署时**注意**端口[2]。",
    sources,
    cited: [1, 3, 2],
    invalid: [],
    origin: "https://aizyradar.cn",
    disclaimer: aiGeneratedDisclaimer,
    ...overrides
  };
}

describe("buildAskCopyText", () => {
  it("lays out question, answer, cited sources and the disclaimer", () => {
    expect(buildAskCopyText(input())).toBe(
      [
        "问：本地跑大模型要注意什么？",
        "",
        "显存是第一道门槛[1]。",
        "",
        "量化可以把它压下来[3]，部署时注意端口[2]。",
        "",
        "出处：",
        "[1] Ollama 0.34（技术信号） https://aizyradar.cn/technologies/ollama-0-34",
        "[2] 本地推理部署（技能） https://aizyradar.cn/skills/local-inference",
        "[3] 量化（知识） https://aizyradar.cn/knowledge/quantization",
        "",
        aiGeneratedDisclaimer
      ].join("\n")
    );
  });

  it("lists only the cited sources", () => {
    const text = buildAskCopyText(
      input({ answer: "只用到一条[2]。", cited: [2] })
    );

    expect(text).toContain("[2] 本地推理部署");
    expect(text).not.toContain("Ollama");
    expect(text).not.toContain("量化");
  });

  it("marks a number no retrieved item carries and leaves it out of the sources", () => {
    const text = buildAskCopyText(
      input({
        answer: "这一句没有出处[7]，这一句有[1]，又一次[7]。",
        cited: [7, 1],
        invalid: [7]
      })
    );

    expect(text).toContain("这一句没有出处[7?]，这一句有[1]，又一次[7?]。");
    expect(text).not.toMatch(/\[7\](?!\?)/);
    expect(text).toContain("注：[7?] 不对应任何检索到的条目，是无效编号。");
    expect(text).not.toMatch(/^\[7/m);
  });

  it("treats a number missing from the sources as invalid even if the server did not flag it", () => {
    const text = buildAskCopyText(
      input({ answer: "凭空的编号[9]。", cited: [9], invalid: [] })
    );

    expect(text).toContain("凭空的编号[9?]。");
    expect(text).toContain("注：[9?]");
    expect(text).not.toContain("出处：");
  });

  it("lists several invalid numbers once each, in order of appearance", () => {
    const text = buildAskCopyText(
      input({ answer: "[8] 与 [5] 与 [8]", cited: [8, 5], invalid: [8, 5] })
    );

    expect(text).toContain("注：[8?]、[5?] 不对应");
  });

  it("omits the source list when nothing is cited, e.g. a refusal", () => {
    const text = buildAskCopyText(
      input({ answer: "站内没有直接相关的内容。", cited: [] })
    );

    expect(text).toBe(
      [
        "问：本地跑大模型要注意什么？",
        "",
        "站内没有直接相关的内容。",
        "",
        aiGeneratedDisclaimer
      ].join("\n")
    );
  });

  it("ends with the disclaimer", () => {
    expect(buildAskCopyText(input()).endsWith(aiGeneratedDisclaimer)).toBe(
      true
    );
  });
});

describe("toAnswerParagraphs", () => {
  it("splits on line breaks, trims, drops blanks and bold markers", () => {
    expect(toAnswerParagraphs("  一段**重点**  \n\n\n 二段\n")).toEqual([
      "一段重点",
      "二段"
    ]);
  });
});

describe("toAbsoluteUrl", () => {
  it("resolves a site path against the origin", () => {
    expect(toAbsoluteUrl("/skills/a", "http://127.0.0.1:3301")).toBe(
      "http://127.0.0.1:3301/skills/a"
    );
  });

  it("keeps an already absolute link", () => {
    expect(toAbsoluteUrl("https://example.com/x", "https://aizyradar.cn")).toBe(
      "https://example.com/x"
    );
  });
});

describe("buildAskConversationCopyText", () => {
  const first = {
    question: "本地跑大模型要注意什么？",
    answer: "先看显存[1]，另见[3]。",
    sources: sources.slice(0, 2),
    cited: [1, 3],
    invalid: [3]
  };
  const second = {
    question: "量化呢？",
    answer: "量化能省显存[3]，Ollama 也支持[1]。",
    sources,
    cited: [3, 1],
    invalid: []
  };

  it("copies a single turn exactly as 复制答案 always has", () => {
    const { question, answer, sources: turnSources, cited, invalid } = input();

    expect(
      buildAskConversationCopyText({
        turns: [{ question, answer, sources: turnSources, cited, invalid }],
        origin: "https://aizyradar.cn",
        disclaimer: aiGeneratedDisclaimer
      })
    ).toBe(buildAskCopyText(input()));
  });

  it("copies every turn, one source list for the conversation and the disclaimer once", () => {
    const text = buildAskConversationCopyText({
      turns: [first, second],
      origin: "https://aizyradar.cn",
      disclaimer: aiGeneratedDisclaimer
    });

    expect(text).toBe(
      [
        "问：本地跑大模型要注意什么？",
        "",
        // [3] was not retrieved yet in the first turn: it stays invalid
        // there even though the second turn retrieved an item as #3.
        "先看显存[1]，另见[3?]。",
        "",
        "——",
        "",
        "追问：量化呢？",
        "",
        "量化能省显存[3]，Ollama 也支持[1]。",
        "",
        "出处：",
        "[1] Ollama 0.34（技术信号） https://aizyradar.cn/technologies/ollama-0-34",
        "[3] 量化（知识） https://aizyradar.cn/knowledge/quantization",
        "",
        "注：[3?] 不对应任何检索到的条目，是无效编号。",
        "",
        aiGeneratedDisclaimer
      ].join("\n")
    );
    expect(text.split(aiGeneratedDisclaimer)).toHaveLength(2);
  });
});

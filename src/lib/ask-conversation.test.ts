import { describe, expect, it } from "vitest";

import {
  askHistoryAnswerMaxChars,
  askHistoryMaxChars,
  askMaxTurns,
  fitHistory,
  parseAskRequest,
  truncateForHistory
} from "@/lib/ask-conversation";

describe("truncateForHistory", () => {
  it("leaves short text alone", () => {
    expect(truncateForHistory("  短回答[1]。  ", 600)).toBe("短回答[1]。");
  });

  it("cuts at the last sentence end past halfway and marks the cut", () => {
    const text = `${"甲".repeat(40)}。${"乙".repeat(40)}`;

    expect(truncateForHistory(text, 60)).toBe(`${"甲".repeat(40)}。…`);
  });

  it("cuts mid-sentence when no sentence ends past halfway", () => {
    const cut = truncateForHistory("丙".repeat(100), 30);

    expect(cut).toBe(`${"丙".repeat(29)}…`);
    expect(cut.length).toBe(30);
  });
});

describe("fitHistory", () => {
  it("cuts each answer to its cap", () => {
    const [turn] = fitHistory([
      { question: "问", answer: "答".repeat(askHistoryAnswerMaxChars + 200) }
    ]);

    expect(turn.answer.length).toBe(askHistoryAnswerMaxChars);
    expect(turn.answer.endsWith("…")).toBe(true);
  });

  it("drops the oldest turns once the total budget is spent", () => {
    const long = (label: string) => ({
      question: label,
      answer: "答".repeat(askHistoryAnswerMaxChars)
    });
    const turns = [long("一"), long("二"), long("三"), long("四")];
    const kept = fitHistory(turns);
    const total = kept.reduce(
      (sum, turn) => sum + turn.question.length + turn.answer.length,
      0
    );

    expect(kept.map((turn) => turn.question)).toEqual(["二", "三", "四"]);
    expect(total).toBeLessThanOrEqual(askHistoryMaxChars);
  });
});

describe("parseAskRequest", () => {
  it("accepts a first question as before", () => {
    expect(parseAskRequest({ question: " 本地跑大模型 " })).toEqual({
      ok: true,
      question: "本地跑大模型",
      history: [],
      priorSources: []
    });
  });

  it("rejects a question outside 2–200 characters", () => {
    expect(parseAskRequest({ question: "a" }).ok).toBe(false);
    expect(parseAskRequest({ question: "a".repeat(201) }).ok).toBe(false);
  });

  it(`refuses a ${askMaxTurns + 1}th question with a message to start over`, () => {
    const history = Array.from({ length: askMaxTurns }, (_, index) => ({
      question: `问题 ${index}`,
      answer: "回答"
    }));
    const parsed = parseAskRequest({ question: "再问一次", history });

    expect(parsed).toEqual({
      ok: false,
      error: `一段对话最多问 ${askMaxTurns} 次，请开新对话继续。`
    });
  });

  it("accepts the last allowed follow-up", () => {
    const history = Array.from({ length: askMaxTurns - 1 }, () => ({
      question: "问题",
      answer: "回答"
    }));

    expect(parseAskRequest({ question: "最后一问", history }).ok).toBe(true);
  });

  it("rejects malformed history instead of guessing", () => {
    expect(parseAskRequest({ question: "追问", history: "x" }).ok).toBe(false);
    expect(
      parseAskRequest({ question: "追问", history: [{ question: 1 }] }).ok
    ).toBe(false);
  });

  it("keeps only well-formed, unique source refs", () => {
    const parsed = parseAskRequest({
      question: "追问",
      history: [{ question: "问", answer: "答[1]" }],
      sources: [
        { ref: 1, key: "T:ollama-0-34" },
        { ref: 1, key: "S:dup-ref" },
        { ref: 2, key: "T:ollama-0-34" },
        { ref: 3, key: "X:not-a-kind" },
        { ref: 4, key: "K:../../etc" },
        { ref: 0, key: "K:zero" },
        { ref: 2.5, key: "K:fraction" },
        { ref: 5, key: "K:model-quantization", title: "伪造标题" }
      ]
    });

    expect(parsed.ok && parsed.priorSources).toEqual([
      { ref: 1, key: "T:ollama-0-34" },
      { ref: 5, key: "K:model-quantization" }
    ]);
  });

  it("ignores carried sources when there is no history", () => {
    const parsed = parseAskRequest({
      question: "新问题",
      sources: [{ ref: 1, key: "T:ollama-0-34" }]
    });

    expect(parsed.ok && parsed.priorSources).toEqual([]);
  });
});

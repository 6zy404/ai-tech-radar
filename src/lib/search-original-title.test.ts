import { describe, expect, it } from "vitest";

import {
  excerptAroundTerms,
  findHiddenTitleTerms,
  getOriginalTitleExcerpt,
  originalTitleMaxLength,
  type OriginalTitleCardText
} from "@/lib/search-original-title";

const card: OriginalTitleCardText = {
  title: "智能体入侵技术复盘：17,600 次动作",
  summary: "一次越权的完整时间线。",
  tags: ["安全", "评测"],
  originalTitle:
    "Anatomy of a Frontier Lab Agent Intrusion: A Technical Timeline of the July 2026 Incident"
};

describe("findHiddenTitleTerms", () => {
  it("returns a term that hits only the undisplayed title", () => {
    expect(findHiddenTitleTerms(card, ["agent"])).toEqual(["agent"]);
  });

  it("returns nothing when the term is visible in the displayed title", () => {
    expect(findHiddenTitleTerms(card, ["智能体"])).toEqual([]);
  });

  it("returns nothing when the term is visible in the summary or a tag", () => {
    expect(
      findHiddenTitleTerms({ ...card, summary: "Agent 越权" }, ["agent"])
    ).toEqual([]);
    expect(
      findHiddenTitleTerms({ ...card, tags: ["Agent 安全"] }, ["agent"])
    ).toEqual([]);
  });

  it("returns nothing without an original title", () => {
    expect(
      findHiddenTitleTerms({ ...card, originalTitle: undefined }, ["agent"])
    ).toEqual([]);
  });

  it("judges each term on its own", () => {
    // 时间线 is marked in the summary; agent is only in the original title.
    expect(findHiddenTitleTerms(card, ["agent", "时间线"])).toEqual(["agent"]);
  });

  it("returns every term hidden in the original title, once each", () => {
    expect(findHiddenTitleTerms(card, ["Agent", "timeline", "agent"])).toEqual([
      "agent",
      "timeline"
    ]);
  });
});

describe("getOriginalTitleExcerpt", () => {
  it("is undefined when every term is already visible", () => {
    expect(getOriginalTitleExcerpt(card, ["复盘"])).toBeUndefined();
  });

  it("returns a short original title whole", () => {
    expect(
      getOriginalTitleExcerpt({ ...card, originalTitle: "Stateless MCP" }, [
        "stateless"
      ])
    ).toBe("Stateless MCP");
  });

  it("keeps a hit near the end of a long title visible", () => {
    const excerpt = getOriginalTitleExcerpt(card, ["incident"]) ?? "";

    expect(excerpt.length).toBeLessThanOrEqual(originalTitleMaxLength);
    expect(excerpt).toContain("Incident");
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(false);
  });
});

describe("excerptAroundTerms", () => {
  const long =
    "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen";

  it("returns text within the limit unchanged", () => {
    expect(excerptAroundTerms("Short title", ["title"], 40)).toBe(
      "Short title"
    );
  });

  it("centres a middle hit with an ellipsis on both sides", () => {
    const excerpt = excerptAroundTerms(long, ["nine"], 30);

    expect(excerpt).toContain("nine");
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(30);
  });

  it("does not cut inside a word in spaced text", () => {
    const excerpt = excerptAroundTerms(long, ["nine"], 30);
    const words = excerpt.replace(/…/g, "").split(" ");

    for (const word of words) {
      expect(long.split(" ")).toContain(word);
    }
  });

  it("keeps the head when the hit is at the start", () => {
    const excerpt = excerptAroundTerms(long, ["one"], 30);

    expect(excerpt.startsWith("One")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("keeps several hits when they fit in one window", () => {
    const excerpt = excerptAroundTerms(long, ["eight", "ten"], 30);

    expect(excerpt).toContain("eight");
    expect(excerpt).toContain("ten");
  });

  it("keeps the first hit when the hits are too far apart to fit", () => {
    const excerpt = excerptAroundTerms(long, ["two", "sixteen"], 24);

    expect(excerpt).toContain("two");
    expect(excerpt).not.toContain("sixteen");
    expect(excerpt.length).toBeLessThanOrEqual(24);
  });

  it("cuts unspaced text at the character", () => {
    const cjk =
      "这是一段没有空格的很长的中文标题其中智能体出现在中间然后继续写下去直到超出长度";
    const excerpt = excerptAroundTerms(cjk, ["智能体"], 16);

    expect(excerpt).toContain("智能体");
    expect(excerpt.length).toBeLessThanOrEqual(16);
  });

  it("never splits a surrogate pair", () => {
    const text = `${"😀".repeat(20)}agent${"😀".repeat(20)}`;
    const excerpt = excerptAroundTerms(text, ["agent"], 20);

    expect(excerpt).toContain("agent");
    expect(excerpt).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(excerpt).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });

  it("does not move to clause ends unless asked", () => {
    const text = `${"甲".repeat(30)}，${"乙".repeat(30)}命中${"丙".repeat(30)}，${"丁".repeat(30)}`;

    expect(excerptAroundTerms(text, ["命中"], 40)).toBe(
      `…${"乙".repeat(18)}命中${"丙".repeat(18)}…`
    );
  });

  it("moves each cut edge to a clause end in its outer half", () => {
    const text = `${"甲".repeat(30)}，${"乙".repeat(12)}命中${"丙".repeat(12)}，${"丁".repeat(30)}`;
    const excerpt = excerptAroundTerms(text, ["命中"], 40, {
      clauseBoundaries: true
    });

    expect(excerpt).toBe(`…${"乙".repeat(12)}命中${"丙".repeat(12)}…`);
  });

  it("keeps the cut when the clause end is too close to the hit", () => {
    const text = `${"甲".repeat(30)}${"乙".repeat(17)}，命中${"丙".repeat(40)}`;
    const excerpt = excerptAroundTerms(text, ["命中"], 40, {
      clauseBoundaries: true
    });

    // The only clause end sits right before the hit, in the inner half.
    expect(excerpt.startsWith(`…${"乙".repeat(17)}`)).toBe(true);
  });

  it("does not take a decimal point for a clause end", () => {
    const text = `${"甲".repeat(20)} version 2.0 ${"乙".repeat(12)}命中${"丙".repeat(40)}`;
    const excerpt = excerptAroundTerms(text, ["命中"], 40, {
      clauseBoundaries: true
    });

    expect(excerpt).not.toMatch(/^…0/);
  });

  it("falls back to the head without a hit", () => {
    const excerpt = excerptAroundTerms(long, ["absent"], 20);

    expect(excerpt.startsWith("One")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { compactText } from "@/lib/compact-text";
import {
  chooseSummaryExcerpt,
  findHiddenSummaryTerms,
  getSearchCardText,
  originalSummaryMaxLength,
  searchSummaryMaxLength,
  type SearchCardSource
} from "@/lib/search-card-text";

// Past 160 characters; the card cuts it at a clause before 精确率, so
// 精确率 and 独立验证 sit past the cut.
const longSummary =
  "阿里开源的代码评审工具在内部仓库跑了一年，官方给出的数据是评审意见被采纳的比例约六成，覆盖语言包括 Java、Go 与 TypeScript，接入方式是在合并请求上挂一个机器人账号，逐条给出修改建议，并在每条建议后附上引用的规则编号与示例代码，方便作者判断是否采纳，也方便团队按规则统计误报。唯一一次独立测试的精确率约 12%，维护者称是已修复的异常，修复后尚无独立验证。";

function card(overrides: Partial<SearchCardSource> = {}): SearchCardSource {
  return {
    title: "阿里开源代码评审工具",
    summary: compactText(longSummary, searchSummaryMaxLength),
    fullSummary: longSummary,
    tags: ["代码评审", "开源"],
    originalTitle: "Alibaba open-sources its code review agent",
    originalSummary:
      "Alibaba released the code review bot it has run internally for a year. The only independent test found about 12% precision; maintainers say the anomaly is fixed, with no independent re-test since.",
    ...overrides
  };
}

describe("chooseSummaryExcerpt", () => {
  it("keeps the head when there is no hit past the cut", () => {
    const source = card();

    expect(chooseSummaryExcerpt(source, ["机器人"])).toBe(source.summary);
  });

  it("keeps the head when nothing was cut", () => {
    const source = card({ summary: "短摘要。", fullSummary: undefined });

    expect(chooseSummaryExcerpt(source, ["精确率"])).toBe("短摘要。");
  });

  it("keeps the head without terms (a semantic-only result)", () => {
    const source = card();

    expect(chooseSummaryExcerpt(source, [])).toBe(source.summary);
  });

  it("moves the window to a hit past the cut", () => {
    const source = card();
    const excerpt = chooseSummaryExcerpt(source, ["精确率"]) ?? "";

    expect(source.summary).not.toContain("精确率");
    expect(excerpt).toContain("精确率");
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(searchSummaryMaxLength);
  });

  it("starts the moved window at a clause, not inside a word", () => {
    const excerpt = chooseSummaryExcerpt(card(), ["精确率"]) ?? "";
    const body = excerpt.replace(/^…/, "").replace(/…$/, "");

    // Whatever it starts with directly follows a clause end in the source.
    const at = longSummary.indexOf(body);

    expect(at).toBeGreaterThan(0);
    expect("，。、；：").toContain(longSummary[at - 1]);
  });

  it("leaves the head when the term is visible in the title or a tag", () => {
    expect(
      chooseSummaryExcerpt(card({ title: "精确率只有 12%" }), ["精确率"])
    ).toBe(card().summary);
    expect(chooseSummaryExcerpt(card({ tags: ["精确率"] }), ["精确率"])).toBe(
      card().summary
    );
  });

  it("keeps a head hit when the later hit fits in the same window", () => {
    const excerpt = chooseSummaryExcerpt(card(), ["机器人", "精确率"]) ?? "";

    expect(excerpt).toContain("机器人");
    expect(excerpt).toContain("精确率");
  });

  it("ignores a term the title already shows when placing the window", () => {
    const excerpt =
      chooseSummaryExcerpt(card(), ["阿里开源", "独立验证"]) ?? "";

    expect(excerpt).toContain("独立验证");
  });

  it("keeps the head when moving would only trade one hidden term for another", () => {
    // 内部仓库 opens the summary and 独立验证 closes it, too far apart for
    // one window; either way one of them stays off the card.
    const source = card();

    expect(chooseSummaryExcerpt(source, ["内部仓库", "独立验证"])).toBe(
      source.summary
    );
  });
});

describe("findHiddenSummaryTerms", () => {
  const visible = {
    title: "阿里开源代码评审工具",
    summary: "官方给出的数据是评审意见被采纳的比例约六成。",
    tags: ["代码评审"]
  };
  const original = "The only independent test found about 12% precision.";

  it("returns a term only the undisplayed summary has", () => {
    expect(findHiddenSummaryTerms(visible, original, ["precision"])).toEqual([
      "precision"
    ]);
  });

  it("returns nothing when the card shows the term somewhere", () => {
    expect(
      findHiddenSummaryTerms(
        { ...visible, summary: "Precision 很低" },
        original,
        ["precision"]
      )
    ).toEqual([]);
    expect(
      findHiddenSummaryTerms({ ...visible, tags: ["precision"] }, original, [
        "precision"
      ])
    ).toEqual([]);
  });

  it("defers to the 原标题 line", () => {
    expect(
      findHiddenSummaryTerms(
        { ...visible, originalTitle: "…a test of precision" },
        original,
        ["precision"]
      )
    ).toEqual([]);
  });

  it("returns nothing without an undisplayed summary", () => {
    expect(findHiddenSummaryTerms(visible, undefined, ["precision"])).toEqual(
      []
    );
  });

  it("judges each term on its own, once each", () => {
    expect(
      findHiddenSummaryTerms(visible, original, [
        "Precision",
        "六成",
        "precision",
        "independent"
      ])
    ).toEqual(["precision", "independent"]);
  });
});

describe("getSearchCardText", () => {
  it("adds a 原文摘要 excerpt for a term only the other summary has", () => {
    const text = getSearchCardText(card(), ["anomaly"]);

    expect(text.originalTitle).toBeUndefined();
    expect(text.originalSummary).toContain("anomaly");
    expect(text.originalSummary?.length ?? 0).toBeLessThanOrEqual(
      originalSummaryMaxLength
    );
    expect(text.summary).toBe(card().summary);
  });

  it("uses the 原标题 line rather than both when the title has the term", () => {
    const text = getSearchCardText(card(), ["alibaba"]);

    expect(text.originalTitle).toContain("Alibaba");
    expect(text.originalSummary).toBeUndefined();
  });

  it("uses the moved summary rather than a 原标题 line", () => {
    const text = getSearchCardText(
      card({ originalTitle: "12% 精确率 in the only test" }),
      ["精确率"]
    );

    expect(text.summary).toContain("精确率");
    expect(text.originalTitle).toBeUndefined();
    expect(text.originalSummary).toBeUndefined();
  });

  it("adds nothing for a semantic-only result", () => {
    expect(getSearchCardText(card(), [])).toEqual({
      summary: card().summary,
      originalTitle: undefined,
      originalSummary: undefined
    });
  });

  it("adds nothing when every term is already visible", () => {
    const text = getSearchCardText(card(), ["代码评审"]);

    expect(text.originalTitle).toBeUndefined();
    expect(text.originalSummary).toBeUndefined();
    expect(text.summary).toBe(card().summary);
  });
});

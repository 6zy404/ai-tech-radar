import { describe, expect, it } from "vitest";

import {
  CHINESE_CHARACTERS_PER_MINUTE,
  ENGLISH_WORDS_PER_MINUTE,
  countReadingUnits,
  estimateReadingMinutes,
  formatReadingTime
} from "@/lib/reading-time";

describe("countReadingUnits", () => {
  it("counts Chinese per character and skips punctuation", () => {
    expect(countReadingUnits("模型发布了，值得关注。")).toEqual({
      chineseCharacters: 9,
      englishWords: 0
    });
  });

  it("counts English per word", () => {
    expect(countReadingUnits("The model ships today, with tools.")).toEqual({
      chineseCharacters: 0,
      englishWords: 6
    });
  });

  it("counts a version string or a contraction as one word", () => {
    expect(
      countReadingUnits("Ollama v0.32.5 doesn't break open-source")
    ).toEqual({ chineseCharacters: 0, englishWords: 5 });
  });

  it("counts the two languages separately in mixed text", () => {
    expect(countReadingUnits("DeepSeek 发布了 V4 模型")).toEqual({
      chineseCharacters: 5,
      englishWords: 2
    });
  });
});

describe("estimateReadingMinutes", () => {
  it("times a pure Chinese body at the Chinese speed", () => {
    const body = "字".repeat(CHINESE_CHARACTERS_PER_MINUTE * 2);

    expect(estimateReadingMinutes(body)).toBe(2);
  });

  it("times a pure English body at the English speed", () => {
    const body = Array(ENGLISH_WORDS_PER_MINUTE * 3)
      .fill("word")
      .join(" ");

    expect(estimateReadingMinutes(body)).toBe(3);
  });

  it("adds the two languages before rounding up", () => {
    // 0.4 minutes of each is 0.8 → 1. Rounding each language up on its own
    // would have given 1 + 1 = 2.
    const chinese = "字".repeat(CHINESE_CHARACTERS_PER_MINUTE * 0.4);
    const english = Array(ENGLISH_WORDS_PER_MINUTE * 0.4)
      .fill("word")
      .join(" ");

    expect(estimateReadingMinutes(`${chinese}\n\n${english}`)).toBe(1);
    expect(
      estimateReadingMinutes(`${chinese}${chinese}\n\n${english} ${english}`)
    ).toBe(2);
  });

  it("rounds a partial minute up", () => {
    const body = "字".repeat(CHINESE_CHARACTERS_PER_MINUTE + 1);

    expect(estimateReadingMinutes(body)).toBe(2);
  });

  it("never reports less than a minute, even for an empty page", () => {
    expect(estimateReadingMinutes("")).toBe(1);
    expect(estimateReadingMinutes("", ["", "   "])).toBe(1);
  });

  it("includes the plain texts shown beside the body", () => {
    const half = "字".repeat(CHINESE_CHARACTERS_PER_MINUTE / 2 + 1);

    expect(estimateReadingMinutes(half)).toBe(1);
    expect(estimateReadingMinutes(half, [half])).toBe(2);
  });

  it("does not count Markdown markers or list numbers", () => {
    const body = [
      "## 要点",
      "",
      "**加粗**的 `code` 词",
      "",
      "1. 第一",
      "2. 第二",
      "- 其一",
      "* 其二"
    ].join("\n");

    // 要点 加粗的 词 第一 第二 其一 其二 = 14 characters, plus `code` = 1 word.
    // Counted raw, the "1." and "2." list numbers would add two words.
    const words = Array(ENGLISH_WORDS_PER_MINUTE - 1)
      .fill("word")
      .join(" ");
    const chineseToFill = "字".repeat(CHINESE_CHARACTERS_PER_MINUTE - 14);

    // Exactly one minute of Chinese plus 200 words is two minutes; one stray
    // counted marker would push it over into three.
    expect(estimateReadingMinutes(body, [chineseToFill, words])).toBe(2);
  });
});

describe("formatReadingTime", () => {
  it("reads in the page's current language", () => {
    expect(formatReadingTime(3, "zh")).toBe("约 3 分钟读完");
    expect(formatReadingTime(3, "original")).toBe("About 3 min read");
  });
});

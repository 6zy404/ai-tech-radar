import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canDrawText, readFontCodePoints } from "@/lib/font-cmap";

const subset = readFontCodePoints(
  readFileSync(
    join(process.cwd(), "assets/fonts/NotoSerifSC-Bold.share-card.otf")
  )
);

describe("readFontCodePoints", () => {
  it("reads the share-card subset's character count", () => {
    // assets/fonts/README.md: 3,896 characters.
    expect(subset.size).toBe(3896);
  });

  it("has common Chinese, ASCII and CJK punctuation, not rare characters", () => {
    for (const char of "技术简报AZaz09，。「」—") {
      expect(subset.has(char.codePointAt(0)!)).toBe(true);
    }
    for (const char of "龘靐齉") {
      expect(subset.has(char.codePointAt(0)!)).toBe(false);
    }
  });

  it("returns nothing for bytes without a cmap table", () => {
    expect(readFontCodePoints(new Uint8Array(12)).size).toBe(0);
  });
});

describe("canDrawText", () => {
  it("ignores whitespace and fails on any character outside the font", () => {
    expect(canDrawText(subset, "技术简报 - 2026-09-28")).toBe(true);
    expect(canDrawText(subset, "这期讲的是龘。")).toBe(false);
  });
});

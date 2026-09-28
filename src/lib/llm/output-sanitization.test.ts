import { describe, expect, it } from "vitest";

import {
  sanitizeStringArray,
  truncateText
} from "@/lib/llm/output-sanitization";

describe("truncateText", () => {
  it("leaves text at or under the cap unchanged, apart from whitespace", () => {
    expect(truncateText("  a   b\n c ", 5)).toBe("a b c");
    expect(truncateText("abcde", 5)).toBe("abcde");
  });

  it("never returns more than maxLength characters, ellipsis included", () => {
    const long = "很长".repeat(300);

    for (const maxLength of [4, 5, 10, 80, 420, 599]) {
      const result = truncateText(long, maxLength);

      expect(result.length).toBe(maxLength);
      expect(result.endsWith("...")).toBe(true);
    }
  });

  it("cuts one character past the cap down to exactly the cap", () => {
    expect(truncateText("abcdef", 5)).toBe("ab...");
  });

  it("cuts without an ellipsis when the cap cannot hold one", () => {
    expect(truncateText("abcdef", 3)).toBe("abc");
    expect(truncateText("abcdef", 1)).toBe("a");
    expect(truncateText("abcdef", 0)).toBe("");
    expect(truncateText("abcdef", -2)).toBe("");
  });

  it("does not count whitespace trimmed at the cut against the result", () => {
    // The slice ends on a space, which is trimmed before the ellipsis.
    expect(truncateText("abcd efgh", 8)).toBe("abcd...");
  });
});

describe("sanitizeStringArray", () => {
  it("applies the per-item cap exactly", () => {
    const items = sanitizeStringArray(["x".repeat(500), "short"], 6, 80);

    expect(items?.[0]).toHaveLength(80);
    expect(items?.[1]).toBe("short");
  });
});

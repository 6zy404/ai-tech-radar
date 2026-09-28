import { describe, expect, it } from "vitest";

import {
  highlightSearchTerms,
  type HighlightSegment
} from "@/lib/search-highlight";

/** Render segments as `a[b]c` so expectations read at a glance. */
function render(segments: HighlightSegment[]): string {
  return segments
    .map((segment) => (segment.match ? `[${segment.text}]` : segment.text))
    .join("");
}

describe("highlightSearchTerms", () => {
  it("marks every occurrence of a term, case-insensitively", () => {
    expect(
      render(highlightSearchTerms("Agent SDK for agents", ["agent"]))
    ).toBe("[Agent] SDK for [agent]s");
  });

  it("keeps the original casing of the matched text", () => {
    const segments = highlightSearchTerms("OpenAI AGENTS", ["Agents"]);

    expect(segments).toEqual([
      { text: "OpenAI ", match: false },
      { text: "AGENTS", match: true }
    ]);
  });

  it("marks each of several space-separated terms", () => {
    expect(
      render(highlightSearchTerms("小模型的推理成本下降", ["模型", "推理"]))
    ).toBe("小[模型]的[推理]成本下降");
  });

  it("matches Chinese and latin terms in the same text", () => {
    expect(
      render(
        highlightSearchTerms("MCP 2.0 让 Agent 调用工具", ["agent", "工具"])
      )
    ).toBe("MCP 2.0 让 [Agent] 调用[工具]");
  });

  it("merges overlapping terms into one segment", () => {
    expect(render(highlightSearchTerms("agentic", ["agent", "age"]))).toBe(
      "[agent]ic"
    );
    expect(render(highlightSearchTerms("abcdef", ["abcd", "cdef"]))).toBe(
      "[abcdef]"
    );
  });

  it("merges touching terms instead of splitting them", () => {
    const segments = highlightSearchTerms("大模型推理", ["模型", "推理"]);

    expect(segments).toEqual([
      { text: "大", match: false },
      { text: "模型推理", match: true }
    ]);
  });

  it("handles overlapping occurrences of the same term", () => {
    expect(render(highlightSearchTerms("aaaa", ["aa"]))).toBe("[aaaa]");
  });

  it("treats regex metacharacters as plain text", () => {
    expect(render(highlightSearchTerms("C++ (v2.0) a.b", ["c++"]))).toBe(
      "[C++] (v2.0) a.b"
    );
    expect(render(highlightSearchTerms("C++ (v2.0) a.b", ["(v2.0)"]))).toBe(
      "C++ [(v2.0)] a.b"
    );
    expect(render(highlightSearchTerms("a.b axb", [".", "*"]))).toBe(
      "a[.]b axb"
    );
  });

  it("returns the text unmarked for an empty or blank query", () => {
    expect(highlightSearchTerms("推理模型", [])).toEqual([
      { text: "推理模型", match: false }
    ]);
    expect(highlightSearchTerms("推理模型", ["", "  "])).toEqual([
      { text: "推理模型", match: false }
    ]);
  });

  it("returns the text unmarked when nothing matches", () => {
    expect(highlightSearchTerms("检索流水线", ["agent"])).toEqual([
      { text: "检索流水线", match: false }
    ]);
  });

  it("returns no segments for empty text", () => {
    expect(highlightSearchTerms("", ["agent"])).toEqual([]);
  });

  it("keeps offsets right after a character whose lower case is longer", () => {
    // "İ".toLowerCase() is two code units; a naive index into the lowered
    // string would shift the mark one character left.
    expect(render(highlightSearchTerms("İstanbul agent", ["agent"]))).toBe(
      "İstanbul [agent]"
    );
  });

  it("keeps astral characters whole", () => {
    expect(render(highlightSearchTerms("𝐀 agent 𝐀", ["agent"]))).toBe(
      "𝐀 [agent] 𝐀"
    );
  });

  it("concatenates back to exactly the input", () => {
    const text = "Agent 与 agent：大模型推理（Reasoning）";
    const segments = highlightSearchTerms(text, ["agent", "推理", "reason"]);

    expect(segments.map((segment) => segment.text).join("")).toBe(text);
  });
});

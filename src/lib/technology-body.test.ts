import { describe, expect, it } from "vitest";

import {
  parseTechnologyBody,
  splitTechnologyBodyInline
} from "@/lib/technology-body";

describe("parseTechnologyBody", () => {
  it("reads a plain paragraph body as one paragraph per blank-line group", () => {
    const blocks = parseTechnologyBody("第一段。\n\n第二段。");

    expect(blocks).toEqual([
      { kind: "paragraph", text: "第一段。" },
      { kind: "paragraph", text: "第二段。" }
    ]);
  });

  it("joins wrapped lines into a single paragraph", () => {
    const blocks = parseTechnologyBody("前半句，\n后半句。");

    expect(blocks).toEqual([{ kind: "paragraph", text: "前半句，后半句。" }]);
  });

  it("recognizes level-two headings only", () => {
    const blocks = parseTechnologyBody(
      "## 三条改动\n\n### 不是标题\n\n# 也不是"
    );

    expect(blocks).toEqual([
      { kind: "heading", text: "三条改动" },
      { kind: "paragraph", text: "### 不是标题" },
      { kind: "paragraph", text: "# 也不是" }
    ]);
  });

  it("groups consecutive list items and keeps the marker kind", () => {
    const blocks = parseTechnologyBody("1. 第一条\n2. 第二条");

    expect(blocks).toEqual([
      { kind: "list", ordered: true, items: ["第一条", "第二条"] }
    ]);
  });

  it("starts a new list when the marker kind changes", () => {
    const blocks = parseTechnologyBody("1. 有序\n- 无序");

    expect(blocks).toEqual([
      { kind: "list", ordered: true, items: ["有序"] },
      { kind: "list", ordered: false, items: ["无序"] }
    ]);
  });

  it("closes an open paragraph before a list starts", () => {
    const blocks = parseTechnologyBody("引导句：\n1. 第一条");

    expect(blocks).toEqual([
      { kind: "paragraph", text: "引导句：" },
      { kind: "list", ordered: true, items: ["第一条"] }
    ]);
  });

  it("closes an open list before a following paragraph", () => {
    const blocks = parseTechnologyBody("- 一条\n收尾句。");

    expect(blocks).toEqual([
      { kind: "list", ordered: false, items: ["一条"] },
      { kind: "paragraph", text: "收尾句。" }
    ]);
  });

  it("does not emit a list block that reuses a flushed item array", () => {
    const blocks = parseTechnologyBody("- 一\n\n- 二");

    expect(blocks).toEqual([
      { kind: "list", ordered: false, items: ["一"] },
      { kind: "list", ordered: false, items: ["二"] }
    ]);
  });

  it("returns no blocks for an empty or whitespace-only body", () => {
    expect(parseTechnologyBody("")).toEqual([]);
    expect(parseTechnologyBody("   \n\n  ")).toEqual([]);
  });
});

describe("splitTechnologyBodyInline", () => {
  it("splits bold runs out of surrounding text", () => {
    expect(splitTechnologyBodyInline("前 **重点** 后")).toEqual([
      { text: "前 ", strong: false },
      { text: "重点", strong: true },
      { text: " 后", strong: false }
    ]);
  });

  it("leaves text with no markers as a single plain segment", () => {
    expect(splitTechnologyBodyInline("没有标记")).toEqual([
      { text: "没有标记", strong: false }
    ]);
  });

  it("drops the empty segments a leading marker would produce", () => {
    expect(splitTechnologyBodyInline("**开头加粗**")).toEqual([
      { text: "开头加粗", strong: true }
    ]);
  });
});

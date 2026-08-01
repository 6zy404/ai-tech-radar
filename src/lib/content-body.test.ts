import { describe, expect, it } from "vitest";

import { parseContentBody, splitContentBodyInline } from "@/lib/content-body";

describe("parseContentBody", () => {
  it("reads a plain paragraph body as one paragraph per blank-line group", () => {
    const blocks = parseContentBody("第一段。\n\n第二段。");

    expect(blocks).toEqual([
      { kind: "paragraph", text: "第一段。" },
      { kind: "paragraph", text: "第二段。" }
    ]);
  });

  it("joins wrapped lines into a single paragraph", () => {
    const blocks = parseContentBody("前半句，\n后半句。");

    expect(blocks).toEqual([{ kind: "paragraph", text: "前半句，后半句。" }]);
  });

  it("recognizes level-two headings only", () => {
    const blocks = parseContentBody("## 三条改动\n\n### 不是标题\n\n# 也不是");

    expect(blocks).toEqual([
      { kind: "heading", text: "三条改动" },
      { kind: "paragraph", text: "### 不是标题" },
      { kind: "paragraph", text: "# 也不是" }
    ]);
  });

  it("groups consecutive list items and keeps the marker kind", () => {
    const blocks = parseContentBody("1. 第一条\n2. 第二条");

    expect(blocks).toEqual([
      { kind: "list", ordered: true, items: ["第一条", "第二条"] }
    ]);
  });

  it("starts a new list when the marker kind changes", () => {
    const blocks = parseContentBody("1. 有序\n- 无序");

    expect(blocks).toEqual([
      { kind: "list", ordered: true, items: ["有序"] },
      { kind: "list", ordered: false, items: ["无序"] }
    ]);
  });

  it("closes an open paragraph before a list starts", () => {
    const blocks = parseContentBody("引导句：\n1. 第一条");

    expect(blocks).toEqual([
      { kind: "paragraph", text: "引导句：" },
      { kind: "list", ordered: true, items: ["第一条"] }
    ]);
  });

  it("closes an open list before a following paragraph", () => {
    const blocks = parseContentBody("- 一条\n收尾句。");

    expect(blocks).toEqual([
      { kind: "list", ordered: false, items: ["一条"] },
      { kind: "paragraph", text: "收尾句。" }
    ]);
  });

  it("does not emit a list block that reuses a flushed item array", () => {
    const blocks = parseContentBody("- 一\n\n- 二");

    expect(blocks).toEqual([
      { kind: "list", ordered: false, items: ["一"] },
      { kind: "list", ordered: false, items: ["二"] }
    ]);
  });

  it("returns no blocks for an empty or whitespace-only body", () => {
    expect(parseContentBody("")).toEqual([]);
    expect(parseContentBody("   \n\n  ")).toEqual([]);
  });
});

describe("splitContentBodyInline", () => {
  it("splits bold runs out of surrounding text", () => {
    expect(splitContentBodyInline("前 **重点** 后")).toEqual([
      { text: "前 ", kind: "text" },
      { text: "重点", kind: "strong" },
      { text: " 后", kind: "text" }
    ]);
  });

  it("leaves text with no markers as a single plain segment", () => {
    expect(splitContentBodyInline("没有标记")).toEqual([
      { text: "没有标记", kind: "text" }
    ]);
  });

  it("drops the empty segments a leading marker would produce", () => {
    expect(splitContentBodyInline("**开头加粗**")).toEqual([
      { text: "开头加粗", kind: "strong" }
    ]);
  });

  it("splits inline code out of surrounding text", () => {
    expect(splitContentBodyInline("调用 `server/discover` 即可")).toEqual([
      { text: "调用 ", kind: "text" },
      { text: "server/discover", kind: "code" },
      { text: " 即可", kind: "text" }
    ]);
  });

  it("handles bold and code in the same line", () => {
    expect(splitContentBodyInline("**握手**没了：`initialize`")).toEqual([
      { text: "握手", kind: "strong" },
      { text: "没了：", kind: "text" },
      { text: "initialize", kind: "code" }
    ]);
  });

  it("keeps a lone backtick as plain text", () => {
    expect(splitContentBodyInline("价格是 5` 每米")).toEqual([
      { text: "价格是 5` 每米", kind: "text" }
    ]);
  });

  it("keeps an empty pair as plain text rather than an empty code run", () => {
    expect(splitContentBodyInline("空 `` 对")).toEqual([
      { text: "空 `` 对", kind: "text" }
    ]);
  });

  it("does not treat a run of asterisks as bold", () => {
    expect(splitContentBodyInline("**** 分隔")).toEqual([
      { text: "**** 分隔", kind: "text" }
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { planBoilerplateOriginalRepair } from "./boilerplate-original-repair";
import { makeWorkspaceRecord } from "./test-factories";

const infoqLink =
  "<div align='right'><a href='https://www.infoq.cn/article/x?utm_source=rss&utm_medium=article'>点击查看原文></a></div>";

describe("planBoilerplateOriginalRepair", () => {
  it("copies zh over a boilerplate-only original, raw or cleaned", () => {
    const record = makeWorkspaceRecord({
      slug: "infoq-signal",
      title: { original: "真标题", zh: "编辑标题" },
      summary: { original: infoqLink, zh: "中文摘要" },
      content: { original: "点击查看原文>", zh: "## 正文\n\n中文正文" }
    });

    const { next, changes, skipped } = planBoilerplateOriginalRepair([record]);

    expect(next[0].summary).toEqual({ original: "中文摘要", zh: "中文摘要" });
    expect(next[0].content).toEqual({
      original: "## 正文\n\n中文正文",
      zh: "## 正文\n\n中文正文"
    });
    expect(next[0].title).toBe(record.title);
    expect(changes.map((change) => change.field)).toEqual([
      "summary",
      "content"
    ]);
    expect(skipped).toEqual([]);
  });

  it("leaves real original text alone, including text followed by the link", () => {
    const record = makeWorkspaceRecord({
      summary: { original: "Amazon 开源 Kiro Crew。", zh: "中文摘要" },
      content: { original: `<p>Real body.</p>${infoqLink}`, zh: "中文正文" }
    });

    const { next, changes } = planBoilerplateOriginalRepair([record]);

    expect(changes).toEqual([]);
    expect(next[0]).toBe(record);
  });

  it("skips a boilerplate original whose zh is empty instead of emptying it", () => {
    const record = makeWorkspaceRecord({
      slug: "no-zh",
      content: { original: infoqLink, zh: "  " }
    });

    const { next, changes, skipped } = planBoilerplateOriginalRepair([record]);

    expect(changes).toEqual([]);
    expect(next[0].content.original).toBe(infoqLink);
    expect(skipped).toEqual([
      { slug: "no-zh", field: "content", reason: "中文字段为空" }
    ]);
  });

  it("finds nothing on a second run", () => {
    const record = makeWorkspaceRecord({
      summary: { original: infoqLink, zh: "中文摘要" },
      content: { original: infoqLink, zh: "中文正文" }
    });
    const first = planBoilerplateOriginalRepair([record]);

    expect(first.changes).toHaveLength(2);
    expect(planBoilerplateOriginalRepair(first.next).changes).toEqual([]);
  });
});

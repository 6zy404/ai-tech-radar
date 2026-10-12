import { describe, expect, it } from "vitest";

import { technologyItems } from "@/data/technologies";
import type { KnowledgeLinkTarget } from "@/lib/knowledge-autolink";
import {
  excerptMention,
  findBodyMentions,
  getKnowledgeMentions
} from "@/lib/knowledge-mentions";
import type { TechnologyItem } from "@/types/content";

const kv: KnowledgeLinkTarget = {
  id: "k-kv",
  href: "/knowledge/kv",
  title: "KV 缓存与长上下文推理",
  aliases: ["KV 缓存", "长上下文"]
};
const ft: KnowledgeLinkTarget = {
  id: "k-ft",
  href: "/knowledge/ft",
  title: "监督微调",
  aliases: ["微调", "LoRA"],
  except: ["提示词微调"]
};
const targets = [kv, ft];

function signal(
  id: string,
  publishDate: string,
  zh: string,
  overrides: Partial<TechnologyItem> = {}
): TechnologyItem {
  const base = technologyItems[0];
  return {
    ...base,
    id,
    slug: id,
    status: "published",
    publishDate,
    sourceLanguage: "en",
    title: { original: `Title ${id}`, zh: `标题 ${id}` },
    content: { original: "Nothing relevant here.", zh },
    ...overrides
  };
}

describe("findBodyMentions", () => {
  it("finds what the signal page links, with its run and offsets", () => {
    const mentions = findBodyMentions(
      "## KV 缓存\n\n先讲背景。这次加了 **KV 缓存** 复用，也支持 LoRA。",
      targets
    );
    const kvMention = mentions.get("k-kv");
    expect(kvMention?.run).toBe(
      "先讲背景。这次加了 KV 缓存 复用，也支持 LoRA。"
    );
    expect(kvMention?.run.slice(kvMention.start, kvMention.end)).toBe(
      "KV 缓存"
    );
    expect(
      mentions
        .get("k-ft")
        ?.run.slice(mentions.get("k-ft")!.start, mentions.get("k-ft")!.end)
    ).toBe("LoRA");
  });

  it("skips headings and inline code, as ContentBody does", () => {
    const mentions = findBodyMentions(
      "## 微调\n\n命令是 `LoRA` 参数。",
      targets
    );
    expect(mentions.has("k-ft")).toBe(false);
  });

  it("honours except phrases", () => {
    expect(findBodyMentions("这是提示词微调。", targets).has("k-ft")).toBe(
      false
    );
  });

  it("reads list items", () => {
    const mention = findBodyMentions("- 第一项\n- 支持长上下文", targets).get(
      "k-kv"
    );
    expect(mention?.run).toBe("支持长上下文");
  });
});

describe("excerptMention", () => {
  it("keeps a short run whole and splits out the phrase", () => {
    const run = "这次加了 KV 缓存复用。";
    expect(excerptMention({ run, start: 5, end: 10 })).toEqual({
      before: "这次加了 ",
      match: "KV 缓存",
      after: "复用。"
    });
  });

  it("cuts a long run to the limit around the mention", () => {
    const run = `${"前文很长，".repeat(30)}这里提到长上下文推理，${"后文也很长，".repeat(30)}`;
    const start = run.indexOf("长上下文");
    const excerpt = excerptMention({ run, start, end: start + 4 }, 80);
    const text = excerpt.before + excerpt.match + excerpt.after;
    expect(excerpt.match).toBe("长上下文");
    expect(text.length).toBeLessThanOrEqual(80);
    expect(text.startsWith("…")).toBe(true);
    expect(text.endsWith("…")).toBe(true);
  });

  it("bolds the linked occurrence, not an earlier unlinked one", () => {
    const run = `提示词微调不算。${"中间隔开很多字，".repeat(15)}这里才是微调。`;
    const start = run.lastIndexOf("微调");
    const excerpt = excerptMention({ run, start, end: start + 2 }, 40);
    expect(excerpt.match).toBe("微调");
    expect(excerpt.after).toBe("。");
    expect(excerpt.before.startsWith("…")).toBe(true);
  });
});

describe("getKnowledgeMentions", () => {
  const technologies = [
    signal("old", "2026-07-01", "早先也谈到长上下文。"),
    signal("new", "2026-10-01", "新版本扩展了 KV 缓存。"),
    signal("none", "2026-09-01", "只讲提示词微调。"),
    signal("kept", "2026-08-01", "KV 缓存是这里的重点。"),
    signal("draft", "2026-10-02", "草稿里也有 KV 缓存。", { status: "draft" })
  ];

  it("lists mentioning signals newest first, skipping the excluded and drafts", () => {
    const rows = getKnowledgeMentions("k-kv", technologies, targets, ["kept"]);
    expect(rows.map((row) => row.id)).toEqual(["new", "old"]);
    expect(rows[0]).toMatchObject({
      slug: "new",
      title: "标题 new",
      publishDate: "2026-10-01",
      excerpt: { before: "新版本扩展了 ", match: "KV 缓存", after: "。" }
    });
  });

  it("reads the Chinese body, not the original", () => {
    const english = signal("en", "2026-10-03", "没有提到。", {
      content: { original: "KV 缓存 in the original only.", zh: "没有提到。" }
    });
    expect(getKnowledgeMentions("k-kv", [english], targets)).toEqual([]);
  });

  it("returns nothing for an id with no target", () => {
    expect(getKnowledgeMentions("k-missing", technologies, targets)).toEqual(
      []
    );
  });
});

import { describe, expect, it } from "vitest";

import { knowledgeItems } from "@/data/knowledge";
import {
  buildKnowledgeLinkTargets,
  createKnowledgeLinker,
  knowledgeAliases,
  selectKnowledgeLinkTargets,
  type KnowledgeLinkPiece,
  type KnowledgeLinkTarget
} from "@/lib/knowledge-autolink";

const kv: KnowledgeLinkTarget = {
  id: "k-kv",
  href: "/knowledge/kv",
  title: "KV 缓存与长上下文推理",
  aliases: ["KV 缓存", "KV cache", "长上下文"]
};
const ft: KnowledgeLinkTarget = {
  id: "k-ft",
  href: "/knowledge/ft",
  title: "监督微调",
  aliases: ["微调", "LoRA", "fine tuning"],
  except: ["提示词微调"]
};
const moe: KnowledgeLinkTarget = {
  id: "k-moe",
  href: "/knowledge/moe",
  title: "MoE",
  aliases: ["MoE"]
};
const swe: KnowledgeLinkTarget = {
  id: "k-swe",
  href: "/knowledge/swe",
  title: "代码评测",
  aliases: ["SWE-bench", "SWE-bench Pro"]
};

function linked(pieces: KnowledgeLinkPiece[]): string[] {
  return pieces.filter((piece) => piece.link).map((piece) => piece.text);
}

describe("createKnowledgeLinker", () => {
  it("links the first mention and leaves the rest as text", () => {
    const link = createKnowledgeLinker([kv]);
    const pieces = link("分块 KV 缓存压缩，再说一次 KV 缓存。");

    expect(pieces).toEqual([
      { text: "分块 " },
      { text: "KV 缓存", link: { href: "/knowledge/kv", title: kv.title } },
      { text: "压缩，再说一次 KV 缓存。" }
    ]);
  });

  it("remembers across calls, so an item links once per body", () => {
    const link = createKnowledgeLinker([kv]);

    expect(linked(link("第一段讲 KV 缓存。"))).toEqual(["KV 缓存"]);
    // Another alias of the same item is not a second chance.
    expect(linked(link("第二段讲长上下文。"))).toEqual([]);
  });

  it("links each item at its own first mention", () => {
    const link = createKnowledgeLinker([kv, ft]);

    expect(linked(link("LoRA 微调之后，长上下文表现下降。"))).toEqual([
      "LoRA",
      "长上下文"
    ]);
  });

  it("matches latin aliases as whole words, case-insensitively", () => {
    expect(linked(createKnowledgeLinker([moe])("MoEs and MoEBench"))).toEqual(
      []
    );
    expect(linked(createKnowledgeLinker([moe])("a moe model"))).toEqual([
      "moe"
    ]);
    expect(linked(createKnowledgeLinker([moe])("一个MoE模型"))).toEqual([
      "MoE"
    ]);
    // A hyphen is an edge: "MoE-based" still names the concept.
    expect(linked(createKnowledgeLinker([moe])("MoE-based"))).toEqual(["MoE"]);
  });

  it("lets a space in an alias match a hyphen or nothing", () => {
    expect(linked(createKnowledgeLinker([kv])("分块KV缓存"))).toEqual([
      "KV缓存"
    ]);
    expect(linked(createKnowledgeLinker([kv])("Chunked KV-Cache"))).toEqual([
      "KV-Cache"
    ]);
    expect(linked(createKnowledgeLinker([ft])("after fine-tuning"))).toEqual([
      "fine-tuning"
    ]);
  });

  it("prefers the longer of two aliases starting at the same place", () => {
    expect(linked(createKnowledgeLinker([swe])("SWE-bench Pro 54.2"))).toEqual([
      "SWE-bench Pro"
    ]);
  });

  it("cancels a match an except phrase covers", () => {
    const link = createKnowledgeLinker([ft]);

    expect(linked(link("每次提示词微调都会漂移"))).toEqual([]);
    // The exception did not use up the item's one link.
    expect(linked(link("从 Qwen 微调而来"))).toEqual(["微调"]);
  });

  it("returns the text untouched when nothing matches", () => {
    expect(createKnowledgeLinker([kv, ft])("无关的一句话")).toEqual([
      { text: "无关的一句话" }
    ]);
  });
});

describe("buildKnowledgeLinkTargets", () => {
  it("adds the title, and skips items without an alias entry", () => {
    const targets = buildKnowledgeLinkTargets(
      [
        { id: "a", slug: "a-slug", title: "甲概念" },
        { id: "b", slug: "b-slug", title: "乙概念" }
      ],
      { a: { aliases: ["甲"], except: ["甲乙"] } }
    );

    expect(targets).toEqual([
      {
        id: "a",
        href: "/knowledge/a-slug",
        title: "甲概念",
        aliases: ["甲概念", "甲"],
        except: ["甲乙"]
      }
    ]);
  });
});

describe("selectKnowledgeLinkTargets", () => {
  it("keeps only targets mentioned in some language of the body", () => {
    expect(
      selectKnowledgeLinkTargets([kv, ft, moe], ["chunked KV cache", "无关"])
    ).toEqual([kv]);
  });

  it("does not count a mention an except phrase cancels", () => {
    expect(selectKnowledgeLinkTargets([ft], ["提示词微调"])).toEqual([]);
  });
});

describe("knowledgeAliases", () => {
  const entries = Object.entries(knowledgeAliases);

  it("covers every bundled knowledge seed", () => {
    for (const item of knowledgeItems) {
      expect(knowledgeAliases[item.id], item.id).toBeDefined();
    }
  });

  it("keeps latin aliases at three characters or more", () => {
    for (const [id, entry] of entries) {
      for (const alias of entry.aliases) {
        if (/^[\x20-\x7e]+$/.test(alias)) {
          expect(
            alias.replace(/\s/g, "").length,
            `${id}: ${alias}`
          ).toBeGreaterThanOrEqual(3);
        } else {
          expect(alias.length, `${id}: ${alias}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("never gives one alias to two items", () => {
    const owners = new Map<string, string>();
    for (const [id, entry] of entries) {
      for (const alias of entry.aliases) {
        const key = alias.toLowerCase().replace(/[\s-]/g, "");
        expect(owners.get(key), `${alias} on ${id}`).toBeUndefined();
        owners.set(key, id);
      }
    }
  });
});

// Links the first mention of a knowledge concept in a signal body to its
// /knowledge page (2026-10-12).
//
// Pure, and imported by the client signal page, so it reads no store: the
// signal page passes in the published knowledge items it already has and only
// the targets its body actually mentions travel to the browser.
//
// Rules, each pinned by a test:
// - a knowledge item links once per body, at its first mention in reading
//   order; different items each get their own first link;
// - headings and inline code never link (ContentBody simply does not ask);
// - latin edges match whole words only, case-insensitively, so `MoE` does not
//   fire inside `MoEs` and `distillation` not inside `distillations`;
// - a space in an alias also matches a hyphen or nothing (`KV 缓存` matches
//   `KV缓存`, `fine tuning` matches `fine-tuning`);
// - where two aliases overlap, the earlier one wins, and of two starting at
//   the same place the longer one (`SWE-bench Pro` over `SWE-bench`);
// - an `except` phrase covering a match cancels it — Chinese has no word
//   edges, so the false hits that remain are named rather than guessed at
//   (`微调` is fine-tuning, `提示词微调` is not).
//
// Aliases are written by hand. Bare words too general to mean the concept
// (`复现 bug`, `选型`) are left out on purpose: a missing link costs nothing,
// a wrong one teaches the reader something false.

export interface KnowledgeAliasEntry {
  aliases: string[];
  except?: string[];
}

/** Knowledge id → the phrases a signal body uses for it. The title is added. */
export const knowledgeAliases: Record<string, KnowledgeAliasEntry> = {
  // The eight entries added on 2026-10-12 (scripts/add-knowledge-items.ts).
  "knowledge-kv-cache": {
    aliases: [
      "KV 缓存",
      "KV cache",
      "前缀缓存",
      "prefix cache",
      "prefix caching",
      "预填充",
      "prefill",
      "PagedAttention",
      "长上下文",
      "long context",
      "上下文窗口",
      "context window"
    ]
  },
  "knowledge-rl-post-training": {
    aliases: [
      "强化学习",
      "reinforcement learning",
      "可验证奖励",
      "verifiable rewards",
      "RLVR",
      "GRPO",
      "奖励模型",
      "reward model",
      "奖励投机",
      "reward hacking"
    ]
  },
  "knowledge-distillation": {
    aliases: ["知识蒸馏", "蒸馏", "distillation"],
    // 「从历史轨迹里蒸馏出行为指引」 is a metaphor, not model distillation.
    except: ["蒸馏出"]
  },
  "knowledge-fine-tuning": {
    aliases: [
      "监督微调",
      "微调",
      "SFT",
      "LoRA",
      "PEFT",
      "fine tuning",
      "fine tune",
      "fine tuned"
    ],
    except: ["提示词微调", "提示微调"]
  },
  "knowledge-agent-sandboxing": {
    aliases: [
      "沙箱",
      "沙盒",
      "sandbox",
      "sandboxes",
      "sandboxing",
      "微虚拟机",
      "microVM"
    ],
    // A wiki's sandbox page is a page, not an isolation boundary.
    except: ["沙盒页"]
  },
  "knowledge-open-weights": {
    aliases: ["开放权重", "开源权重", "开源模型", "open weight", "open weights"]
  },
  "knowledge-execution-based-eval": {
    aliases: [
      "SWE-bench",
      "SWE-bench Pro",
      "Terminal-Bench",
      "pass@k",
      "pass^k"
    ]
  },
  "knowledge-reproducibility": {
    aliases: [
      "可复现",
      "复现审计",
      "reproducibility",
      "reproducible",
      "Lean 证明",
      "Lean 验证",
      "形式化证明",
      "formal proof"
    ]
  },

  // The entries that existed before.
  "knowledge-api-contracts": {
    aliases: ["API 契约", "接口契约", "API contract", "API contracts"]
  },
  "knowledge-tool-use": {
    aliases: [
      "工具调用",
      "函数调用",
      "function calling",
      "tool calling",
      "tool use"
    ]
  },
  "knowledge-rag-basics": {
    aliases: [
      "检索增强生成",
      "检索增强",
      "RAG",
      "retrieval augmented generation"
    ]
  },
  "knowledge-evaluation-loops": {
    aliases: ["评估闭环", "评测闭环", "evaluation loop"]
  },
  "knowledge-system-design": {
    aliases: ["系统设计", "system design"]
  },
  "knowledge-human-loop": {
    aliases: ["人在回路", "human in the loop", "HITL"]
  },
  "knowledge-graph-thinking": {
    aliases: ["知识图谱", "knowledge graph"]
  },
  "knowledge-model-sizing": {
    aliases: ["模型选型"]
  },
  "knowledge-latency-tradeoffs": {
    aliases: ["首 token 延迟", "首字延迟", "time to first token", "TTFT"]
  },
  "knowledge-feedback-loops": {
    aliases: ["反馈闭环", "feedback loop"]
  },
  // 合成数据与数据配方
  "knowledge-ws-818b7bb3": {
    aliases: ["合成数据", "synthetic data", "数据配方"]
  },
  // 对抗性评估与红队方法
  "knowledge-ws-89b98df3": {
    aliases: ["红队", "red team", "red teaming", "对抗性评估"]
  },
  // 混合专家模型（MoE）架构
  "knowledge-ws-36346103": {
    aliases: ["混合专家", "MoE", "mixture of experts"]
  },
  // 模型量化与数值精度
  "knowledge-ws-34da6116": {
    aliases: ["量化", "quantization", "quantized"],
    // 「可以量化」 means measurable; 乘积量化 is vector compression in search.
    except: ["可量化", "可以量化", "量化指标", "量化评测", "乘积量化"]
  },
  // 推测解码与推理加速技术
  "knowledge-ws-68963f7f": {
    aliases: ["推测解码", "投机解码", "speculative decoding"]
  },
  // 完成判定与验收信号
  "knowledge-ws-e251051e": {
    aliases: ["完成判定", "验收信号", "验收标准"]
  },
  // 副语言信号与语音交互
  "knowledge-ws-8c99b19c": {
    aliases: ["副语言", "paralinguistic"]
  },
  // 本地与云混合推理架构
  "knowledge-ws-c761533e": {
    aliases: ["端云协同", "端云混合", "本地与云混合"]
  },
  // 长时程智能体的记忆与上下文管理
  "knowledge-ws-a28a8a56": {
    aliases: [
      "上下文管理",
      "上下文工程",
      "上下文压缩",
      "智能体记忆",
      "context management",
      "context engineering"
    ]
  }
};

export interface KnowledgeLinkTarget {
  id: string;
  href: string;
  title: string;
  aliases: string[];
  except?: string[];
}

export interface KnowledgeLinkSource {
  id: string;
  slug: string;
  title: string;
}

/**
 * Targets for every item that has an alias entry. Pass published knowledge
 * only: an id with no item (a draft, or a typo) simply produces no target.
 */
export function buildKnowledgeLinkTargets(
  items: KnowledgeLinkSource[],
  table: Record<string, KnowledgeAliasEntry> = knowledgeAliases
): KnowledgeLinkTarget[] {
  return items.flatMap((item) => {
    const entry = table[item.id];
    if (!entry) return [];
    const aliases = [item.title, ...entry.aliases].filter(
      (alias, index, all) => alias.trim() && all.indexOf(alias) === index
    );
    return [
      {
        id: item.id,
        href: `/knowledge/${item.slug}`,
        title: item.title,
        aliases,
        ...(entry.except?.length ? { except: entry.except } : {})
      }
    ];
  });
}

const latinChar = /[A-Za-z0-9]/;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasPattern(alias: string): RegExp {
  const body = alias.trim().split(/\s+/).map(escapeRegExp).join("[\\s\\-]?");
  return new RegExp(body, "gi");
}

interface Match {
  start: number;
  end: number;
  target: KnowledgeLinkTarget;
}

function findMatches(text: string, target: KnowledgeLinkTarget): Match[] {
  const blocked: Array<[number, number]> = [];
  for (const phrase of target.except ?? []) {
    for (const hit of text.matchAll(aliasPattern(phrase))) {
      blocked.push([hit.index, hit.index + hit[0].length]);
    }
  }

  const matches: Match[] = [];
  for (const alias of target.aliases) {
    const trimmed = alias.trim();
    const checkStart = latinChar.test(trimmed[0] ?? "");
    const checkEnd = latinChar.test(trimmed[trimmed.length - 1] ?? "");
    for (const hit of text.matchAll(aliasPattern(trimmed))) {
      const start = hit.index;
      const end = start + hit[0].length;
      if (checkStart && start > 0 && latinChar.test(text[start - 1])) continue;
      if (checkEnd && end < text.length && latinChar.test(text[end])) continue;
      if (blocked.some(([from, to]) => start < to && from < end)) continue;
      matches.push({ start, end, target });
    }
  }
  return matches;
}

/** True when `text` mentions the target anywhere, by the same rules. */
export function mentionsKnowledgeTarget(
  text: string,
  target: KnowledgeLinkTarget
): boolean {
  return findMatches(text, target).length > 0;
}

/**
 * The targets a page needs: those mentioned in any of `texts` (both language
 * versions of a body), so the rest never reach the browser.
 */
export function selectKnowledgeLinkTargets(
  targets: KnowledgeLinkTarget[],
  texts: string[]
): KnowledgeLinkTarget[] {
  return targets.filter((target) =>
    texts.some((text) => text && mentionsKnowledgeTarget(text, target))
  );
}

export interface KnowledgeLinkPiece {
  text: string;
  link?: { href: string; title: string };
}

/**
 * A linker for one body. It remembers which items it has linked, so call it
 * on the body's text runs in reading order and each item links once.
 */
export function createKnowledgeLinker(
  targets: KnowledgeLinkTarget[]
): (text: string) => KnowledgeLinkPiece[] {
  const linked = new Set<string>();

  return (text) => {
    const candidates = targets
      .filter((target) => !linked.has(target.id))
      .flatMap((target) => findMatches(text, target))
      .sort(
        (left, right) =>
          left.start - right.start ||
          right.end - right.start - (left.end - left.start)
      );

    const chosen: Match[] = [];
    let cursor = 0;
    for (const match of candidates) {
      if (match.start < cursor) continue;
      if (chosen.some((item) => item.target.id === match.target.id)) continue;
      chosen.push(match);
      cursor = match.end;
    }

    if (chosen.length === 0) return [{ text }];

    const pieces: KnowledgeLinkPiece[] = [];
    let position = 0;
    for (const match of chosen) {
      linked.add(match.target.id);
      if (match.start > position) {
        pieces.push({ text: text.slice(position, match.start) });
      }
      pieces.push({
        text: text.slice(match.start, match.end),
        link: { href: match.target.href, title: match.target.title }
      });
      position = match.end;
    }
    if (position < text.length) pieces.push({ text: text.slice(position) });
    return pieces;
  };
}

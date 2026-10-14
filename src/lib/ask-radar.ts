import type { AskHistoryTurn, AskPriorSourceRef } from "@/lib/ask-conversation";
import {
  askRefusalPrefix,
  checkCitations,
  isRefusal
} from "@/lib/ask-radar-citations";
import type {
  ChatMessage,
  ChatStreamClient,
  ChatToolCall,
  ChatToolDefinition,
  ChatUsage
} from "@/lib/llm/chat-stream";

/**
 * 问雷达: a question answered only from the site's own published content,
 * through two tools — search and read — with every claim cited.
 *
 * The loop is deliberately small. The model may call tools for a few rounds;
 * the last round is sent without tools so it has to answer. Reference numbers
 * are assigned by this code, not by the model, the first time an item comes
 * back from a tool, so a citation can be checked mechanically: a number that
 * no tool returned is invalid, whatever the text around it says.
 *
 * A follow-up carries the conversation's earlier questions and answers and
 * the items already shown (resolved again by `resolveAskPriorSources`).
 * Those items keep their numbers; new ones are numbered after them, so one
 * number means one item for the whole conversation. See ask-conversation.ts.
 *
 * Tools are injected, so the loop is tested without a model or a store.
 */

export type AskSourceKind = "technology" | "skill" | "knowledge";

export interface AskSource {
  ref: number;
  /** `T:` / `S:` / `K:` + slug — what the eval labels. */
  key: string;
  kind: AskSourceKind;
  title: string;
  href: string;
}

export interface AskSearchHit {
  key: string;
  kind: AskSourceKind;
  title: string;
  summary?: string;
  href: string;
  matchedBy: "keyword" | "semantic" | "both";
}

export interface AskItemBody {
  key: string;
  kind: AskSourceKind;
  title: string;
  href: string;
  body: string;
}

export interface AskTools {
  search(query: string): Promise<AskSearchHit[]>;
  read(key: string): Promise<AskItemBody | undefined>;
}

export type AskEvent =
  | { type: "status"; text: string }
  | { type: "sources"; sources: AskSource[] }
  | { type: "delta"; text: string }
  /** The model wrote text and then asked for a tool: discard that text. */
  | { type: "reset" }
  | {
      type: "done";
      cited: number[];
      invalid: number[];
      refused: boolean;
    }
  | { type: "error"; message: string };

export interface AskRunStats {
  rounds: number;
  toolCalls: number;
  usage: Required<ChatUsage>;
  answer: string;
  sources: AskSource[];
}

/**
 * Bumped whenever the system prompt, the tools or the loop change, so an eval
 * number stays tied to the version it measured (same rule as triage).
 */
export const ASK_PROMPT_VERSION = "ask-radar-v1";

/**
 * The follow-up additions (earlier turns as messages, the carried-forward
 * items in the system prompt). A first question's prompt and loop are byte
 * for byte what `ASK_PROMPT_VERSION` measured — a test pins that — so the
 * single-turn eval stays valid; this tags anything measured on follow-ups.
 */
export const ASK_FOLLOWUP_PROMPT_VERSION = "ask-followup-v1";

export const askMaxRounds = 4;
const maxTokensPerRound = 700;
const maxBodyChars = 2400;

export const askTools: ChatToolDefinition[] = [
  {
    name: "search_radar",
    description:
      "在本站已发布的技术信号、技能和知识条目中检索。返回条目的编号(ref)、类型、标题、摘要，以及它是按关键词还是按意思找到的。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "检索词，可以是中文或英文，尽量短而具体。"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "read_item",
    description:
      "读取一条已检索到的条目的正文。只在摘要不足以回答时使用，参数是 search_radar 返回的 ref。",
    parameters: {
      type: "object",
      properties: {
        ref: { type: "integer", description: "search_radar 返回的编号。" }
      },
      required: ["ref"]
    }
  }
];

const kindLabels: Record<AskSourceKind, string> = {
  technology: "技术信号",
  skill: "技能",
  knowledge: "知识"
};

export function buildAskSystemPrompt(priorSources: AskSource[] = []): string {
  const base = [
    "你是「AI 技术雷达」网站的站内问答助手。你只能根据工具返回的本站内容回答，不能用站外知识补充事实。",
    "",
    "做法：",
    "1. 先调用 search_radar 检索。换个说法再检索一次通常有用，但不要超过三次。",
    "2. 摘要不够用时，用 read_item 读正文。",
    "3. 每一句事实性陈述后面用 [编号] 标出出处，编号只能用工具结果里给出的 ref。不要编造编号。",
    `4. 如果检索到的内容都回答不了这个问题，回答必须以「${askRefusalPrefix}。」开头，然后可以用一句话说明站内最接近的是哪条（同样标出处），不要凭常识作答。`,
    "5. matchedBy 为 semantic 的条目只是意思相近，可能根本不切题，用之前先判断。",
    "",
    "格式：中文，不超过 300 字，分成两到四个短段落。不使用 Markdown 标题、列表、加粗或表格。引号用「」。"
  ];

  if (priorSources.length === 0) {
    return base.join("\n");
  }

  return [
    ...base,
    "",
    "这是一段对话里的追问：",
    "- 前面几轮的回答只用来弄清追问指的是什么，不是出处，里面的说法不能直接当事实再用。",
    "- 前面几轮已经检索到的条目列在下面，可以直接用它们的编号引用，需要正文时用 read_item 读；追问换了话题时照常检索。",
    "- 新检索到的条目会接着这些编号往下编，同一个条目在整段对话里只有一个编号。",
    `- 追问在站内找不到答案时，同样以「${askRefusalPrefix}。」开头。`,
    "",
    "前面几轮已检索到的条目：",
    ...priorSources.map(
      (source) =>
        `[${source.ref}] ${kindLabels[source.kind]}「${source.title}」`
    )
  ].join("\n");
}

/**
 * Turns the `{ ref, key }` pairs a follow-up sends into sources the server
 * vouches for: each key is read again from published content, and its title,
 * link and kind come from that read, never from the request. Keys that no
 * longer resolve (an item unpublished since) are dropped — a later citation
 * of that number then reads as invalid, which is what it is.
 */
export async function resolveAskPriorSources(
  refs: AskPriorSourceRef[],
  tools: AskTools
): Promise<AskSource[]> {
  const resolved: AskSource[] = [];

  for (const { ref, key } of refs) {
    const item = await tools.read(key);

    if (item) {
      resolved.push({
        ref,
        key,
        kind: item.kind,
        title: item.title,
        href: item.href
      });
    }
  }

  return resolved;
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}") as unknown;

    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function* runAskRadar(
  question: string,
  deps: {
    client: ChatStreamClient;
    tools: AskTools;
    signal?: AbortSignal;
    onStats?: (stats: AskRunStats) => void;
    /** Earlier turns, already cut by `fitHistory`. */
    history?: AskHistoryTurn[];
    /** Items earlier turns showed, from `resolveAskPriorSources`. */
    priorSources?: AskSource[];
  }
): AsyncGenerator<AskEvent> {
  const { client, tools } = deps;
  const history = deps.history ?? [];
  const priorSources = history.length > 0 ? (deps.priorSources ?? []) : [];
  const sources = new Map<string, AskSource>(
    priorSources.map((source) => [source.key, source])
  );
  let nextRef =
    priorSources.reduce((max, source) => Math.max(max, source.ref), 0) + 1;
  const messages: ChatMessage[] = [
    { role: "system", content: buildAskSystemPrompt(priorSources) },
    ...history.flatMap((turn): ChatMessage[] => [
      { role: "user", content: turn.question },
      { role: "assistant", content: turn.answer }
    ]),
    { role: "user", content: question }
  ];
  const usage = { promptTokens: 0, completionTokens: 0 };
  let toolCallCount = 0;

  const register = (hit: {
    key: string;
    kind: AskSourceKind;
    title: string;
    href: string;
  }): AskSource => {
    const existing = sources.get(hit.key);

    if (existing) {
      return existing;
    }

    const source: AskSource = {
      ref: nextRef,
      key: hit.key,
      kind: hit.kind,
      title: hit.title,
      href: hit.href
    };
    sources.set(hit.key, source);
    nextRef += 1;

    return source;
  };

  for (let round = 1; round <= askMaxRounds; round += 1) {
    // Once the reader has gone (the route passes request.signal), start no
    // further round or tool call. The OpenAI-compatible client would refuse
    // an aborted fetch anyway; a client that ignores the signal would not.
    if (deps.signal?.aborted) {
      return;
    }

    const finalRound = round === askMaxRounds;
    let text = "";
    let calls: ChatToolCall[] = [];

    for await (const event of client.stream({
      messages,
      tools: finalRound ? undefined : askTools,
      maxTokens: maxTokensPerRound,
      signal: deps.signal
    })) {
      if (event.type === "text") {
        text += event.delta;
        yield { type: "delta", text: event.delta };
      } else {
        // The final round is sent without tools; a model that asks for one
        // anyway has its request ignored rather than looping further.
        calls = finalRound ? [] : event.toolCalls;
        usage.promptTokens += event.usage?.promptTokens ?? 0;
        usage.completionTokens += event.usage?.completionTokens ?? 0;
      }
    }

    if (calls.length === 0) {
      const validRefs = new Set([...sources.values()].map((s) => s.ref));
      const check = checkCitations(text, validRefs);

      deps.onStats?.({
        rounds: round,
        toolCalls: toolCallCount,
        usage,
        answer: text,
        sources: [...sources.values()]
      });
      yield {
        type: "done",
        cited: check.cited,
        invalid: check.invalid,
        refused: isRefusal(text)
      };
      return;
    }

    if (text) {
      yield { type: "reset" };
    }

    messages.push({ role: "assistant", content: text, toolCalls: calls });

    for (const call of calls) {
      if (deps.signal?.aborted) {
        return;
      }

      toolCallCount += 1;
      const args = parseArguments(call.arguments);
      let result: unknown;

      if (call.name === "search_radar") {
        const query = String(args.query ?? question).slice(0, 100);
        yield { type: "status", text: `检索「${query}」` };
        const hits = await tools.search(query);
        result = hits.map((hit) => ({
          ref: register(hit).ref,
          type: kindLabels[hit.kind],
          title: hit.title,
          summary: hit.summary,
          matchedBy: hit.matchedBy
        }));

        if (hits.length === 0) {
          result = { results: [], note: "没有检索到任何条目。" };
        }

        yield { type: "sources", sources: [...sources.values()] };
      } else if (call.name === "read_item") {
        const ref = Number(args.ref);
        const source = [...sources.values()].find((s) => s.ref === ref);
        const item = source ? await tools.read(source.key) : undefined;

        if (source && item) {
          yield { type: "status", text: `阅读「${source.title}」` };
          result = {
            ref,
            title: item.title,
            body: item.body.slice(0, maxBodyChars)
          };
        } else {
          result = { error: `没有编号为 ${args.ref} 的条目，请先检索。` };
        }
      } else {
        result = { error: `未知工具 ${call.name}` };
      }

      messages.push({
        role: "tool",
        toolCallId: call.id,
        content: JSON.stringify(result)
      });
    }
  }
}

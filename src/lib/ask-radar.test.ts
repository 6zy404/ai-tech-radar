import { describe, expect, it } from "vitest";

import {
  askMaxRounds,
  buildAskSystemPrompt,
  resolveAskPriorSources,
  runAskRadar,
  type AskEvent,
  type AskSource,
  type AskSearchHit,
  type AskTools
} from "@/lib/ask-radar";
import {
  checkCitations,
  isRefusal,
  splitAnswerWithCitations
} from "@/lib/ask-radar-citations";
import {
  readSseData,
  ToolCallAccumulator,
  type ChatStreamClient,
  type ChatStreamEvent,
  type ChatStreamRequest
} from "@/lib/llm/chat-stream";

type Turn =
  | { text?: string; toolCalls?: { name: string; arguments: string }[] }
  | ((request: ChatStreamRequest) => {
      text?: string;
      toolCalls?: { name: string; arguments: string }[];
    });

/** A model that plays back a fixed script, one turn per request. */
function scriptedClient(turns: Turn[]) {
  const requests: ChatStreamRequest[] = [];
  const client: ChatStreamClient = {
    modelName: "scripted",
    async *stream(request): AsyncGenerator<ChatStreamEvent> {
      requests.push(structuredClone(request));
      const script = turns[requests.length - 1] ?? { text: "" };
      const turn = typeof script === "function" ? script(request) : script;

      if (turn.text) {
        yield { type: "text", delta: turn.text };
      }

      yield {
        type: "done",
        finishReason: turn.toolCalls?.length ? "tool_calls" : "stop",
        toolCalls: (turn.toolCalls ?? []).map((call, index) => ({
          id: `call_${requests.length}_${index}`,
          ...call
        })),
        usage: { promptTokens: 10, completionTokens: 5 }
      };
    }
  };

  return { client, requests };
}

const hits: AskSearchHit[] = [
  {
    key: "S:on-device-model-deployment",
    kind: "skill",
    title: "端侧模型部署与硬件适配",
    summary: "判断一台机器能不能跑。",
    href: "/skills/on-device-model-deployment",
    matchedBy: "semantic"
  },
  {
    key: "K:model-quantization-numeric-precision",
    kind: "knowledge",
    title: "模型量化与数值精度",
    href: "/knowledge/model-quantization-numeric-precision",
    matchedBy: "both"
  }
];

const tools: AskTools = {
  async search() {
    return hits;
  },
  async read(key) {
    const hit = hits.find((entry) => entry.key === key);

    return hit ? { ...hit, body: `正文：${hit.title}` } : undefined;
  }
};

async function collect(generator: AsyncGenerator<AskEvent>) {
  const events: AskEvent[] = [];

  for await (const event of generator) {
    events.push(event);
  }

  return events;
}

const search = (query: string) => ({
  toolCalls: [{ name: "search_radar", arguments: JSON.stringify({ query }) }]
});

describe("runAskRadar", () => {
  it("searches, then answers with citations checked against what was returned", async () => {
    const { client } = scriptedClient([
      search("本地跑大模型"),
      { text: "先定量化档位[2]，再用目标设备验收[1]。" }
    ]);
    const events = await collect(
      runAskRadar("本地跑大模型", { client, tools })
    );

    expect(events.find((e) => e.type === "status")).toEqual({
      type: "status",
      text: "检索「本地跑大模型」"
    });
    expect(events.at(-1)).toEqual({
      type: "done",
      cited: [2, 1],
      invalid: [],
      refused: false
    });
  });

  it("flags a citation number no tool returned", async () => {
    const { client } = scriptedClient([
      search("x"),
      { text: "有依据[1]，也有编的[7]。" }
    ]);
    const done = (await collect(runAskRadar("x", { client, tools }))).at(-1);

    expect(done).toMatchObject({ cited: [1, 7], invalid: [7] });
  });

  it("gives the model the ref numbers it must cite", async () => {
    const { client, requests } = scriptedClient([search("x"), { text: "好" }]);
    await collect(runAskRadar("x", { client, tools }));

    const toolMessage = requests[1].messages.at(-1);
    expect(toolMessage?.role).toBe("tool");
    expect(JSON.parse((toolMessage as { content: string }).content)).toEqual([
      expect.objectContaining({ ref: 1, title: "端侧模型部署与硬件适配" }),
      expect.objectContaining({ ref: 2, matchedBy: "both" })
    ]);
  });

  it("keeps a source's number stable across repeated searches", async () => {
    const { client } = scriptedClient([
      search("a"),
      search("b"),
      { text: "见[1][2]。" }
    ]);
    const events = await collect(runAskRadar("q", { client, tools }));
    const lastSources = events.filter((e) => e.type === "sources").at(-1);

    expect(lastSources).toMatchObject({
      sources: [{ ref: 1 }, { ref: 2 }]
    });
    expect(events.at(-1)).toMatchObject({ invalid: [] });
  });

  it("reads an item by ref, and refuses a ref it never handed out", async () => {
    const { client, requests } = scriptedClient([
      search("x"),
      {
        toolCalls: [
          { name: "read_item", arguments: '{"ref":2}' },
          { name: "read_item", arguments: '{"ref":9}' }
        ]
      },
      { text: "答[2]" }
    ]);
    await collect(runAskRadar("x", { client, tools }));

    const toolResults = requests[2].messages
      .filter((message) => message.role === "tool")
      .slice(-2)
      .map((message) => JSON.parse((message as { content: string }).content));

    expect(toolResults[0]).toMatchObject({
      ref: 2,
      body: "正文：模型量化与数值精度"
    });
    expect(toolResults[1]).toHaveProperty("error");
  });

  it("tells the client to discard text written before a tool call", async () => {
    const { client } = scriptedClient([
      { text: "让我查一下。", ...search("x") },
      { text: "答[1]" }
    ]);
    const types = (await collect(runAskRadar("x", { client, tools }))).map(
      (event) => event.type
    );

    expect(types.indexOf("reset")).toBeGreaterThan(types.indexOf("delta"));
    expect(types.indexOf("reset")).toBeLessThan(types.indexOf("status"));
  });

  it("sends the last round without tools and stops even if the model keeps asking", async () => {
    const { client, requests } = scriptedClient(
      Array.from({ length: askMaxRounds }, () => search("again"))
    );
    const events = await collect(runAskRadar("x", { client, tools }));

    expect(requests).toHaveLength(askMaxRounds);
    expect(requests.at(-1)?.tools).toBeUndefined();
    expect(requests[0].tools?.length).toBeGreaterThan(0);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("reports a refusal by its fixed opening", async () => {
    const { client } = scriptedClient([
      search("股票"),
      { text: "站内没有直接相关的内容。" }
    ]);
    const done = (await collect(runAskRadar("股票", { client, tools }))).at(-1);

    expect(done).toMatchObject({ refused: true, cited: [] });
  });
});

describe("citations", () => {
  it("splits text around citation markers", () => {
    expect(splitAnswerWithCitations("a[1]b[12]")).toEqual([
      { type: "text", value: "a" },
      { type: "cite", ref: 1 },
      { type: "text", value: "b" },
      { type: "cite", ref: 12 }
    ]);
  });

  it("counts each cited number once, in order", () => {
    expect(checkCitations("[3]x[1][3]", new Set([1]))).toEqual({
      cited: [3, 1],
      invalid: [3]
    });
  });

  it("detects a refusal only at the start", () => {
    expect(isRefusal("  站内没有直接相关的内容。")).toBe(true);
    expect(isRefusal("有。但站内没有直接相关的内容")).toBe(false);
  });
});

describe("chat stream parsing", () => {
  it("reassembles tool calls from fragments", () => {
    const accumulator = new ToolCallAccumulator();
    accumulator.add([
      { index: 0, id: "c1", function: { name: "search_radar", arguments: "" } }
    ]);
    accumulator.add([{ index: 0, function: { arguments: '{"que' } }]);
    accumulator.add([{ index: 0, function: { arguments: 'ry":"x"}' } }]);

    expect(accumulator.result()).toEqual([
      { id: "c1", name: "search_radar", arguments: '{"query":"x"}' }
    ]);
  });

  it("reads SSE data lines split across chunks", async () => {
    const encoder = new TextEncoder();
    const chunks = ['data: {"a":', "1}\n\ndata: [DO", "NE]\n"];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      }
    });
    const lines: string[] = [];

    for await (const line of readSseData(body)) {
      lines.push(line);
    }

    expect(lines).toEqual(['{"a":1}', "[DONE]"]);
  });
});

describe("runAskRadar follow-ups", () => {
  const prior: AskSource[] = [
    {
      ref: 1,
      key: "T:ollama-0-34",
      kind: "technology",
      title: "Ollama 0.34",
      href: "/technologies/ollama-0-34"
    },
    {
      ref: 2,
      key: "K:model-quantization-numeric-precision",
      kind: "knowledge",
      title: "模型量化与数值精度",
      href: "/knowledge/model-quantization-numeric-precision"
    }
  ];
  const history = [{ question: "本地跑大模型", answer: "先看量化[2]。" }];

  it("keeps earlier numbers and numbers new items after the highest one", async () => {
    const { client } = scriptedClient([
      search("端侧"),
      { text: "可以[3]，也可以回看[2]。" }
    ]);
    const events = await collect(
      runAskRadar("那手机上呢", {
        client,
        tools,
        history,
        priorSources: prior
      })
    );
    const sources = events.filter((e) => e.type === "sources").at(-1);

    // hits = [S:on-device… (new), K:model-quantization… (already #2)]
    expect(sources).toEqual({
      type: "sources",
      sources: [
        prior[0],
        prior[1],
        expect.objectContaining({ ref: 3, key: "S:on-device-model-deployment" })
      ]
    });
    expect(events.at(-1)).toEqual({
      type: "done",
      cited: [3, 2],
      invalid: [],
      refused: false
    });
  });

  it("accepts an earlier number without a new search, and flags one nobody retrieved", async () => {
    const { client } = scriptedClient([
      { text: "就是上一轮那条[1]，不是[4]。" }
    ]);
    const done = (
      await collect(
        runAskRadar("哪个版本", { client, tools, history, priorSources: prior })
      )
    ).at(-1);

    expect(done).toMatchObject({ cited: [1, 4], invalid: [4] });
  });

  it("sends earlier turns as messages and lists carried items in the system prompt", async () => {
    const { client, requests } = scriptedClient([{ text: "好的[1]。" }]);
    await collect(
      runAskRadar("追问", { client, tools, history, priorSources: prior })
    );
    const [system, ...rest] = requests[0].messages;

    expect(rest).toEqual([
      { role: "user", content: "本地跑大模型" },
      { role: "assistant", content: "先看量化[2]。" },
      { role: "user", content: "追问" }
    ]);
    expect(system.content).toContain("[1] 技术信号「Ollama 0.34」");
    expect(system.content).toContain("[2] 知识「模型量化与数值精度」");
  });

  it("leaves a first question's prompt exactly as the single-turn eval measured it", async () => {
    const { client, requests } = scriptedClient([{ text: "答。" }]);
    await collect(runAskRadar("问", { client, tools, priorSources: prior }));

    expect(requests[0].messages).toEqual([
      { role: "system", content: buildAskSystemPrompt() },
      { role: "user", content: "问" }
    ]);
    expect(buildAskSystemPrompt()).not.toContain("追问");
    expect(buildAskSystemPrompt([])).toBe(buildAskSystemPrompt());
  });

  it("still reports a refusal on a follow-up", async () => {
    const { client } = scriptedClient([
      search("股票"),
      { text: "站内没有直接相关的内容。最接近的是[1]。" }
    ]);
    const done = (
      await collect(
        runAskRadar("那股票呢", { client, tools, history, priorSources: prior })
      )
    ).at(-1);

    expect(done).toMatchObject({ refused: true, cited: [1], invalid: [] });
  });
});

describe("resolveAskPriorSources", () => {
  it("takes title, link and kind from published content, never from the request", async () => {
    const resolved = await resolveAskPriorSources(
      [
        { ref: 4, key: "S:on-device-model-deployment" },
        { ref: 7, key: "T:unpublished-or-made-up" }
      ],
      tools
    );

    expect(resolved).toEqual([
      {
        ref: 4,
        key: "S:on-device-model-deployment",
        kind: "skill",
        title: "端侧模型部署与硬件适配",
        href: "/skills/on-device-model-deployment"
      }
    ]);
  });
});

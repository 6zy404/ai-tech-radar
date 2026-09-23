import { askRefusalPrefix } from "@/lib/ask-radar-citations";
import {
  createOpenAiCompatibleChatStream,
  type ChatStreamClient,
  type ChatStreamEvent
} from "@/lib/llm/chat-stream";
import { getLlmProviderConfig } from "@/lib/llm/provider";

/**
 * Stand-in for a real model when no key is configured, so the page and the
 * eval pipeline run end to end offline. It always searches once with the
 * reader's words, then lists what came back — it never claims to have read or
 * understood anything, and it says it is a demo.
 */
export function createMockChatStream(): ChatStreamClient {
  return {
    modelName: "mock-ask-radar-v0",
    async *stream(request): AsyncGenerator<ChatStreamEvent> {
      const last = request.messages.at(-1);

      if (last?.role === "user" && request.tools?.length) {
        yield {
          type: "done",
          finishReason: "tool_calls",
          toolCalls: [
            {
              id: "mock_call_1",
              name: "search_radar",
              arguments: JSON.stringify({ query: last.content })
            }
          ]
        };
        return;
      }

      let hits: { ref: number; title: string }[] = [];

      if (last?.role === "tool") {
        try {
          const parsed = JSON.parse(last.content) as unknown;
          hits = Array.isArray(parsed)
            ? (parsed as { ref: number; title: string }[])
            : [];
        } catch {
          hits = [];
        }
      }

      const answer =
        hits.length === 0
          ? `${askRefusalPrefix}。（演示模式：未配置模型。）`
          : `（演示模式：未配置模型，下面只列出检索到的条目，没有生成回答。）\n\n站内与这个问题最接近的是${hits
              .slice(0, 3)
              .map((hit) => `「${hit.title}」[${hit.ref}]`)
              .join("、")}。`;

      for (let index = 0; index < answer.length; index += 8) {
        yield { type: "text", delta: answer.slice(index, index + 8) };
      }

      yield { type: "done", finishReason: "stop", toolCalls: [] };
    }
  };
}

export function createConfiguredChatStream(): ChatStreamClient {
  const config = getLlmProviderConfig();

  if (config.provider === "openai_compatible" && config.apiKey) {
    return createOpenAiCompatibleChatStream({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model
    });
  }

  return createMockChatStream();
}

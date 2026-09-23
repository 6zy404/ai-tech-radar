/**
 * Streaming chat with tool calling, for the OpenAI-compatible
 * `/chat/completions` endpoint (DeepSeek included). Server-only.
 *
 * The existing `LlmProvider.generate` is one JSON-mode request/response, which
 * is right for the cached AI features and wrong for an agent: an agent needs
 * the model to ask for tools, and a reader needs to see the answer as it is
 * written. This module adds exactly that and nothing else — no retries, no
 * provider switching; callers decide what a failure means.
 */

export interface ChatToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatToolCall {
  id: string;
  name: string;
  /** Raw JSON string as the model produced it; parse defensively. */
  arguments: string;
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ChatToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export interface ChatStreamRequest {
  messages: ChatMessage[];
  tools?: ChatToolDefinition[];
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ChatUsage {
  promptTokens?: number;
  completionTokens?: number;
}

export type ChatStreamEvent =
  | { type: "text"; delta: string }
  | {
      type: "done";
      finishReason: string;
      toolCalls: ChatToolCall[];
      usage?: ChatUsage;
    };

export interface ChatStreamClient {
  modelName: string;
  stream(request: ChatStreamRequest): AsyncGenerator<ChatStreamEvent>;
}

function toWireMessage(message: ChatMessage) {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content
    };
  }

  if (message.role === "assistant" && message.toolCalls?.length) {
    return {
      role: "assistant",
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments }
      }))
    };
  }

  return { role: message.role, content: message.content };
}

interface StreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

/**
 * Reassembles tool calls from streamed fragments. The first fragment of a
 * call carries its id and name; later ones carry only pieces of the
 * arguments string, keyed by `index`.
 */
export class ToolCallAccumulator {
  private readonly calls = new Map<number, ChatToolCall>();

  add(
    fragments: NonNullable<
      NonNullable<StreamChunk["choices"]>[number]["delta"]
    >["tool_calls"]
  ) {
    for (const fragment of fragments ?? []) {
      const existing = this.calls.get(fragment.index) ?? {
        id: "",
        name: "",
        arguments: ""
      };

      if (fragment.id) {
        existing.id = fragment.id;
      }

      if (fragment.function?.name) {
        existing.name += fragment.function.name;
      }

      if (fragment.function?.arguments) {
        existing.arguments += fragment.function.arguments;
      }

      this.calls.set(fragment.index, existing);
    }
  }

  result(): ChatToolCall[] {
    return [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, call]) => ({
        ...call,
        id: call.id || `call_${index}`
      }))
      .filter((call) => call.name.length > 0);
  }
}

/**
 * Splits a server-sent-events byte stream into `data:` payloads. Lines can
 * arrive split across network chunks, so a partial trailing line is carried
 * over to the next chunk.
 */
export async function* readSseData(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data:")) {
        yield line.slice(5).trim();
      }
    }
  }

  const tail = buffer.trim();

  if (tail.startsWith("data:")) {
    yield tail.slice(5).trim();
  }
}

function redactKey(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]");
}

export function createOpenAiCompatibleChatStream(options: {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}): ChatStreamClient {
  const endpoint = `${(options.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "")}/chat/completions`;
  const modelName = options.model || "gpt-4o-mini";

  return {
    modelName,
    async *stream(request) {
      const timeout = AbortSignal.timeout(request.timeoutMs ?? 60_000);
      const signal = request.signal
        ? AbortSignal.any([request.signal, timeout])
        : timeout;
      let response: Response;

      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json"
          },
          signal,
          body: JSON.stringify({
            model: modelName,
            stream: true,
            stream_options: { include_usage: true },
            max_tokens: request.maxTokens,
            messages: request.messages.map(toWireMessage),
            ...(request.tools?.length
              ? {
                  tools: request.tools.map((tool) => ({
                    type: "function",
                    function: tool
                  }))
                }
              : {})
          })
        });
      } catch (error) {
        throw new Error(
          redactKey(error instanceof Error ? error.message : "request failed")
        );
      }

      if (!response.ok || !response.body) {
        throw new Error(`Provider returned HTTP ${response.status}.`);
      }

      const toolCalls = new ToolCallAccumulator();
      let finishReason = "stop";
      let usage: ChatUsage | undefined;

      for await (const data of readSseData(response.body)) {
        if (data === "[DONE]") {
          break;
        }

        let chunk: StreamChunk;

        try {
          chunk = JSON.parse(data) as StreamChunk;
        } catch {
          continue;
        }

        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens
          };
        }

        const choice = chunk.choices?.[0];

        if (!choice) {
          continue;
        }

        if (choice.delta?.content) {
          yield { type: "text", delta: choice.delta.content };
        }

        if (choice.delta?.tool_calls) {
          toolCalls.add(choice.delta.tool_calls);
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }

      yield {
        type: "done",
        finishReason,
        toolCalls: toolCalls.result(),
        usage
      };
    }
  };
}

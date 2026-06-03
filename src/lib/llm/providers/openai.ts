import type {
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmProvider
} from "@/lib/llm/provider";

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function getEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function sanitizeProviderError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]");
  }

  return "OpenAI-compatible provider request failed.";
}

export function createOpenAiCompatibleProvider(options: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): LlmProvider {
  const baseUrl = options.baseUrl || "https://api.openai.com/v1";
  const modelName = options.model || "gpt-4o-mini";

  return {
    name: "openai_compatible",
    modelName,
    isAvailable() {
      if (!options.apiKey) {
        return {
          available: false,
          reason:
            "LLM_API_KEY is not configured; the workspace will use the mock provider."
        };
      }

      return { available: true };
    },
    async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
      const availability = this.isAvailable();

      if (!availability.available) {
        throw new Error(availability.reason);
      }

      try {
        const response = await fetch(getEndpoint(baseUrl), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json"
          },
          signal: AbortSignal.timeout(request.timeoutMs ?? 15000),
          body: JSON.stringify({
            model: modelName,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: request.systemPrompt },
              { role: "user", content: request.userPrompt }
            ]
          })
        });

        if (!response.ok) {
          throw new Error(`Provider returned HTTP ${response.status}.`);
        }

        const result = (await response.json()) as OpenAiChatCompletionResponse;
        const text = result.choices?.[0]?.message?.content;

        if (!text) {
          throw new Error("Provider response did not include message content.");
        }

        return {
          text,
          providerName: "openai_compatible",
          modelName,
          tokenUsage: {
            promptTokens: result.usage?.prompt_tokens,
            completionTokens: result.usage?.completion_tokens,
            totalTokens: result.usage?.total_tokens
          }
        };
      } catch (error) {
        throw new Error(sanitizeProviderError(error));
      }
    }
  };
}

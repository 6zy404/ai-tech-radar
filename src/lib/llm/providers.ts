import {
  getLlmProviderConfig,
  type LlmProvider
} from "@/lib/llm/provider";
import { createMockLlmProvider } from "@/lib/llm/providers/mock";
import { createOpenAiCompatibleProvider } from "@/lib/llm/providers/openai";

export function createConfiguredLlmProvider(): LlmProvider {
  const config = getLlmProviderConfig();

  if (config.provider === "openai_compatible") {
    return createOpenAiCompatibleProvider({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model
    });
  }

  return createMockLlmProvider();
}

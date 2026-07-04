export type LlmProviderKind = "mock" | "openai_compatible";

export interface LlmTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LlmGenerateRequest {
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}

export interface LlmGenerateResponse {
  text: string;
  providerName: string;
  modelName: string;
  tokenUsage?: LlmTokenUsage;
}

export interface LlmProvider {
  name: string;
  modelName: string;
  isAvailable(): { available: boolean; reason?: string };
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse>;
}

export interface LlmProviderConfig {
  provider: LlmProviderKind;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs: number;
}

export function getLlmProviderConfig(): LlmProviderConfig {
  const configuredProvider = process.env.LLM_PROVIDER?.trim();
  const apiKey = process.env.LLM_API_KEY?.trim();
  const provider: LlmProviderKind =
    configuredProvider === "openai_compatible" && apiKey
      ? "openai_compatible"
      : "mock";
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 15000);

  return {
    provider,
    apiKey,
    baseUrl: process.env.LLM_BASE_URL?.trim(),
    model: process.env.LLM_MODEL?.trim(),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000
  };
}

export function getConfiguredProviderLabel(): string {
  const config = getLlmProviderConfig();

  return config.provider === "openai_compatible" ? "openai-compatible" : "mock";
}

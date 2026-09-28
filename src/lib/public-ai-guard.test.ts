import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  guardPublicAiRequest,
  publicAiContentTypeMessage,
  publicAiCrossSiteMessage,
  publicAiInvalidBodyMessage,
  publicAiRateLimitMessage,
  resetPublicAiRateLimit
} from "@/lib/public-ai-rate-limit";

function makeRequest(
  headers: Record<string, string>,
  body: string = "{}"
): Request {
  return new Request("https://aizyradar.cn/api/ask", {
    method: "POST",
    headers: { "cf-connecting-ip": "203.0.113.7", ...headers },
    body
  });
}

const json = { "content-type": "application/json" };

const originalPerMinute = process.env.PUBLIC_AI_RATE_LIMIT_PER_MINUTE;

beforeEach(() => {
  process.env.PUBLIC_AI_RATE_LIMIT_PER_MINUTE = "2";
  resetPublicAiRateLimit();
});

afterEach(() => {
  if (originalPerMinute === undefined) {
    delete process.env.PUBLIC_AI_RATE_LIMIT_PER_MINUTE;
  } else {
    process.env.PUBLIC_AI_RATE_LIMIT_PER_MINUTE = originalPerMinute;
  }
  resetPublicAiRateLimit();
});

async function errorOf(
  outcome: Awaited<ReturnType<typeof guardPublicAiRequest>>
) {
  if (outcome.ok) {
    throw new Error("expected the guard to refuse");
  }

  return {
    status: outcome.response.status,
    error: ((await outcome.response.json()) as { error: string }).error,
    retryAfter: outcome.response.headers.get("retry-after")
  };
}

describe("guardPublicAiRequest", () => {
  it("passes a well-formed same-site request through with its parsed body", async () => {
    const outcome = await guardPublicAiRequest(
      makeRequest(json, '{"question":"什么是 RAG"}'),
      "ask"
    );

    expect(outcome).toEqual({ ok: true, body: { question: "什么是 RAG" } });
  });

  it("checks the rate limit before anything else, so a spent budget is 429 even for a malformed request", async () => {
    await guardPublicAiRequest(makeRequest(json), "ask");
    await guardPublicAiRequest(makeRequest(json), "ask");

    const refused = await errorOf(
      await guardPublicAiRequest(makeRequest({}, "not json"), "ask")
    );

    expect(refused.status).toBe(429);
    expect(refused.error).toBe(publicAiRateLimitMessage);
    expect(Number(refused.retryAfter)).toBeGreaterThan(0);
  });

  it("keeps a separate budget per route", async () => {
    await guardPublicAiRequest(makeRequest(json), "compare");
    await guardPublicAiRequest(makeRequest(json), "compare");

    const other = await guardPublicAiRequest(makeRequest(json), "explain");

    expect(other.ok).toBe(true);
  });

  it("refuses a non-JSON content type with 415 before reading the body", async () => {
    const refused = await errorOf(
      await guardPublicAiRequest(makeRequest({}, "not json"), "ask")
    );

    expect(refused).toMatchObject({
      status: 415,
      error: publicAiContentTypeMessage
    });
  });

  it("refuses a cross-site browser request with 403", async () => {
    const refused = await errorOf(
      await guardPublicAiRequest(
        makeRequest({ ...json, "sec-fetch-site": "cross-site" }),
        "learning-path"
      )
    );

    expect(refused).toMatchObject({
      status: 403,
      error: publicAiCrossSiteMessage
    });
  });

  it("answers 400 when the body is not valid JSON", async () => {
    const refused = await errorOf(
      await guardPublicAiRequest(makeRequest(json, "{oops"), "ask")
    );

    expect(refused).toMatchObject({
      status: 400,
      error: publicAiInvalidBodyMessage
    });
  });
});

import { NextResponse } from "next/server";

import { runAskRadar, type AskEvent } from "@/lib/ask-radar";
import { siteAskTools } from "@/lib/ask-radar-tools";
import { createConfiguredChatStream } from "@/lib/llm/chat-clients";
import {
  checkPublicAiRateLimit,
  publicAiRateLimitMessage
} from "@/lib/public-ai-rate-limit";

/**
 * POST /api/ask — 问雷达. Public and unauthenticated like the other AI
 * routes; rate limited first, before the body is even read. Streams
 * newline-delimited JSON events (see AskEvent). No event carries provider,
 * model, prompt or token details.
 */

export const dynamic = "force-dynamic";

const minQuestionLength = 2;
const maxQuestionLength = 200;

export async function POST(request: Request) {
  const rateLimit = checkPublicAiRateLimit(request, "ask");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: publicAiRateLimitMessage },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) }
      }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const question =
    typeof (body as { question?: unknown })?.question === "string"
      ? (body as { question: string }).question.trim()
      : "";

  if (
    question.length < minQuestionLength ||
    question.length > maxQuestionLength
  ) {
    return NextResponse.json(
      {
        error: `问题需要 ${minQuestionLength} 到 ${maxQuestionLength} 个字。`
      },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        for await (const event of runAskRadar(question, {
          client: createConfiguredChatStream(),
          tools: siteAskTools,
          signal: request.signal
        })) {
          send(event);
        }
      } catch (error) {
        if (!request.signal.aborted) {
          console.warn(
            "[ask] run failed:",
            error instanceof Error ? error.message : error
          );
          send({ type: "error", message: "回答生成失败，请稍后再试。" });
        }
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no"
    }
  });
}

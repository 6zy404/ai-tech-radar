import { NextResponse } from "next/server";

import { parseAskRequest } from "@/lib/ask-conversation";
import {
  resolveAskPriorSources,
  runAskRadar,
  type AskEvent
} from "@/lib/ask-radar";
import { siteAskTools } from "@/lib/ask-radar-tools";
import { createConfiguredChatStream } from "@/lib/llm/chat-clients";
import { guardPublicAiRequest } from "@/lib/public-ai-rate-limit";

/**
 * POST /api/ask — 问雷达. Public and unauthenticated like the other AI
 * routes; origin-checked and rate limited before the body is even read (the
 * body itself is capped), and per request, so every follow-up counts as one.
 * Streams newline-delimited JSON events
 * (see AskEvent). No event carries provider, model, prompt or token details.
 *
 * Stateless: a follow-up sends the earlier turns and the reference numbers
 * the page has shown (see ask-conversation.ts). Nothing is stored here.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await guardPublicAiRequest(request, "ask");

  if (!guard.ok) {
    return guard.response;
  }

  const parsed = parseAskRequest(guard.body);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const priorSources = await resolveAskPriorSources(
    parsed.priorSources,
    siteAskTools
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        for await (const event of runAskRadar(parsed.question, {
          client: createConfiguredChatStream(),
          tools: siteAskTools,
          signal: request.signal,
          history: parsed.history,
          priorSources
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

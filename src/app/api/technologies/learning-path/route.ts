import { NextResponse } from "next/server";

import {
  checkPublicAiRateLimit,
  publicAiRateLimitMessage
} from "@/lib/public-ai-rate-limit";
import { generateOrGetTechnologyLearningPath } from "@/lib/technology-learning-path";

export async function POST(request: Request) {
  const rateLimit = checkPublicAiRateLimit(request, "learning-path");

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
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { technologyId } = (body ?? {}) as {
    technologyId?: unknown;
  };

  const hasValidTechnologyId =
    typeof technologyId === "string" && technologyId.trim().length > 0;

  if (!hasValidTechnologyId) {
    return NextResponse.json(
      { error: "technologyId is required." },
      { status: 400 }
    );
  }

  const outcome = await generateOrGetTechnologyLearningPath(technologyId);

  if ("error" in outcome) {
    const status = outcome.error.code === "generation_failed" ? 500 : 400;

    return NextResponse.json({ error: outcome.error.message }, { status });
  }

  return NextResponse.json(outcome.result, { status: 200 });
}

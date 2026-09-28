import { NextResponse } from "next/server";

import { guardPublicAiRequest } from "@/lib/public-ai-rate-limit";
import { generateOrGetTechnologyLearningPath } from "@/lib/technology-learning-path";

export async function POST(request: Request) {
  const guard = await guardPublicAiRequest(request, "learning-path");

  if (!guard.ok) {
    return guard.response;
  }

  const body = guard.body;

  const { technologyId } = (body ?? {}) as {
    technologyId?: unknown;
  };

  const hasValidTechnologyId =
    typeof technologyId === "string" && technologyId.trim().length > 0;

  if (!hasValidTechnologyId) {
    return NextResponse.json({ error: "缺少技术信号 id。" }, { status: 400 });
  }

  const outcome = await generateOrGetTechnologyLearningPath(technologyId);

  if ("error" in outcome) {
    const status = outcome.error.code === "generation_failed" ? 500 : 400;

    return NextResponse.json({ error: outcome.error.message }, { status });
  }

  return NextResponse.json(outcome.result, { status: 200 });
}

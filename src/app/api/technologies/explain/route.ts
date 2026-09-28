import { NextResponse } from "next/server";

import { guardPublicAiRequest } from "@/lib/public-ai-rate-limit";
import {
  generateOrGetTechnologyExplanation,
  isTechnologyExplanationAudienceLevel
} from "@/lib/technology-explanation";

export async function POST(request: Request) {
  const guard = await guardPublicAiRequest(request, "explain");

  if (!guard.ok) {
    return guard.response;
  }

  const body = guard.body;

  const { technologyId, audienceLevel } = (body ?? {}) as {
    technologyId?: unknown;
    audienceLevel?: unknown;
  };

  const hasValidTechnologyId =
    typeof technologyId === "string" && technologyId.trim().length > 0;

  if (!hasValidTechnologyId) {
    return NextResponse.json({ error: "缺少技术信号 id。" }, { status: 400 });
  }

  if (!isTechnologyExplanationAudienceLevel(audienceLevel)) {
    return NextResponse.json(
      {
        error:
          "audienceLevel must be one of beginner, intermediate, or advanced."
      },
      { status: 400 }
    );
  }

  const outcome = await generateOrGetTechnologyExplanation(
    technologyId,
    audienceLevel
  );

  if ("error" in outcome) {
    const status = outcome.error.code === "generation_failed" ? 500 : 400;

    return NextResponse.json({ error: outcome.error.message }, { status });
  }

  return NextResponse.json(outcome.result, { status: 200 });
}

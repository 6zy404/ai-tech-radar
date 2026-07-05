import { NextResponse } from "next/server";

import {
  generateOrGetTechnologyExplanation,
  isTechnologyExplanationAudienceLevel
} from "@/lib/technology-explanation";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { technologyId, audienceLevel } = (body ?? {}) as {
    technologyId?: unknown;
    audienceLevel?: unknown;
  };

  const hasValidTechnologyId =
    typeof technologyId === "string" && technologyId.trim().length > 0;

  if (!hasValidTechnologyId) {
    return NextResponse.json(
      { error: "technologyId is required." },
      { status: 400 }
    );
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

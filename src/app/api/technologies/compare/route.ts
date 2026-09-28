import { NextResponse } from "next/server";

import { guardPublicAiRequest } from "@/lib/public-ai-rate-limit";
import { generateOrGetTechnologyComparison } from "@/lib/technology-comparison";

export async function POST(request: Request) {
  const guard = await guardPublicAiRequest(request, "compare");

  if (!guard.ok) {
    return guard.response;
  }

  const body = guard.body;

  const { technologyIdA, technologyIdB } = (body ?? {}) as {
    technologyIdA?: unknown;
    technologyIdB?: unknown;
  };

  const hasValidIds =
    typeof technologyIdA === "string" &&
    typeof technologyIdB === "string" &&
    technologyIdA.trim().length > 0 &&
    technologyIdB.trim().length > 0;

  if (!hasValidIds) {
    return NextResponse.json(
      { error: "缺少要比较的两条技术信号 id。" },
      { status: 400 }
    );
  }

  const outcome = await generateOrGetTechnologyComparison(
    technologyIdA,
    technologyIdB
  );

  if ("error" in outcome) {
    const status = outcome.error.code === "generation_failed" ? 500 : 400;

    return NextResponse.json({ error: outcome.error.message }, { status });
  }

  return NextResponse.json(outcome.result, { status: 200 });
}

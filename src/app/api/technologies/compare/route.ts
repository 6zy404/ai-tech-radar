import { NextResponse } from "next/server";

import { generateOrGetTechnologyComparison } from "@/lib/technology-comparison";

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
      { error: "technologyIdA and technologyIdB are required." },
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

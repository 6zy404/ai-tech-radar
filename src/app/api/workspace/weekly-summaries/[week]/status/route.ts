import { NextResponse } from "next/server";

import {
  setWeeklySummaryStatus,
  WeeklySummaryError
} from "@/lib/weekly-summary";
import { revalidateWeeklySummaryPaths } from "@/lib/weekly-summary-workflow";

interface RouteContext {
  params: Promise<{ week: string }>;
}

/** Publishes the week's summary, or takes it back to draft. */
export async function POST(request: Request, context: RouteContext) {
  const { week } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: unknown;
  };

  if (body.status !== "published" && body.status !== "draft") {
    return NextResponse.json(
      { ok: false, message: "状态只能是 published 或 draft。" },
      { status: 400 }
    );
  }

  try {
    const record = setWeeklySummaryStatus(week, body.status);
    revalidateWeeklySummaryPaths(week);

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    const status = error instanceof WeeklySummaryError ? error.status : 500;
    const message = error instanceof Error ? error.message : "更新状态失败。";

    return NextResponse.json({ ok: false, message }, { status });
  }
}

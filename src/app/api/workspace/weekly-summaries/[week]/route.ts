import { NextResponse } from "next/server";

import {
  saveWeeklySummaryText,
  WeeklySummaryError
} from "@/lib/weekly-summary";
import { revalidateWeeklySummaryPaths } from "@/lib/weekly-summary-workflow";

interface RouteContext {
  params: Promise<{ week: string }>;
}

/** Saves the week's 本周总结 text, creating the record as a draft. */
export async function PUT(request: Request, context: RouteContext) {
  const { week } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { text?: unknown };

  if (typeof body.text !== "string") {
    return NextResponse.json(
      { ok: false, message: "缺少总结文字。" },
      { status: 400 }
    );
  }

  try {
    const record = saveWeeklySummaryText(week, body.text);
    revalidateWeeklySummaryPaths(week);

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    const status = error instanceof WeeklySummaryError ? error.status : 500;
    const message = error instanceof Error ? error.message : "保存失败。";

    return NextResponse.json({ ok: false, message }, { status });
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getTodayDateString } from "@/lib/digest-store";
import {
  PushNotConfiguredError,
  pushDatePattern,
  runPushForDate
} from "@/lib/push-dispatch";

/**
 * POST /api/workspace/push — 推送新信号. Body `{ date?: "YYYY-MM-DD",
 * dryRun?: boolean }`; the date defaults to today. A dry run only counts
 * (subscribers, signals that day, who would be notified) so the console can
 * confirm before sending. Answers with counts; never an endpoint.
 */

export async function POST(request: Request) {
  let body: { date?: unknown; dryRun?: unknown } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const date =
    typeof body.date === "string" && body.date
      ? body.date
      : getTodayDateString();

  if (!pushDatePattern.test(date)) {
    return NextResponse.json(
      { ok: false, message: "日期格式应为 YYYY-MM-DD。" },
      { status: 400 }
    );
  }

  try {
    const summary = await runPushForDate(date, {
      dryRun: body.dryRun === true
    });

    if (!summary.dryRun) {
      revalidatePath("/workspace/delivery");
    }

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const status = error instanceof PushNotConfiguredError ? 503 : 500;
    const message = error instanceof Error ? error.message : "推送失败。";

    return NextResponse.json({ ok: false, message }, { status });
  }
}

import { NextResponse } from "next/server";

import { draftWeeklySummary } from "@/lib/weekly-summary-workflow";

interface RouteContext {
  params: Promise<{ week: string }>;
}

/**
 * 「AI 起草」 for a week's 本周总结: returns a draft, writes nothing. The
 * editor saves it as a draft and publishes it separately. Workspace-only,
 * like the digest's ai-summary route.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { week } = await context.params;

  try {
    const result = await draftWeeklySummary(week);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      text: result.text,
      warnings: result.warnings,
      modelName: result.metadata.modelName,
      promptVersion: result.metadata.promptVersion,
      totalTokens: result.metadata.tokenUsage?.totalTokens,
      latencyMs: result.metadata.latencyMs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误。";

    return NextResponse.json(
      { ok: false, message: `AI 起草失败：${message}` },
      { status: 500 }
    );
  }
}

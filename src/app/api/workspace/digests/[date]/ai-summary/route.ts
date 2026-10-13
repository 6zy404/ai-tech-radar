import { NextResponse } from "next/server";

import { draftDigestEditorialSummary } from "@/lib/digest-ai-summary-workflow";

interface RouteContext {
  params: Promise<{ date: string }>;
}

/**
 * 「AI 起草导语」: returns a draft of the issue's editorialSummary from the
 * signals it selects. Writes nothing — the editor saves through PATCH
 * /api/workspace/digests/[date]. Workspace-only: under the /api/workspace
 * guard and absent from `npm run build:public`, so the model name and
 * prompt version in the response never reach a reader.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { date } = await context.params;

  try {
    const result = await draftDigestEditorialSummary(date);

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
      { ok: false, message: `AI 起草导语失败：${message}` },
      { status: 500 }
    );
  }
}

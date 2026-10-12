import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { generateCandidateAiDraft } from "@/lib/candidate-llm-draft-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * 「AI 起草」: fetch the candidate's source, have the model write the Chinese
 * draft, convert the candidate with those fields. Workspace-only — under the
 * /api/workspace guard and absent from `npm run build:public`. The draft
 * stays `draft`; nothing is published here.
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    blind?: boolean;
  };

  try {
    const result = await generateCandidateAiDraft(id, {
      blind: body?.blind === true
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.error },
        { status: result.status }
      );
    }

    revalidatePath("/workspace");
    revalidatePath("/workspace/editorial-round");
    revalidatePath("/workspace/candidates");
    revalidatePath(`/workspace/candidates/${id}`);
    revalidatePath("/workspace/technologies");
    revalidatePath(`/workspace/technologies/${result.draft.id}`);

    return NextResponse.json({
      ok: true,
      draftId: result.draft.id,
      modelName: result.metadata.modelName,
      sourceTextOrigin: result.metadata.sourceTextOrigin,
      totalTokens: result.metadata.tokenUsage?.totalTokens,
      latencyMs: result.metadata.latencyMs,
      blockingCount: result.blockingErrors.length,
      warningCount: result.warnings.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 起草失败。";

    return NextResponse.json(
      { ok: false, message: `AI 起草失败：${message}` },
      { status: 500 }
    );
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { generateTriageSuggestionsForUndecided } from "@/lib/candidate-triage-suggestions";

/**
 * Generate model suggestions for every undecided candidate that lacks one.
 * Workspace-only (under the /api/workspace guard, and absent from the public
 * build). Writes suggestions only — no candidate status changes here.
 */
export async function POST() {
  try {
    const summary = await generateTriageSuggestionsForUndecided();

    revalidatePath("/workspace/editorial-round");

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成模型建议失败。";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runBatchImportForEnabledSources } from "@/lib/source-workflow";

export async function POST() {
  try {
    const { run, results } = await runBatchImportForEnabledSources();

    revalidatePath("/workspace");
    revalidatePath("/workspace/sources");
    revalidatePath("/workspace/candidates");
    revalidatePath("/workspace/technologies");

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      sourceCount: results.length,
      candidateCount: run.totalCandidatesCreated,
      skippedCandidateCount: run.totalCandidatesSkipped,
      run
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown refresh error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { refreshSemanticDuplicateMatchesInBackground } from "@/lib/semantic-dedup-refresh";
import { runBatchImportForEnabledSources } from "@/lib/source-workflow";

export async function POST() {
  try {
    const { run, results } = await runBatchImportForEnabledSources();

    // Duplicate groups pick the new candidates up once the model has run;
    // the response does not wait for it.
    refreshSemanticDuplicateMatchesInBackground();
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

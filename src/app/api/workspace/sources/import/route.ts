import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runBatchImportForEnabledSources } from "@/lib/source-workflow";

export async function POST() {
  try {
    const result = await runBatchImportForEnabledSources();

    revalidatePath("/workspace");
    revalidatePath("/workspace/sources");
    revalidatePath("/workspace/candidates");
    revalidatePath("/workspace/technologies");

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown batch import error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

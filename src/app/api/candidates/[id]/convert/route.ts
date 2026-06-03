import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { convertImportedCandidateToDraft } from "@/lib/candidate-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const draft = convertImportedCandidateToDraft(id);

    revalidatePath("/workspace");
    revalidatePath("/workspace/candidates");
    revalidatePath(`/workspace/candidates/${id}`);
    revalidatePath("/workspace/duplicates");
    revalidatePath("/workspace/technologies");
    revalidatePath(`/workspace/technologies/${draft.id}`);

    return NextResponse.json({
      ok: true,
      draftId: draft.id
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown conversion error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { convertImportedCandidateToDraft } from "@/lib/candidate-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    // The candidate detail page posts no body; the round console may send
    // { blind: true }.
    const body = (await request.json().catch(() => ({}))) as {
      blind?: boolean;
    };
    const draft = convertImportedCandidateToDraft(id, {
      blind: body?.blind === true
    });

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

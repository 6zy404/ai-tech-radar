import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { updateImportedCandidateStatus } from "@/lib/candidate-workflow";
import type { CandidateImportStatus } from "@/types/content";

const allowedStatuses: CandidateImportStatus[] = [
  "new",
  "reviewed",
  "converted",
  "rejected"
];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: CandidateImportStatus };

    if (!body.status || !allowedStatuses.includes(body.status)) {
      return NextResponse.json(
        { ok: false, message: "Unsupported candidate status." },
        { status: 400 }
      );
    }

    const state = updateImportedCandidateStatus(id, body.status);

    revalidatePath("/workspace");
    revalidatePath("/workspace/candidates");
    revalidatePath(`/workspace/candidates/${id}`);

    return NextResponse.json({ ok: true, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown status update error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

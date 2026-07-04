import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { updateDuplicateGroup } from "@/lib/candidate-workflow";
import type { DuplicateGroupStatus } from "@/types/content";

const allowedStatuses: DuplicateGroupStatus[] = ["open", "resolved", "ignored"];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      primaryCandidateId?: string;
      status?: DuplicateGroupStatus;
    };

    if (body.status && !allowedStatuses.includes(body.status)) {
      return NextResponse.json(
        { ok: false, message: "Unsupported duplicate group status." },
        { status: 400 }
      );
    }

    const group = updateDuplicateGroup(id, {
      primaryCandidateId: body.primaryCandidateId,
      status: body.status
    });

    revalidatePath("/workspace");
    revalidatePath("/workspace/candidates");
    revalidatePath("/workspace/duplicates");
    revalidatePath(`/workspace/duplicates/${id}`);

    for (const candidateId of group.candidateIds) {
      revalidatePath(`/workspace/candidates/${candidateId}`);
    }

    return NextResponse.json({ ok: true, group });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown duplicate update error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

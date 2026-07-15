import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { PublishReadinessError } from "@/lib/publish-readiness";
import {
  getSkillPublishReadiness,
  updateSkillWorkspaceStatus
} from "@/lib/skill-workflow";
import type { ContentWorkspaceStatus } from "@/types/content";

const allowedStatuses: ContentWorkspaceStatus[] = ["draft", "published"];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: ContentWorkspaceStatus };

    if (!body.status || !allowedStatuses.includes(body.status)) {
      return NextResponse.json(
        { ok: false, message: "Unsupported skill workspace status." },
        { status: 400 }
      );
    }

    const record = updateSkillWorkspaceStatus(id, body.status);
    const readiness =
      body.status === "published" ? getSkillPublishReadiness(id) : undefined;

    revalidatePath("/workspace");
    revalidatePath("/workspace/skills");
    revalidatePath(`/workspace/skills/${id}`);
    revalidatePath("/skills");
    revalidatePath(`/skills/${record.slug}`);
    revalidatePath("/network");

    return NextResponse.json({ ok: true, record, readiness });
  } catch (error) {
    if (error instanceof PublishReadinessError) {
      return NextResponse.json(
        {
          ok: false,
          message: "Publish readiness checks failed.",
          readiness: error.readiness
        },
        { status: 409 }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unknown skill workspace status update error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

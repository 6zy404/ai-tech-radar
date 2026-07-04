import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  getTechnologyWorkspacePublishReadiness,
  updateTechnologyWorkspaceStatus
} from "@/lib/technology-draft-workflow";
import { PublishReadinessError } from "@/lib/publish-readiness";
import type { TechnologyStatus } from "@/types/content";

const allowedStatuses: TechnologyStatus[] = ["draft", "published", "archived"];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: TechnologyStatus };

    if (!body.status || !allowedStatuses.includes(body.status)) {
      return NextResponse.json(
        { ok: false, message: "Unsupported technology workspace status." },
        { status: 400 }
      );
    }

    const record = updateTechnologyWorkspaceStatus(id, body.status);
    const readiness =
      body.status === "published"
        ? getTechnologyWorkspacePublishReadiness(id)
        : undefined;

    revalidatePath("/workspace");
    revalidatePath("/workspace/technologies");
    revalidatePath(`/workspace/technologies/${id}`);
    revalidatePath("/technologies");
    revalidatePath(`/technologies/${record.slug}`);
    revalidatePath("/");

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
        : "Unknown workspace status update error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

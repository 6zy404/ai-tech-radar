import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  DigestPublishReadinessError,
  updateDailyDigestStatus
} from "@/lib/digest-workflow";
import type { DailyDigestStatus } from "@/types/content";

const allowedStatuses: DailyDigestStatus[] = ["draft", "published", "archived"];

interface RouteContext {
  params: Promise<{ date: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { date } = await context.params;
    const body = (await request.json()) as { status?: DailyDigestStatus };

    if (!body.status || !allowedStatuses.includes(body.status)) {
      return NextResponse.json(
        { ok: false, message: "Unsupported digest status." },
        { status: 400 }
      );
    }

    const digest = updateDailyDigestStatus(date, body.status);

    revalidatePath("/workspace");
    revalidatePath("/workspace/digests");
    revalidatePath(`/workspace/digests/${date}`);
    revalidatePath(`/workspace/digests/${date}/preview`);
    revalidatePath("/digest/today");
    revalidatePath(`/digest/${date}`);

    return NextResponse.json({ ok: true, digest });
  } catch (error) {
    if (error instanceof DigestPublishReadinessError) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
          readiness: error.readiness
        },
        { status: 409 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown digest status update error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runScheduleById } from "@/lib/scheduled-delivery-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const run = await runScheduleById(id, {
      triggerType: "manual",
      force: true
    });

    revalidatePath("/workspace");
    revalidatePath("/workspace/delivery");
    revalidatePath("/workspace/delivery/schedules");
    if (run.digestDate) {
      revalidatePath(`/workspace/digests/${run.digestDate}`);
    }

    return NextResponse.json({ ok: true, run });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown schedule run error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

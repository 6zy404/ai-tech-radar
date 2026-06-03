import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { retryDeliveryRun } from "@/lib/delivery-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const run = await retryDeliveryRun(id);

    revalidatePath("/workspace");
    revalidatePath("/workspace/delivery");
    revalidatePath("/workspace/digests");
    revalidatePath(`/workspace/digests/${run.digestDate}`);

    return NextResponse.json({ ok: true, run });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown delivery retry error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

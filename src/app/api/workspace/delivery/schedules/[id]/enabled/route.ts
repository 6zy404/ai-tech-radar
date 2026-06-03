import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { setScheduledDeliveryEnabled } from "@/lib/scheduled-delivery-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { enabled?: boolean };
    const schedule = setScheduledDeliveryEnabled(id, Boolean(body.enabled));

    revalidatePath("/workspace");
    revalidatePath("/workspace/delivery/schedules");

    return NextResponse.json({ ok: true, schedule });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown schedule error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

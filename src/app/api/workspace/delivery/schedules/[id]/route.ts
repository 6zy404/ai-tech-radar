import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  coerceScheduledDeliveryInput,
  ScheduledDeliveryValidationError,
  updateScheduledDelivery
} from "@/lib/scheduled-delivery-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const schedule = updateScheduledDelivery(
      id,
      coerceScheduledDeliveryInput(body)
    );

    revalidatePath("/workspace");
    revalidatePath("/workspace/delivery");
    revalidatePath("/workspace/delivery/schedules");

    return NextResponse.json({ ok: true, schedule });
  } catch (error) {
    if (error instanceof ScheduledDeliveryValidationError) {
      return NextResponse.json(
        { ok: false, message: error.message, issues: error.issues },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown schedule error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

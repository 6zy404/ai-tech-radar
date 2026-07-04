import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  coerceScheduledDeliveryInput,
  createScheduledDelivery,
  getScheduledDeliveries,
  ScheduledDeliveryValidationError
} from "@/lib/scheduled-delivery-workflow";

export function GET() {
  return NextResponse.json({ ok: true, schedules: getScheduledDeliveries() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const schedule = createScheduledDelivery(
      coerceScheduledDeliveryInput(body)
    );

    revalidatePath("/workspace");
    revalidatePath("/workspace/delivery");
    revalidatePath("/workspace/delivery/schedules");

    return NextResponse.json({ ok: true, schedule }, { status: 201 });
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

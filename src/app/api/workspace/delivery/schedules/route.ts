import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  coerceScheduledDeliveryInput,
  createScheduledDelivery,
  getScheduledDeliveries,
  ScheduledDeliveryValidationError
} from "@/lib/scheduled-delivery-workflow";

// This GET reads the local store and takes no request argument, so nothing
// forces it dynamic on its own — it is dynamic today only because this file
// also exports POST. Declared explicitly so splitting the handlers apart
// cannot silently prerender a frozen copy of the store.
export const dynamic = "force-dynamic";

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

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  coerceDeliveryChannelInput,
  DeliveryChannelValidationError,
  updateDeliveryChannel
} from "@/lib/delivery-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const channel = updateDeliveryChannel(id, coerceDeliveryChannelInput(body));

    revalidatePath("/workspace");
    revalidatePath("/workspace/delivery");
    revalidatePath("/workspace/digests");

    return NextResponse.json({ ok: true, channel });
  } catch (error) {
    if (error instanceof DeliveryChannelValidationError) {
      return NextResponse.json(
        { ok: false, message: error.message, issues: error.issues },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unknown delivery channel error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  coerceDeliveryChannelInput,
  createDeliveryChannel,
  DeliveryChannelValidationError,
  getDeliveryChannels
} from "@/lib/delivery-workflow";

// This GET reads the local store and takes no request argument, so nothing
// forces it dynamic on its own — it is dynamic today only because this file
// also exports POST. Declared explicitly so splitting the handlers apart
// cannot silently prerender a frozen copy of the store.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, channels: getDeliveryChannels() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const channel = createDeliveryChannel(coerceDeliveryChannelInput(body));

    revalidatePath("/workspace");
    revalidatePath("/workspace/delivery");
    revalidatePath("/workspace/digests");

    return NextResponse.json({ ok: true, channel }, { status: 201 });
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

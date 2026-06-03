import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { setDeliveryChannelEnabled } from "@/lib/delivery-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { enabled?: boolean };
    const channel = setDeliveryChannelEnabled(id, Boolean(body.enabled));

    revalidatePath("/workspace");
    revalidatePath("/workspace/delivery");
    revalidatePath("/workspace/digests");

    return NextResponse.json({ ok: true, channel });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown delivery channel error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

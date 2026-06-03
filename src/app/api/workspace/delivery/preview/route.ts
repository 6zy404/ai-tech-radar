import { NextResponse } from "next/server";

import { getDeliveryPreview } from "@/lib/delivery-workflow";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      digestDate?: string;
      channelId?: string;
    };

    if (!body.digestDate || !body.channelId) {
      return NextResponse.json(
        { ok: false, message: "digestDate and channelId are required." },
        { status: 400 }
      );
    }

    const preview = getDeliveryPreview(body.digestDate, body.channelId);

    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown delivery preview error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

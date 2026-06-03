import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { sendDailyDigestToChannel } from "@/lib/delivery-workflow";

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

    const run = await sendDailyDigestToChannel({
      digestDate: body.digestDate,
      channelId: body.channelId
    });

    revalidatePath("/workspace");
    revalidatePath("/workspace/delivery");
    revalidatePath("/workspace/digests");
    revalidatePath(`/workspace/digests/${body.digestDate}`);

    return NextResponse.json({ ok: true, run });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown delivery send error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

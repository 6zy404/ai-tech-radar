import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runDueSchedules } from "@/lib/scheduled-delivery-workflow";

export async function POST() {
  try {
    const runs = await runDueSchedules();

    revalidatePath("/workspace");
    revalidatePath("/workspace/delivery");
    revalidatePath("/workspace/delivery/schedules");
    revalidatePath("/workspace/digests");

    return NextResponse.json({ ok: true, runs });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown due schedule run error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

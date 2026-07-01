import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getTodayDateString } from "@/lib/digest-store";
import { generateDailyDigest } from "@/lib/digest-workflow";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { date?: string };
    const date = body.date?.trim() || getTodayDateString();
    const digest = generateDailyDigest(date);

    revalidatePath("/workspace");
    revalidatePath("/workspace/digests");
    revalidatePath(`/workspace/digests/${digest.date}`);
    revalidatePath(`/workspace/digests/${digest.date}/preview`);
    revalidatePath("/digest/today");

    return NextResponse.json({ ok: true, digest });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown digest generation error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

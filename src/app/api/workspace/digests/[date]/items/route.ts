import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  type DailyDigestItemAction,
  updateDailyDigestItemControl
} from "@/lib/digest-workflow";

interface RouteContext {
  params: Promise<{ date: string }>;
}

const allowedActions: DailyDigestItemAction[] = [
  "exclude",
  "include",
  "pin",
  "unpin",
  "move_up",
  "move_down"
];

export async function POST(request: Request, context: RouteContext) {
  try {
    const { date } = await context.params;
    const body = (await request.json()) as {
      action?: DailyDigestItemAction;
      technologyId?: string;
    };

    if (!body.action || !allowedActions.includes(body.action)) {
      return NextResponse.json(
        { ok: false, message: "Unsupported digest item action." },
        { status: 400 }
      );
    }

    if (!body.technologyId?.trim()) {
      return NextResponse.json(
        { ok: false, message: "Technology ID is required." },
        { status: 400 }
      );
    }

    const digest = updateDailyDigestItemControl(
      date,
      body.technologyId.trim(),
      body.action
    );

    revalidatePath("/workspace");
    revalidatePath("/workspace/digests");
    revalidatePath(`/workspace/digests/${date}`);
    revalidatePath(`/workspace/digests/${date}/preview`);
    revalidatePath("/digest/today");
    revalidatePath(`/digest/${date}`);

    return NextResponse.json({ ok: true, digest });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown digest item update error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

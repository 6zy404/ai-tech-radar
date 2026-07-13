import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { updateScheduledImportConfig } from "@/lib/scheduled-import";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      enabled?: boolean;
      scheduleTime?: string;
    };
    const config = updateScheduledImportConfig({
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      scheduleTime:
        typeof body.scheduleTime === "string" ? body.scheduleTime : undefined
    });

    revalidatePath("/workspace");
    revalidatePath("/workspace/delivery/schedules");
    revalidatePath("/workspace/sources");

    return NextResponse.json({ ok: true, config });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "定时导入配置更新失败。";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

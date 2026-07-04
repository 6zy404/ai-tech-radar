import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { setExternalSourceEnabled } from "@/lib/source-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { enabled?: boolean };
    const source = setExternalSourceEnabled(id, Boolean(body.enabled));

    revalidatePath("/workspace");
    revalidatePath("/workspace/sources");
    revalidatePath(`/workspace/sources/${id}`);

    return NextResponse.json({ ok: true, source });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown source error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  coerceExternalSourceInput,
  ExternalSourceValidationError,
  updateExternalSource
} from "@/lib/source-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const source = updateExternalSource(id, coerceExternalSourceInput(body));

    revalidatePath("/workspace");
    revalidatePath("/workspace/sources");
    revalidatePath(`/workspace/sources/${id}`);

    return NextResponse.json({ ok: true, source });
  } catch (error) {
    if (error instanceof ExternalSourceValidationError) {
      return NextResponse.json(
        { ok: false, message: error.message, issues: error.issues },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown source error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

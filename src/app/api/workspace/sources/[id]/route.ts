import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  coerceExternalSourceInput,
  deleteExternalSource,
  ExternalSourceDeleteBlockedError,
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

    const message =
      error instanceof Error ? error.message : "Unknown source error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const source = deleteExternalSource(id);

    revalidatePath("/workspace");
    revalidatePath("/workspace/sources");
    revalidatePath(`/workspace/sources/${id}`);

    return NextResponse.json({
      ok: true,
      source: { id: source.id, name: source.name }
    });
  } catch (error) {
    if (error instanceof ExternalSourceDeleteBlockedError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 409 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown source error.";

    return NextResponse.json(
      { ok: false, message },
      { status: message.startsWith("未找到") ? 404 : 500 }
    );
  }
}

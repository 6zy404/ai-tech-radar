import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  coerceExternalSourceInput,
  createExternalSource,
  ExternalSourceValidationError,
  getExternalSources
} from "@/lib/source-workflow";

// This GET reads the local store and takes no request argument, so nothing
// forces it dynamic on its own — it is dynamic today only because this file
// also exports POST. Declared explicitly so splitting the handlers apart
// cannot silently prerender a frozen copy of the store.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, sources: getExternalSources() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const source = createExternalSource(coerceExternalSourceInput(body));

    revalidatePath("/workspace");
    revalidatePath("/workspace/sources");

    return NextResponse.json({ ok: true, source }, { status: 201 });
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

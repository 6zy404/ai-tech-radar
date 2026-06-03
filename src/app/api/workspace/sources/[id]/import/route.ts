import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runImportForSource } from "@/lib/source-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await runImportForSource(id);

    revalidatePath("/workspace");
    revalidatePath("/workspace/sources");
    revalidatePath(`/workspace/sources/${id}`);
    revalidatePath("/workspace/candidates");

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown import error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

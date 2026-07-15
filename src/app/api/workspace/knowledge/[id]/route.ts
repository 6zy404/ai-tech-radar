import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  getKnowledgeWorkspaceEntryById,
  updateKnowledgeWorkspaceRecord
} from "@/lib/knowledge-workflow";
import { isRecord, parseKnowledgeWorkspaceUpdate } from "../parse";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existingEntry = getKnowledgeWorkspaceEntryById(id);

    if (!existingEntry) {
      return NextResponse.json(
        { ok: false, message: "Knowledge workspace entry was not found." },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { ok: false, message: "Invalid knowledge workspace update payload." },
        { status: 400 }
      );
    }

    const record = updateKnowledgeWorkspaceRecord(
      id,
      parseKnowledgeWorkspaceUpdate(body)
    );

    revalidatePath("/workspace");
    revalidatePath("/workspace/knowledge");
    revalidatePath(`/workspace/knowledge/${id}`);
    revalidatePath("/knowledge");
    revalidatePath(`/knowledge/${existingEntry.item.slug}`);
    revalidatePath(`/knowledge/${record.slug}`);
    revalidatePath("/network");

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown knowledge workspace update error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

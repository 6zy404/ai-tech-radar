import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  getSkillWorkspaceEntryById,
  updateSkillWorkspaceRecord
} from "@/lib/skill-workflow";
import { isRecord, parseSkillWorkspaceUpdate } from "../parse";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existingEntry = getSkillWorkspaceEntryById(id);

    if (!existingEntry) {
      return NextResponse.json(
        { ok: false, message: "Skill workspace entry was not found." },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { ok: false, message: "Invalid skill workspace update payload." },
        { status: 400 }
      );
    }

    const record = updateSkillWorkspaceRecord(
      id,
      parseSkillWorkspaceUpdate(body)
    );

    revalidatePath("/workspace");
    revalidatePath("/workspace/skills");
    revalidatePath(`/workspace/skills/${id}`);
    revalidatePath("/skills");
    revalidatePath(`/skills/${existingEntry.item.slug}`);
    revalidatePath(`/skills/${record.slug}`);
    revalidatePath("/network");

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown skill workspace update error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

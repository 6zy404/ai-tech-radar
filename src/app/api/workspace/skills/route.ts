import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createSkillWorkspaceRecord } from "@/lib/skill-workflow";
import { isRecord, parseSkillWorkspaceUpdate } from "./parse";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { ok: false, message: "Invalid skill workspace payload." },
        { status: 400 }
      );
    }

    const record = createSkillWorkspaceRecord(parseSkillWorkspaceUpdate(body));

    revalidatePath("/workspace");
    revalidatePath("/workspace/skills");

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown skill workspace create error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

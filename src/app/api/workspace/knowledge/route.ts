import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createKnowledgeWorkspaceRecord } from "@/lib/knowledge-workflow";
import { isRecord, parseKnowledgeWorkspaceUpdate } from "./parse";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { ok: false, message: "Invalid knowledge workspace payload." },
        { status: 400 }
      );
    }

    const record = createKnowledgeWorkspaceRecord(
      parseKnowledgeWorkspaceUpdate(body)
    );

    revalidatePath("/workspace");
    revalidatePath("/workspace/knowledge");

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown knowledge workspace create error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { updateDailyDigest } from "@/lib/digest-workflow";

interface RouteContext {
  params: Promise<{ date: string }>;
}

interface DigestPatchBody {
  title?: string;
  summary?: string;
  editorialSummary?: string;
  editorialNotes?: string;
}

function parseEditorialNotes(value: string | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { date } = await context.params;
    const body = (await request.json()) as DigestPatchBody;
    const digest = updateDailyDigest(date, {
      title: body.title,
      summary: body.summary,
      editorialSummary: body.editorialSummary,
      editorialNotes: parseEditorialNotes(body.editorialNotes)
    });

    revalidatePath("/workspace");
    revalidatePath("/workspace/digests");
    revalidatePath(`/workspace/digests/${date}`);
    revalidatePath(`/workspace/digests/${date}/preview`);
    revalidatePath("/digest/today");
    revalidatePath(`/digest/${date}`);

    return NextResponse.json({ ok: true, digest });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown digest update error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

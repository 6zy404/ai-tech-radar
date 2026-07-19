import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  type LinkRelationTargetUpdate,
  syncLinkRelationsForEntity
} from "@/lib/link-relation-workflow";
import type { ContentKind, RelationType } from "@/types/content";

const contentKinds: ContentKind[] = ["technology", "skill", "knowledge"];
const relationTypes: RelationType[] = [
  "builds-on",
  "uses",
  "explains",
  "requires",
  "extends",
  "supports",
  "related-to"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTargets(value: unknown): LinkRelationTargetUpdate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      toId: typeof item.toId === "string" ? item.toId.trim() : "",
      toType: item.toType as ContentKind,
      relationType: item.relationType as RelationType,
      note: typeof item.note === "string" ? item.note : undefined
    }))
    .filter(
      (item) =>
        item.toId.length > 0 &&
        contentKinds.includes(item.toType) &&
        relationTypes.includes(item.relationType)
    );
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { ok: false, message: "Invalid relation update payload." },
        { status: 400 }
      );
    }

    const fromId = typeof body.fromId === "string" ? body.fromId.trim() : "";
    const fromType = body.fromType as ContentKind;

    if (!fromId || !contentKinds.includes(fromType)) {
      return NextResponse.json(
        { ok: false, message: "A valid relation source entity is required." },
        { status: 400 }
      );
    }

    const changedPairs = syncLinkRelationsForEntity(
      { id: fromId, type: fromType },
      parseTargets(body.targets)
    );

    if (changedPairs > 0) {
      revalidatePath("/technologies");
      revalidatePath("/skills");
      revalidatePath("/knowledge");
      revalidatePath("/network");
    }

    return NextResponse.json({ ok: true, changedPairs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown relation update error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { PublishReadinessError } from "@/lib/publish-readiness";
import { isRadarQuadrant, isRadarRing } from "@/lib/radar-labels";
import {
  createRadarWorkspaceRecord,
  getRadarWorkspaceEntryById,
  updateRadarWorkspaceRecord,
  updateRadarWorkspaceStatus,
  type RadarWorkspaceUpdate
} from "@/lib/radar-workflow";
import type { RadarWorkspaceStatus } from "@/types/radar";

// The radar console's three routes: create, edit, publish/unpublish. Lives
// under api/workspace, so the workspace guard covers it and the public build
// drops it with the rest of the workspace.

interface RouteContext {
  params: Promise<{ id: string }>;
}

const allowedStatuses: RadarWorkspaceStatus[] = ["draft", "published"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

export function parseRadarUpdate(
  body: Record<string, unknown>
): RadarWorkspaceUpdate {
  return {
    name: getString(body.name),
    slug: getString(body.slug),
    quadrant: isRadarQuadrant(body.quadrant) ? body.quadrant : undefined,
    ring: isRadarRing(body.ring) ? body.ring : undefined,
    ringReason: getString(body.ringReason),
    changeReason: getString(body.changeReason),
    evidenceTechnologyIds: getStringArray(body.evidenceTechnologyIds),
    relatedKnowledgeIds: getStringArray(body.relatedKnowledgeIds),
    relatedSkillIds: getStringArray(body.relatedSkillIds)
  };
}

function revalidateRadar(id?: string) {
  revalidatePath("/workspace/radar");
  if (id) {
    revalidatePath(`/workspace/radar/${id}`);
  }
  revalidatePath("/radar");
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;

  return NextResponse.json({ ok: false, message }, { status: 500 });
}

export async function createRadarEntry(request: Request) {
  try {
    const body = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { ok: false, message: "Invalid radar workspace payload." },
        { status: 400 }
      );
    }

    const record = createRadarWorkspaceRecord(parseRadarUpdate(body));

    revalidateRadar();

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return errorResponse(error, "Unknown radar workspace create error.");
  }
}

export async function updateRadarEntry(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!getRadarWorkspaceEntryById(id)) {
      return NextResponse.json(
        { ok: false, message: "Radar workspace entry was not found." },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { ok: false, message: "Invalid radar workspace update payload." },
        { status: 400 }
      );
    }

    const record = updateRadarWorkspaceRecord(id, parseRadarUpdate(body));

    revalidateRadar(id);

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return errorResponse(error, "Unknown radar workspace update error.");
  }
}

export async function updateRadarEntryStatus(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: RadarWorkspaceStatus };

    if (!body.status || !allowedStatuses.includes(body.status)) {
      return NextResponse.json(
        { ok: false, message: "Unsupported radar workspace status." },
        { status: 400 }
      );
    }

    const record = updateRadarWorkspaceStatus(id, body.status);

    revalidateRadar(id);

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    if (error instanceof PublishReadinessError) {
      return NextResponse.json(
        {
          ok: false,
          message: "Publish readiness checks failed.",
          readiness: error.readiness
        },
        { status: 409 }
      );
    }

    return errorResponse(error, "Unknown radar workspace status error.");
  }
}

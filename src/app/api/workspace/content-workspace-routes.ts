import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import type {
  ContentWorkspaceBaseItem,
  ContentWorkspaceEntryOf,
  ContentWorkspaceRecordOf,
  ContentWorkspaceUpdateOf
} from "@/lib/content-workspace-workflow";
import {
  PublishReadinessError,
  type PublishReadinessResult
} from "@/lib/publish-readiness";
import type { ContentWorkspaceStatus } from "@/types/content";

// The three workspace routes of the skill and knowledge consoles — create,
// edit, publish/unpublish — built once from the kind's workflow functions.
// Lives under api/workspace so the public build drops it with the routes.

const allowedStatuses: ContentWorkspaceStatus[] = ["draft", "published"];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getEnumValue(
  value: unknown,
  allowedValues: readonly string[]
): string | undefined {
  return typeof value === "string" && allowedValues.includes(value)
    ? value
    : undefined;
}

interface ContentWorkspaceRouteKind<TItem extends ContentWorkspaceBaseItem> {
  /** "skill" / "knowledge", as it appears in the English error messages. */
  label: string;
  workspacePath: string;
  publicPath: string;
  /** Enum-valued fields and their allowed values. */
  enums: Partial<Record<keyof TItem & string, readonly string[]>>;
  relatedIdsKey: keyof TItem & string;
  getEntryById: (id: string) => ContentWorkspaceEntryOf<TItem> | undefined;
  getPublishReadiness: (id: string) => PublishReadinessResult;
  createRecord: (
    update: ContentWorkspaceUpdateOf<TItem>
  ) => ContentWorkspaceRecordOf<TItem>;
  updateRecord: (
    id: string,
    update: ContentWorkspaceUpdateOf<TItem>
  ) => ContentWorkspaceRecordOf<TItem>;
  updateStatus: (
    id: string,
    status: ContentWorkspaceStatus
  ) => ContentWorkspaceRecordOf<TItem>;
}

export function createContentWorkspaceRoutes<
  TItem extends ContentWorkspaceBaseItem
>(kind: ContentWorkspaceRouteKind<TItem>) {
  const capitalLabel = kind.label[0].toUpperCase() + kind.label.slice(1);

  function parseUpdate(
    body: Record<string, unknown>
  ): ContentWorkspaceUpdateOf<TItem> {
    const update: Record<string, unknown> = {
      title: getString(body.title),
      slug: getString(body.slug),
      summary: getString(body.summary),
      content: getString(body.content)
    };

    for (const [key, values] of Object.entries(kind.enums)) {
      update[key] = getEnumValue(body[key], values as readonly string[]);
    }

    update.tags = getStringArray(body.tags);
    update.relatedTechnologyIds = getStringArray(body.relatedTechnologyIds);
    update[kind.relatedIdsKey] = getStringArray(body[kind.relatedIdsKey]);

    return update as ContentWorkspaceUpdateOf<TItem>;
  }

  function errorResponse(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }

  async function create(request: Request) {
    try {
      const body = await request.json();

      if (!isRecord(body)) {
        return NextResponse.json(
          { ok: false, message: `Invalid ${kind.label} workspace payload.` },
          { status: 400 }
        );
      }

      const record = kind.createRecord(parseUpdate(body));

      revalidatePath("/workspace");
      revalidatePath(kind.workspacePath);

      return NextResponse.json({ ok: true, record });
    } catch (error) {
      return errorResponse(
        error,
        `Unknown ${kind.label} workspace create error.`
      );
    }
  }

  async function update(request: Request, context: RouteContext) {
    try {
      const { id } = await context.params;
      const existingEntry = kind.getEntryById(id);

      if (!existingEntry) {
        return NextResponse.json(
          {
            ok: false,
            message: `${capitalLabel} workspace entry was not found.`
          },
          { status: 404 }
        );
      }

      const body = await request.json();

      if (!isRecord(body)) {
        return NextResponse.json(
          {
            ok: false,
            message: `Invalid ${kind.label} workspace update payload.`
          },
          { status: 400 }
        );
      }

      const record = kind.updateRecord(id, parseUpdate(body));

      revalidatePath("/workspace");
      revalidatePath(kind.workspacePath);
      revalidatePath(`${kind.workspacePath}/${id}`);
      revalidatePath(kind.publicPath);
      revalidatePath(`${kind.publicPath}/${existingEntry.item.slug}`);
      revalidatePath(`${kind.publicPath}/${record.slug}`);
      revalidatePath("/network");

      return NextResponse.json({ ok: true, record });
    } catch (error) {
      return errorResponse(
        error,
        `Unknown ${kind.label} workspace update error.`
      );
    }
  }

  async function updateStatus(request: Request, context: RouteContext) {
    try {
      const { id } = await context.params;
      const body = (await request.json()) as {
        status?: ContentWorkspaceStatus;
      };

      if (!body.status || !allowedStatuses.includes(body.status)) {
        return NextResponse.json(
          { ok: false, message: `Unsupported ${kind.label} workspace status.` },
          { status: 400 }
        );
      }

      const record = kind.updateStatus(id, body.status);
      const readiness =
        body.status === "published" ? kind.getPublishReadiness(id) : undefined;

      revalidatePath("/workspace");
      revalidatePath(kind.workspacePath);
      revalidatePath(`${kind.workspacePath}/${id}`);
      revalidatePath(kind.publicPath);
      revalidatePath(`${kind.publicPath}/${record.slug}`);
      revalidatePath("/network");

      return NextResponse.json({ ok: true, record, readiness });
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

      return errorResponse(
        error,
        `Unknown ${kind.label} workspace status update error.`
      );
    }
  }

  return { parseUpdate, create, update, updateStatus };
}

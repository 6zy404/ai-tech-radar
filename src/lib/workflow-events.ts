import { randomUUID } from "node:crypto";

import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "@/lib/repositories/local-json-store";
import type {
  WorkflowEvent,
  WorkflowEventAction,
  WorkflowEventActorType
} from "@/types/content";

interface WorkflowEventStore {
  updatedAt: string;
  events: WorkflowEvent[];
}

export interface WorkflowEventInput {
  entityType: string;
  entityId: string;
  action: WorkflowEventAction | string;
  actorType?: WorkflowEventActorType;
  actorId?: string;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  metadata?: Record<string, unknown>;
}

const workflowEventStorePath = getLocalStoreFilePath("workflow-events.json");
const maxStoredEvents = 500;
const sensitiveKeyPattern =
  /endpoint|url|token|secret|signature|authorization|password|key/i;

function getTimestamp(): string {
  return new Date().toISOString();
}

function maskSensitiveUrl(value: string): string {
  try {
    const url = new URL(value);

    if (/token|key|secret|signature|auth/i.test(url.pathname)) {
      url.pathname = url.pathname
        .split("/")
        .map((segment, index, segments) =>
          index === segments.length - 1 && segment ? "***" : segment
        )
        .join("/");
    }

    for (const key of Array.from(url.searchParams.keys())) {
      if (/token|key|secret|signature|auth/i.test(key)) {
        url.searchParams.set(key, "***");
      }
    }

    return url.toString();
  } catch {
    return value.replace(
      /(token|key|secret|signature|auth)=([^&\s]+)/gi,
      "$1=***"
    );
  }
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        if (sensitiveKeyPattern.test(key)) {
          return [
            key,
            typeof item === "string" ? maskSensitiveUrl(item) : "[redacted]"
          ];
        }

        return [key, sanitizeValue(item)];
      })
    );
  }

  return value;
}

function normalizeWorkflowEvent(value: WorkflowEvent): WorkflowEvent {
  return {
    ...value,
    actorType: value.actorType ?? "system",
    createdAt: value.createdAt ?? getTimestamp(),
    beforeSnapshot: sanitizeValue(value.beforeSnapshot),
    afterSnapshot: sanitizeValue(value.afterSnapshot),
    metadata: value.metadata
      ? (sanitizeValue(value.metadata) as Record<string, unknown>)
      : undefined
  };
}

function getDefaultWorkflowEventStore(): WorkflowEventStore {
  return {
    updatedAt: getTimestamp(),
    events: []
  };
}

function readWorkflowEventStore(): WorkflowEventStore {
  const store = readLocalJsonFile<WorkflowEventStore>(
    workflowEventStorePath,
    getDefaultWorkflowEventStore()
  );

  return {
    updatedAt: store.updatedAt ?? getTimestamp(),
    events: (store.events ?? [])
      .map((event) => normalizeWorkflowEvent(event))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  };
}

function writeWorkflowEventStore(store: WorkflowEventStore) {
  writeLocalJsonFile(workflowEventStorePath, {
    updatedAt: getTimestamp(),
    events: store.events
      .map((event) => normalizeWorkflowEvent(event))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, maxStoredEvents)
  });
}

export function recordWorkflowEvent(input: WorkflowEventInput): WorkflowEvent {
  const store = readWorkflowEventStore();
  const event: WorkflowEvent = normalizeWorkflowEvent({
    id: `workflow-event-${randomUUID()}`,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorType: input.actorType ?? "system",
    actorId: input.actorId,
    beforeSnapshot: input.beforeSnapshot,
    afterSnapshot: input.afterSnapshot,
    metadata: input.metadata,
    createdAt: getTimestamp()
  });

  writeWorkflowEventStore({
    updatedAt: getTimestamp(),
    events: [event, ...store.events.filter((item) => item.id !== event.id)]
  });

  return event;
}

export function recordWorkflowError(
  input: Omit<WorkflowEventInput, "metadata"> & {
    error: unknown;
    metadata?: Record<string, unknown>;
  }
): WorkflowEvent {
  const message =
    input.error instanceof Error ? input.error.message : "Unknown workflow error.";

  return recordWorkflowEvent({
    ...input,
    metadata: {
      ...input.metadata,
      errorMessage: message
    }
  });
}

export function tryRecordWorkflowEvent(
  input: WorkflowEventInput
): WorkflowEvent | undefined {
  try {
    return recordWorkflowEvent(input);
  } catch {
    return undefined;
  }
}

export function tryRecordWorkflowError(
  input: Parameters<typeof recordWorkflowError>[0]
): WorkflowEvent | undefined {
  try {
    return recordWorkflowError(input);
  } catch {
    return undefined;
  }
}

export function getWorkflowEvents(): WorkflowEvent[] {
  return readWorkflowEventStore().events;
}

export function getWorkflowEventsForEntity(
  entityType: string,
  entityId: string,
  limit = 8
): WorkflowEvent[] {
  return getWorkflowEvents()
    .filter(
      (event) => event.entityType === entityType && event.entityId === entityId
    )
    .slice(0, limit);
}

export function getRecentWorkflowEvents(
  options: {
    entityTypes?: string[];
    actions?: string[];
    limit?: number;
  } = {}
): WorkflowEvent[] {
  const entityTypeSet = options.entityTypes
    ? new Set(options.entityTypes)
    : undefined;
  const actionSet = options.actions ? new Set(options.actions) : undefined;

  return getWorkflowEvents()
    .filter((event) => {
      if (entityTypeSet && !entityTypeSet.has(event.entityType)) {
        return false;
      }

      if (actionSet && !actionSet.has(event.action)) {
        return false;
      }

      return true;
    })
    .slice(0, options.limit ?? 10);
}

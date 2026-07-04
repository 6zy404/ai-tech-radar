import assert from "node:assert/strict";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

process.env.PERSISTENCE_DRIVER = "json";

import { getCandidateWorkflowData } from "../src/lib/candidate-workflow";
import {
  getDigestDeliveryFeed,
  renderDigestJsonFeed
} from "../src/lib/digest-delivery";
import { getAllTechnologies } from "../src/lib/content";
import {
  getSystemHealthSummary,
  sanitizeOperationsText
} from "../src/lib/operations-metrics";
import { getWorkflowEvents } from "../src/lib/workflow-events";
import type {
  DailyDigest,
  DeliveryChannel,
  DeliveryRun,
  DuplicateGroup,
  ExternalSource,
  ImportedCandidate,
  ImportedCandidateSnapshot,
  ScheduledDelivery,
  ScheduledDeliveryRun,
  TaskRunnerRun,
  WorkflowEvent
} from "../src/types/content";

type BackupEntry =
  { kind: "missing" } | { kind: "file"; value: string } | { kind: "directory" };

const configDirPath = path.join(process.cwd(), "config");
const externalSourceStorePath = path.join(
  configDirPath,
  "external-sources.json"
);
const importedCandidateStorePath = path.join(
  configDirPath,
  "imported-candidates.live.json"
);
const candidateReviewStatePath = path.join(
  configDirPath,
  "candidate-review-state.json"
);
const duplicateGroupStorePath = path.join(
  configDirPath,
  "duplicate-groups.json"
);
const deliveryStorePath = path.join(configDirPath, "delivery.json");
const scheduleStorePath = path.join(configDirPath, "scheduled-delivery.json");
const taskRunnerStorePath = path.join(configDirPath, "task-runner.json");
const workflowEventStorePath = path.join(configDirPath, "workflow-events.json");
const digestStorePath = path.join(configDirPath, "daily-digests.json");
const now = "2026-05-29T09:00:00.000Z";
const secretUrl = "https://hooks.example.test/send?token=super-secret-token";
const internalTerms = [
  "WorkflowEvent",
  "AuditLog",
  "workflow-events.json",
  "DeliveryRun",
  "ScheduledDelivery",
  "TaskRunner",
  "endpointUrl",
  "super-secret-token",
  "task-runner"
];

function backupEntry(filePath: string): BackupEntry {
  if (!existsSync(filePath)) {
    return { kind: "missing" };
  }

  if (lstatSync(filePath).isDirectory()) {
    return { kind: "directory" };
  }

  return { kind: "file", value: readFileSync(filePath, "utf8") };
}

function removePath(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  if (lstatSync(filePath).isDirectory()) {
    rmSync(filePath, { recursive: true, force: true });
    return;
  }

  unlinkSync(filePath);
}

function restoreEntry(filePath: string, backup: BackupEntry) {
  removePath(filePath);

  if (backup.kind === "file") {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, backup.value, "utf8");
  }

  if (backup.kind === "directory") {
    mkdirSync(filePath, { recursive: true });
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertNoInternalTerms(value: unknown, label: string) {
  const serializedValue =
    typeof value === "string" ? value : JSON.stringify(value);

  for (const term of internalTerms) {
    assert.equal(
      serializedValue.includes(term),
      false,
      `${label} should not expose internal operations term ${term}.`
    );
  }
}

function writeFixtureStores() {
  const failedSource: ExternalSource = {
    id: "operations-failed-source",
    name: "Operations Failed Source",
    type: "rss",
    url: "https://example.test/feed.xml",
    enabled: true,
    description: "Fixture source for operations validation.",
    language: "en",
    publisherName: "Operations Publisher",
    publisherType: "media",
    defaultTags: ["operations"],
    defaultNormalizedType: "tool",
    lastFetchedAt: now,
    lastImportStatus: "failed",
    lastImportMessage: `Import failed while reading ${secretUrl}`,
    lastImportCount: 0,
    lastErrorMessage: `Import failed while reading ${secretUrl}`,
    consecutiveFailureCount: 3,
    totalImportedCount: 0,
    createdAt: now,
    updatedAt: now
  };
  const candidate: ImportedCandidate = {
    id: "operations-candidate-missing-content",
    sourceId: failedSource.id,
    sourceType: "rss-feed",
    sourceName: failedSource.name,
    sourceUrl: "https://example.test/candidates/operations",
    originalTitle: "Operations candidate with missing fields",
    originalSummary: "",
    originalContent: "",
    originalLanguage: "en",
    publishDate: "invalid-date",
    publisherName: "",
    normalizedType: "tool",
    tags: [],
    importStatus: "new",
    duplicateGroupId: "duplicate-group-operations",
    relatedCandidateIds: [],
    importedAt: now,
    rawPayload: {
      sourceId: failedSource.id,
      endpointUrl: secretUrl
    }
  };
  const duplicateCandidate: ImportedCandidate = {
    ...candidate,
    id: "operations-candidate-duplicate",
    originalTitle: "Operations candidate with missing fields",
    importedAt: now,
    rawPayload: {
      sourceId: failedSource.id,
      endpointUrl: secretUrl,
      duplicateFixture: true
    }
  };
  const snapshot: ImportedCandidateSnapshot = {
    syncedAt: now,
    sources: [
      {
        id: failedSource.id,
        sourceType: "rss-feed",
        sourceName: failedSource.name,
        sourceUrl: failedSource.url,
        syncStatus: "fallback",
        itemCount: 2,
        fetchedAt: now
      }
    ],
    candidates: [candidate, duplicateCandidate]
  };
  const duplicateGroup: DuplicateGroup = {
    id: "duplicate-group-operations",
    candidateIds: [candidate.id, duplicateCandidate.id],
    primaryCandidateId: candidate.id,
    status: "open",
    reasons: ["same_source_url"],
    createdAt: now,
    updatedAt: now
  };
  const channel: DeliveryChannel = {
    id: "operations-channel",
    name: "Operations Channel",
    type: "webhook",
    enabled: true,
    endpointUrl: secretUrl,
    description: "Fixture delivery channel.",
    format: "json",
    lastDeliveryStatus: "failed",
    lastDeliveryMessage: `Failed to send ${secretUrl}`,
    createdAt: now,
    updatedAt: now
  };
  const failedDeliveryRun: DeliveryRun = {
    id: "operations-delivery-run",
    digestId: "digest-operations",
    digestDate: "2026-05-29",
    channelId: channel.id,
    channelName: channel.name,
    channelType: channel.type,
    status: "failed",
    startedAt: now,
    finishedAt: now,
    requestPayloadPreview: "payload",
    errorMessage: `Webhook rejected ${secretUrl}`
  };
  const schedule: ScheduledDelivery = {
    id: "operations-schedule",
    name: "Operations Schedule",
    enabled: true,
    digestTarget: "digest_by_date",
    digestDate: "2026-05-29",
    channelIds: [channel.id],
    scheduleTime: "09:00",
    timezone: "Asia/Shanghai",
    lastRunAt: now,
    nextRunAt: "2026-05-30T01:00:00.000Z",
    lastRunStatus: "failed",
    lastRunMessage: "One channel failed.",
    createdAt: now,
    updatedAt: now
  };
  const failedScheduledRun: ScheduledDeliveryRun = {
    id: "operations-scheduled-run",
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    digestId: "digest-operations",
    digestDate: "2026-05-29",
    startedAt: now,
    finishedAt: now,
    status: "failed",
    totalChannels: 1,
    successfulChannels: 0,
    failedChannels: 1,
    skippedChannels: 0,
    deliveryLogIds: [failedDeliveryRun.id],
    triggerType: "scheduled",
    message: `Failed channel ${secretUrl}`
  };
  const taskRun: TaskRunnerRun = {
    id: "operations-task-run",
    mode: "run_once",
    startedAt: now,
    finishedAt: now,
    status: "failed",
    dueScheduleCount: 1,
    skippedScheduleCount: 0,
    successCount: 0,
    failedCount: 1,
    partialCount: 0,
    deliveryLogsCreated: 1,
    messages: [`Runner failed ${secretUrl}`]
  };
  const workflowEvents: WorkflowEvent[] = [
    {
      id: "operations-event-failure",
      entityType: "daily_digest",
      entityId: "digest-operations",
      action: "digest.publish_failed",
      actorType: "workspace_user",
      metadata: {
        errorMessage: `Publish failed ${secretUrl}`
      },
      createdAt: now
    },
    {
      id: "operations-event-source",
      entityType: "source",
      entityId: failedSource.id,
      action: "source.imported",
      actorType: "workspace_user",
      metadata: {
        status: "failed",
        message: `Source failed ${secretUrl}`
      },
      createdAt: now
    }
  ];
  const digest: DailyDigest = {
    id: "digest-operations",
    date: "2026-05-29",
    status: "draft",
    title: "Operations digest draft",
    summary: "Workspace-only fixture digest.",
    highPriorityTechnologyIds: [],
    watchTechnologyIds: [],
    manuallyAddedTechnologyIds: [],
    excludedTechnologyIds: [],
    pinnedTechnologyIds: [],
    orderedTechnologyIds: [],
    skillIds: [],
    knowledgeIds: [],
    sourceNames: [],
    generatedAt: now,
    updatedAt: now,
    editorialNotes: []
  };

  writeJsonFile(externalSourceStorePath, {
    updatedAt: now,
    sources: [failedSource],
    latestImportRun: {
      id: "operations-import-run",
      startedAt: now,
      finishedAt: now,
      status: "failed",
      totalSources: 1,
      enabledSources: 1,
      skippedSources: 0,
      successfulSources: 0,
      failedSources: 1,
      partialSources: 0,
      totalCandidatesCreated: 0,
      totalCandidatesSkipped: 0,
      messages: ["Operations source failed."],
      sourceResults: [
        {
          sourceId: failedSource.id,
          sourceName: failedSource.name,
          status: "failed",
          message: "Operations source failed.",
          candidateCount: 0,
          candidatesCreated: 0,
          candidatesSkipped: 0
        }
      ]
    },
    importRuns: []
  });
  writeJsonFile(importedCandidateStorePath, snapshot);
  writeJsonFile(candidateReviewStatePath, { updatedAt: now, items: {} });
  writeJsonFile(duplicateGroupStorePath, {
    updatedAt: now,
    groups: [duplicateGroup]
  });
  writeJsonFile(deliveryStorePath, {
    updatedAt: now,
    channels: [channel],
    runs: [failedDeliveryRun]
  });
  writeJsonFile(scheduleStorePath, {
    updatedAt: now,
    schedules: [schedule],
    runs: [failedScheduledRun]
  });
  writeJsonFile(taskRunnerStorePath, { updatedAt: now, runs: [taskRun] });
  writeJsonFile(workflowEventStorePath, {
    updatedAt: now,
    events: workflowEvents
  });
  writeJsonFile(digestStorePath, { updatedAt: now, digests: [digest] });
}

function assertPublicSourceIsolation() {
  assertNoInternalTerms(getAllTechnologies(), "User-facing technologies");
  assertNoInternalTerms(getDigestDeliveryFeed(), "Public digest feed");
  assertNoInternalTerms(renderDigestJsonFeed(), "Public JSON feed");
}

function assertRouteFilesExist() {
  assert.ok(
    existsSync(
      path.join(process.cwd(), "src/app/workspace/operations/page.tsx")
    ),
    "/workspace/operations page file should exist."
  );
  assert.ok(
    existsSync(
      path.join(process.cwd(), "src/app/workspace/operations/events/page.tsx")
    ),
    "/workspace/operations/events page file should exist."
  );
}

function assertWorkspaceNavHasOperations() {
  const navSource = readFileSync(
    path.join(process.cwd(), "src/components/workspace-nav.tsx"),
    "utf8"
  );

  assert.equal(
    navSource.includes("/workspace/operations"),
    true,
    "Workspace nav should include Operations."
  );
}

function main() {
  const storePaths = [
    externalSourceStorePath,
    importedCandidateStorePath,
    candidateReviewStatePath,
    duplicateGroupStorePath,
    deliveryStorePath,
    scheduleStorePath,
    taskRunnerStorePath,
    workflowEventStorePath,
    digestStorePath
  ];
  const backups = new Map<string, BackupEntry>(
    storePaths.map((filePath) => [filePath, backupEntry(filePath)])
  );

  try {
    writeFixtureStores();

    const operations = getSystemHealthSummary();

    assert.equal(
      ["critical", "warning", "healthy", "unknown"].includes(operations.status),
      true,
      "System health summary should calculate a known status."
    );
    assert.equal(operations.status, "critical");
    assert.ok(
      operations.attentionItems.some((item) => item.source === "Source import"),
      "Failed source import should appear in attention required."
    );
    assert.equal(
      operations.failedDeliveries.some(
        (run) => run.runId === "operations-delivery-run"
      ),
      true,
      "Failed delivery should appear in failed delivery summary."
    );
    assert.equal(
      operations.failedScheduledRuns.some(
        (run) => run.runId === "operations-scheduled-run"
      ),
      true,
      "Failed scheduled run should appear in operations summary."
    );
    assert.ok(
      getWorkflowEvents().some(
        (event) => event.id === "operations-event-failure"
      ),
      "WorkflowEvent records should be queryable."
    );
    assert.equal(
      getCandidateWorkflowData().duplicateGroups.some(
        (group) =>
          group.candidateIds.includes("operations-candidate-missing-content") &&
          group.candidateIds.includes("operations-candidate-duplicate")
      ),
      true,
      "Duplicate groups should remain available to operations."
    );
    assert.equal(
      sanitizeOperationsText(`Failed ${secretUrl}`).includes(
        "super-secret-token"
      ),
      false,
      "Operations text sanitizer should hide token-like values."
    );
    assert.equal(
      JSON.stringify(operations).includes("super-secret-token"),
      false,
      "Operations metrics should not expose token values."
    );
    assert.equal(
      JSON.stringify(operations).includes(secretUrl),
      false,
      "Operations metrics should not expose full endpoint URLs."
    );

    assertPublicSourceIsolation();
    assertWorkspaceNavHasOperations();
    assertRouteFilesExist();

    console.log("Operations validation passed.");
  } finally {
    for (const [filePath, backup] of backups) {
      restoreEntry(filePath, backup);
    }
  }
}

main();

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

import {
  convertImportedCandidateToDraft,
  getCandidateWorkflowData,
  getImportedCandidateById,
  updateDuplicateGroup
} from "../src/lib/candidate-workflow";
import {
  getTechnologyWorkspaceRecords,
  updateTechnologyWorkspaceRecord,
  updateTechnologyWorkspaceStatus
} from "../src/lib/technology-draft-workflow";
import { getAllTechnologies } from "../src/lib/content";
import { createDeliveryChannel, sendDailyDigestToChannel } from "../src/lib/delivery-workflow";
import { getDigestDeliveryFeed } from "../src/lib/digest-delivery";
import {
  evaluateDailyDigestPublishReadiness,
  publishDailyDigest
} from "../src/lib/digest-workflow";
import {
  createScheduledDelivery,
  runScheduleById
} from "../src/lib/scheduled-delivery-workflow";
import {
  getRecentWorkflowEvents,
  getWorkflowEventsForEntity
} from "../src/lib/workflow-events";
import type {
  DailyDigest,
  DeliveryChannel,
  DuplicateGroup,
  ImportedCandidate,
  ImportedCandidateSnapshot,
  ScheduledDelivery,
  TechnologyItem,
  TechnologyWorkspaceRecord,
  WorkflowEvent
} from "../src/types/content";

type BackupEntry =
  | { kind: "missing" }
  | { kind: "file"; value: string }
  | { kind: "directory" };

const configDirPath = path.join(process.cwd(), "config");
const importedCandidatesSnapshotPath = path.join(
  configDirPath,
  "imported-candidates.live.json"
);
const candidateReviewStatePath = path.join(
  configDirPath,
  "candidate-review-state.json"
);
const technologyWorkspaceStorePath = path.join(
  configDirPath,
  "technology-workspace.json"
);
const duplicateGroupStorePath = path.join(configDirPath, "duplicate-groups.json");
const digestStorePath = path.join(configDirPath, "daily-digests.json");
const deliveryStorePath = path.join(configDirPath, "delivery.json");
const scheduleStorePath = path.join(configDirPath, "scheduled-delivery.json");
const workflowEventStorePath = path.join(configDirPath, "workflow-events.json");
const now = "2026-05-28T08:00:00.000Z";
const internalOnlyTerms = [
  "WorkflowEvent",
  "workflow_events",
  "audit log",
  "endpointUrl",
  "DeliveryRun",
  "ScheduledDelivery",
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId"
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

function buildCandidate(id: string, title: string): ImportedCandidate {
  return {
    id,
    sourceId: "workflow-hardening-source",
    sourceType: "rss-feed",
    sourceName: "Workflow Hardening Source",
    sourceUrl: `https://example.test/workflow-hardening/${id}`,
    originalTitle: title,
    originalSummary:
      "Validation candidate for database-backed workflow hardening checks.",
    originalContent:
      "This candidate has enough content to generate a Technology draft and validate publish workflow hardening without exposing internal fields.",
    originalLanguage: "en",
    publishDate: "2026-05-28",
    publisherName: "Workflow Hardening Publisher",
    normalizedType: "tool",
    tags: ["workflow", "validation"],
    importStatus: "new",
    relatedCandidateIds: [],
    rawPayload: {
      canonicalUrl: `https://example.test/workflow-hardening/${id}`
    }
  };
}

function writeInitialStores() {
  const primaryCandidate = buildCandidate(
    "workflow-hardening-primary",
    "Workflow hardening primary candidate"
  );
  const duplicateCandidate = buildCandidate(
    "workflow-hardening-secondary",
    "Workflow hardening duplicate candidate"
  );
  duplicateCandidate.sourceUrl = primaryCandidate.sourceUrl;
  duplicateCandidate.rawPayload = {
    canonicalUrl: primaryCandidate.sourceUrl
  };
  const draftOnlyCandidate = buildCandidate(
    "workflow-hardening-draft-only",
    "Workflow hardening draft only candidate"
  );
  const snapshot: ImportedCandidateSnapshot = {
    syncedAt: now,
    sources: [
      {
        id: "workflow-hardening-source",
        sourceType: "rss-feed",
        sourceName: "Workflow Hardening Source",
        sourceUrl: "https://example.test/workflow-hardening.xml",
        syncStatus: "fallback",
        itemCount: 3,
        fetchedAt: now
      }
    ],
    candidates: [primaryCandidate, duplicateCandidate, draftOnlyCandidate]
  };
  writeJsonFile(importedCandidatesSnapshotPath, snapshot);
  writeJsonFile(candidateReviewStatePath, { updatedAt: now, items: {} });
  writeJsonFile(technologyWorkspaceStorePath, {
    updatedAt: now,
    records: [] as TechnologyWorkspaceRecord[]
  });
  writeJsonFile(duplicateGroupStorePath, {
    updatedAt: now,
    groups: [] as DuplicateGroup[]
  });
  writeJsonFile(digestStorePath, {
    updatedAt: now,
    digests: [] as DailyDigest[]
  });
  writeJsonFile(deliveryStorePath, {
    updatedAt: now,
    channels: [] as DeliveryChannel[],
    runs: []
  });
  writeJsonFile(scheduleStorePath, {
    updatedAt: now,
    schedules: [] as ScheduledDelivery[],
    runs: []
  });
  writeJsonFile(workflowEventStorePath, {
    updatedAt: now,
    events: [] as WorkflowEvent[]
  });
}

function makePublishableDraft(
  draft: TechnologyWorkspaceRecord,
  slug: string
): TechnologyWorkspaceRecord {
  return updateTechnologyWorkspaceRecord(draft.id, {
    slug,
    title: {
      original: `Workflow hardening ${slug}`
    },
    summary: {
      original:
        "A validation draft used to verify database-backed workflow hardening."
    },
    content: {
      original:
        "This validation content verifies that publishing, digest, delivery, and schedule workflows keep state changes auditable and guarded."
    },
    tags: ["tag-ai-agents", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-tool-use"],
    relatedSkillIds: ["skill-agent-design"],
    editorialNotes: ["Workflow hardening validation completed."]
  });
}

function assertNoInternalFields(value: unknown, label: string) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);

  for (const term of internalOnlyTerms) {
    assert.equal(
      serialized.includes(term),
      false,
      `${label} should not expose ${term}.`
    );
  }
}

async function main() {
  const backups = new Map<string, BackupEntry>(
    [
      importedCandidatesSnapshotPath,
      candidateReviewStatePath,
      technologyWorkspaceStorePath,
      duplicateGroupStorePath,
      digestStorePath,
      deliveryStorePath,
      scheduleStorePath,
      workflowEventStorePath
    ].map((filePath) => [filePath, backupEntry(filePath)])
  );

  try {
    writeInitialStores();

    const detectedGroup = getCandidateWorkflowData().duplicateGroups.find((group) =>
      group.candidateIds.includes("workflow-hardening-primary")
    );

    assert.ok(detectedGroup, "Expected duplicate group to be detected.");

    const resolvedGroup = updateDuplicateGroup(detectedGroup.id, {
      primaryCandidateId: "workflow-hardening-primary",
      status: "resolved"
    });

    assert.equal(resolvedGroup.status, "resolved");
    assert.ok(
      getWorkflowEventsForEntity("duplicate_group", resolvedGroup.id).some(
        (event) => event.action === "duplicate_group.resolved"
      ),
      "Resolving duplicate group should record a workflow event."
    );

    assert.throws(
      () => convertImportedCandidateToDraft("workflow-hardening-secondary"),
      /not the primary candidate/,
      "Non-primary duplicate should not convert to a draft."
    );

    const draftStoreBackup = backupEntry(technologyWorkspaceStorePath);

    removePath(technologyWorkspaceStorePath);
    mkdirSync(technologyWorkspaceStorePath, { recursive: true });
    assert.throws(
      () => convertImportedCandidateToDraft("workflow-hardening-primary"),
      /EISDIR|directory|illegal operation/i,
      "A failed draft write should surface as an error."
    );
    restoreEntry(technologyWorkspaceStorePath, draftStoreBackup);
    assert.equal(
      getImportedCandidateById("workflow-hardening-primary")
        ?.convertedTechnologyId,
      undefined,
      "Candidate should not be marked converted when draft write fails."
    );

    const draft = convertImportedCandidateToDraft("workflow-hardening-primary");
    const draftAgain = convertImportedCandidateToDraft("workflow-hardening-primary");

    assert.equal(draftAgain.id, draft.id);
    assert.equal(
      getTechnologyWorkspaceRecords().filter((record) => record.id === draft.id)
        .length,
      1,
      "Repeated conversion should not create duplicate drafts."
    );
    assert.equal(
      draft.sourceReferences?.length,
      1,
      "Resolved duplicate references should be carried into the draft."
    );
    assert.ok(
      getWorkflowEventsForEntity("candidate", "workflow-hardening-primary").some(
        (event) => event.action === "candidate.converted_to_draft"
      ),
      "Candidate conversion should record a workflow event."
    );

    const slugConflictDraft = makePublishableDraft(
      draft,
      "model-context-protocol"
    );

    assert.throws(
      () => updateTechnologyWorkspaceStatus(slugConflictDraft.id, "published"),
      /ready|publish/i,
      "Slug conflict should block publishing."
    );
    assert.ok(
      getWorkflowEventsForEntity("technology_draft", slugConflictDraft.id).some(
        (event) => event.action === "draft.publish_failed"
      ),
      "Blocked publish should record a failure event."
    );

    const publishableDraft = makePublishableDraft(
      slugConflictDraft,
      "workflow-hardening-published"
    );
    const publishedDraft = updateTechnologyWorkspaceStatus(
      publishableDraft.id,
      "published"
    );

    assert.equal(publishedDraft.status, "published");
    assert.ok(
      getWorkflowEventsForEntity("technology_draft", publishedDraft.id).some(
        (event) => event.action === "draft.published"
      ),
      "Successful publish should record a workflow event."
    );

    const draftOnly = convertImportedCandidateToDraft(
      "workflow-hardening-draft-only"
    );
    const incompleteDigest: DailyDigest = {
      id: "digest-workflow-hardening-invalid",
      date: "2026-05-28",
      status: "draft",
      title: "Workflow hardening invalid digest",
      summary: "Invalid digest references an unpublished draft.",
      editorialSummary: "Invalid digest.",
      highPriorityTechnologyIds: [draftOnly.id],
      watchTechnologyIds: [],
      manuallyAddedTechnologyIds: [],
      excludedTechnologyIds: [],
      pinnedTechnologyIds: [],
      orderedTechnologyIds: [draftOnly.id],
      skillIds: [],
      knowledgeIds: [],
      sourceNames: ["Workflow Hardening Source"],
      generatedAt: now,
      updatedAt: now,
      editorialNotes: []
    };

    writeJsonFile(digestStorePath, {
      updatedAt: now,
      digests: [incompleteDigest]
    });

    const digestReadiness = evaluateDailyDigestPublishReadiness(
      incompleteDigest,
      {
        allTechnologies: [draftOnly as unknown as TechnologyItem],
        publishedTechnologies: []
      }
    );

    assert.equal(
      digestReadiness.blockingErrors.some(
        (issue) => issue.code === "unpublished_technology"
      ),
      true,
      "Digest readiness should block unpublished TechnologyItem references."
    );
    assert.throws(
      () => publishDailyDigest(incompleteDigest.date),
      /ready|publish/i,
      "Invalid digest should not publish."
    );

    const validDigest: DailyDigest = {
      ...incompleteDigest,
      id: "digest-workflow-hardening-valid",
      title: "Workflow hardening valid digest",
      highPriorityTechnologyIds: [publishedDraft.id],
      orderedTechnologyIds: [publishedDraft.id],
      skillIds: publishedDraft.relatedSkillIds,
      knowledgeIds: publishedDraft.relatedKnowledgeIds,
      sourceNames: [publishedDraft.sourceName]
    };

    writeJsonFile(digestStorePath, {
      updatedAt: now,
      digests: [validDigest]
    });
    const publishedDigest = publishDailyDigest(validDigest.date);

    assert.equal(publishedDigest.status, "published");
    assert.ok(
      getWorkflowEventsForEntity("daily_digest", publishedDigest.id).some(
        (event) => event.action === "digest.published"
      ),
      "Digest publish should record a workflow event."
    );

    const successChannel = createDeliveryChannel({
      name: "Workflow hardening success webhook",
      type: "webhook",
      enabled: true,
      endpointUrl: "mock://success",
      description: "Validation success channel.",
      format: "json"
    });
    const failedChannel = createDeliveryChannel({
      name: "Workflow hardening failed webhook",
      type: "webhook",
      enabled: true,
      endpointUrl: "mock://failed?token=secret-value",
      description: "Validation failed channel.",
      format: "json"
    });
    const failedRun = await sendDailyDigestToChannel({
      digestDate: publishedDigest.date,
      channelId: failedChannel.id
    });

    assert.equal(failedRun.status, "failed");
    assert.ok(
      getWorkflowEventsForEntity("delivery_run", failedRun.id).some(
        (event) => event.action === "delivery.failed"
      ),
      "Failed delivery should record an audit event."
    );
    assert.equal(
      JSON.stringify(getRecentWorkflowEvents()).includes("secret-value"),
      false,
      "Workflow events should not expose webhook token values."
    );

    const schedule = createScheduledDelivery({
      name: "Workflow hardening schedule",
      enabled: true,
      digestTarget: "digest_by_date",
      digestDate: publishedDigest.date,
      channelIds: [successChannel.id, failedChannel.id],
      scheduleTime: "09:00",
      timezone: "Asia/Shanghai"
    });
    const runAt = new Date("2026-05-28T01:00:00.000Z");
    const firstScheduleRun = await runScheduleById(schedule.id, {
      triggerType: "scheduled",
      force: false,
      now: runAt
    });
    const duplicateScheduleRun = await runScheduleById(schedule.id, {
      triggerType: "scheduled",
      force: false,
      now: runAt
    });

    assert.equal(firstScheduleRun.deliveryLogIds.length, 2);
    assert.equal(
      duplicateScheduleRun.deliveryLogIds.length,
      0,
      "Duplicate scheduled run should not resend the same digest/channel."
    );
    assert.ok(
      getWorkflowEventsForEntity("scheduled_delivery", schedule.id).some(
        (event) => event.action === "schedule.run"
      ),
      "Scheduled run should record a workflow event."
    );

    assertNoInternalFields(getAllTechnologies(), "User-facing technologies");
    assertNoInternalFields(getDigestDeliveryFeed(), "Public digest feed");

    console.log("Workflow hardening validation passed.");
  } finally {
    for (const [filePath, backup] of backups) {
      restoreEntry(filePath, backup);
    }
  }
}

void main();

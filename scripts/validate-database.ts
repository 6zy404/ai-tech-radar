import assert from "node:assert/strict";

import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies
} from "../src/lib/content";
import {
  getCandidateWorkflowData,
  getTechnologyWorkspaceRecords
} from "../src/lib/candidate-workflow";
import { getDigestDeliveryFeed } from "../src/lib/digest-delivery";
import {
  getDailyDigests,
  getSelectedDigestTechnologyIds
} from "../src/lib/digest-workflow";
import { getDeliveryChannels, getDeliveryRuns } from "../src/lib/delivery-workflow";
import {
  getLocalStoreFilePath,
  readLocalJsonDiskFile
} from "../src/lib/repositories/local-json-store";
import {
  getSqliteSchemaStats,
  initializeSqliteDatabase,
  migrateJsonStoresToSqlite,
  readSqliteKnowledgeItems,
  readSqliteSeedTechnologies,
  readSqliteSkillItems
} from "../src/lib/repositories/sqlite-store";
import {
  getExternalSourceImportRuns,
  getExternalSources
} from "../src/lib/source-workflow";
import {
  getScheduledDeliveries,
  getScheduledDeliveryRuns
} from "../src/lib/scheduled-delivery-workflow";
import type {
  DailyDigest,
  DeliveryChannel,
  DeliveryRun,
  DuplicateGroup,
  EditorialEnrichmentSuggestion,
  ExternalSource,
  ImportRun,
  ImportedCandidateSnapshot,
  PromptVersion,
  ScheduledDelivery,
  ScheduledDeliveryRun,
  TaskRunnerRun,
  TechnologyWorkspaceRecord,
  WorkflowEvent
} from "../src/types/content";

interface CandidateReviewStateFile {
  updatedAt: string;
  items: Record<
    string,
    {
      importStatus: string;
      reviewedAt?: string;
      convertedTechnologyId?: string;
    }
  >;
}

interface EditorialEnrichmentSuggestionStore {
  updatedAt: string;
  suggestions: EditorialEnrichmentSuggestion[];
}

interface PromptVersionStore {
  updatedAt: string;
  promptVersions: PromptVersion[];
}

const internalOnlyTerms = [
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "qualityFlags",
  "sourceQuality",
  "candidateQuality",
  "endpointUrl",
  "requestPayloadPreview",
  "responseBodyPreview",
  "scheduleTime",
  "channelIds",
  "TaskRunnerRun"
];

function nowIso(): string {
  return new Date().toISOString();
}

function readStore<T>(fileName: string, fallbackValue: T): T {
  return readLocalJsonDiskFile(getLocalStoreFilePath(fileName), fallbackValue);
}

function migrateCurrentJsonStores() {
  const now = nowIso();

  return migrateJsonStoresToSqlite({
    externalSources: readStore("external-sources.json", {
      updatedAt: now,
      sources: [] as ExternalSource[],
      importRuns: [] as ImportRun[]
    }),
    importedCandidates: readStore("imported-candidates.live.json", {
      syncedAt: now,
      sources: [],
      candidates: []
    } satisfies ImportedCandidateSnapshot),
    candidateReviewState: readStore("candidate-review-state.json", {
      updatedAt: now,
      items: {}
    } satisfies CandidateReviewStateFile),
    duplicateGroups: readStore("duplicate-groups.json", {
      updatedAt: now,
      groups: [] as DuplicateGroup[]
    }),
    technologyWorkspace: readStore("technology-workspace.json", {
      updatedAt: now,
      records: [] as TechnologyWorkspaceRecord[]
    }),
    dailyDigests: readStore("daily-digests.json", {
      updatedAt: now,
      digests: [] as DailyDigest[]
    }),
    delivery: readStore("delivery.json", {
      updatedAt: now,
      channels: [] as DeliveryChannel[],
      runs: [] as DeliveryRun[]
    }),
    scheduledDelivery: readStore("scheduled-delivery.json", {
      updatedAt: now,
      schedules: [] as ScheduledDelivery[],
      runs: [] as ScheduledDeliveryRun[]
    }),
    taskRunner: readStore("task-runner.json", {
      updatedAt: now,
      runs: [] as TaskRunnerRun[]
    }),
    workflowEvents: readStore("workflow-events.json", {
      updatedAt: now,
      events: [] as WorkflowEvent[]
    }),
    editorialEnrichmentSuggestions: readStore(
      "editorial-enrichment-suggestions.json",
      {
        updatedAt: now,
        suggestions: [] as EditorialEnrichmentSuggestion[]
      } satisfies EditorialEnrichmentSuggestionStore
    ),
    promptVersions: readStore("prompt-versions.json", {
      updatedAt: now,
      promptVersions: [] as PromptVersion[]
    } satisfies PromptVersionStore)
  });
}

function assertNoInternalTerms(label: string, value: unknown) {
  const serializedValue = JSON.stringify(value);

  for (const term of internalOnlyTerms) {
    assert.equal(
      serializedValue.includes(term),
      false,
      `${label} should not contain internal-only term ${term}.`
    );
  }
}

function validateSchema() {
  const stats = initializeSqliteDatabase();
  const tableNames = new Set(stats.map((item) => item.tableName));

  for (const expectedTableName of [
    "sources",
    "import_runs",
    "imported_candidates",
    "duplicate_groups",
    "technology_drafts",
    "technologies",
    "knowledge_items",
    "skill_items",
    "daily_digests",
    "delivery_channels",
    "delivery_logs",
    "scheduled_deliveries",
    "task_runs",
    "workflow_events",
    "editorial_enrichment_suggestions",
    "prompt_versions"
  ]) {
    assert.equal(
      tableNames.has(expectedTableName),
      true,
      `SQLite schema should include ${expectedTableName}.`
    );
  }
}

function validateDriverData(label: string) {
  const { snapshot, candidates, duplicateGroups, workspaceRecords } =
    getCandidateWorkflowData();
  const externalSourceIds = new Set(getExternalSources().map((source) => source.id));
  const snapshotSourceIds = new Set(snapshot.sources.map((source) => source.id));
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const workspaceRecordIds = new Set(workspaceRecords.map((record) => record.id));

  assert.ok(getAllTechnologies().length > 0, `${label} should read technologies.`);

  for (const candidate of candidates) {
    if (candidate.sourceId) {
      assert.equal(
        externalSourceIds.has(candidate.sourceId) ||
          snapshotSourceIds.has(candidate.sourceId),
        true,
        `${label}: candidate ${candidate.id} should reference an existing source.`
      );
    }

    if (candidate.convertedTechnologyId) {
      assert.equal(
        workspaceRecordIds.has(candidate.convertedTechnologyId),
        true,
        `${label}: converted candidate ${candidate.id} should reference a draft.`
      );
    }
  }

  for (const group of duplicateGroups) {
    for (const candidateId of group.candidateIds) {
      assert.equal(
        candidateIds.has(candidateId),
        true,
        `${label}: duplicate group ${group.id} references missing candidate ${candidateId}.`
      );
    }

    assert.equal(
      group.candidateIds.includes(group.primaryCandidateId),
      true,
      `${label}: duplicate group ${group.id} primary candidate must be a member.`
    );
  }

  const sourceIds = new Set(getExternalSources().map((source) => source.id));

  for (const run of getExternalSourceImportRuns()) {
    for (const result of run.sourceResults) {
      assert.equal(
        sourceIds.has(result.sourceId),
        true,
        `${label}: import run ${run.id} references missing source ${result.sourceId}.`
      );
    }
  }

  const knowledgeIds = new Set(getAllKnowledge().map((item) => item.id));
  const skillIds = new Set(getAllSkills().map((item) => item.id));
  const publishedTechnologyIds = new Set(
    getAllTechnologies()
      .filter((technology) => technology.status === "published")
      .map((technology) => technology.id)
  );

  for (const technology of getAllTechnologies()) {
    for (const knowledgeId of technology.relatedKnowledgeIds) {
      assert.equal(
        knowledgeIds.has(knowledgeId),
        true,
        `${label}: technology ${technology.id} references missing knowledge ${knowledgeId}.`
      );
    }

    for (const skillId of technology.relatedSkillIds) {
      assert.equal(
        skillIds.has(skillId),
        true,
        `${label}: technology ${technology.id} references missing skill ${skillId}.`
      );
    }
  }

  for (const digest of getDailyDigests()) {
    for (const technologyId of getSelectedDigestTechnologyIds(digest)) {
      assert.equal(
        publishedTechnologyIds.has(technologyId),
        true,
        `${label}: digest ${digest.date} references missing or unpublished technology ${technologyId}.`
      );
    }
  }

  const digestIds = new Set(getDailyDigests().map((digest) => digest.id));
  const digestDates = new Set(getDailyDigests().map((digest) => digest.date));
  const channelIds = new Set(getDeliveryChannels().map((channel) => channel.id));
  const deliveryRunIds = new Set(getDeliveryRuns().map((run) => run.id));

  for (const run of getDeliveryRuns()) {
    assert.equal(
      digestIds.has(run.digestId) || digestDates.has(run.digestDate),
      true,
      `${label}: delivery run ${run.id} references a missing digest.`
    );
    assert.equal(
      channelIds.has(run.channelId),
      true,
      `${label}: delivery run ${run.id} references missing channel ${run.channelId}.`
    );
  }

  for (const schedule of getScheduledDeliveries()) {
    for (const channelId of schedule.channelIds) {
      assert.equal(
        channelIds.has(channelId),
        true,
        `${label}: schedule ${schedule.id} references missing channel ${channelId}.`
      );
    }
  }

  for (const run of getScheduledDeliveryRuns()) {
    for (const deliveryLogId of run.deliveryLogIds) {
      assert.equal(
        deliveryRunIds.has(deliveryLogId),
        true,
        `${label}: scheduled run ${run.id} references missing delivery log ${deliveryLogId}.`
      );
    }
  }

  assertNoInternalTerms(`${label} user-facing technologies`, getAllTechnologies());
  assertNoInternalTerms(`${label} public digest feed`, getDigestDeliveryFeed());
}

validateSchema();

const migrationSummary = migrateCurrentJsonStores();

assert.equal(migrationSummary.errors, 0, "JSON -> SQLite migration should not fail.");
assert.ok(
  getSqliteSchemaStats().some(
    (item) => item.tableName === "technologies" && item.rowCount > 0
  ),
  "SQLite technologies table should contain migrated or seeded rows."
);
assert.ok(readSqliteSeedTechnologies().length > 0, "Seed technologies should be readable.");
assert.ok(readSqliteKnowledgeItems().length > 0, "Knowledge items should be seeded.");
assert.ok(readSqliteSkillItems().length > 0, "Skill items should be seeded.");

process.env.PERSISTENCE_DRIVER = "sqlite";
validateDriverData("sqlite driver");

process.env.PERSISTENCE_DRIVER = "json";
validateDriverData("json driver");

console.log("Database validation passed.");

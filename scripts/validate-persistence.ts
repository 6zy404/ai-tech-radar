import assert from "node:assert/strict";
import path from "node:path";

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
import { getDailyDigests, getSelectedDigestTechnologyIds } from "../src/lib/digest-workflow";
import { getDeliveryChannels, getDeliveryRuns } from "../src/lib/delivery-workflow";
import { getLocalDataDirPath } from "../src/lib/local-data";
import { getLocalStoreFilePath } from "../src/lib/repositories/local-json-store";
import {
  getExternalSourceImportRuns,
  getExternalSources
} from "../src/lib/source-workflow";
import {
  getScheduledDeliveries,
  getScheduledDeliveryRuns
} from "../src/lib/scheduled-delivery-workflow";

const internalOnlyTerms = [
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "relatedCandidateIds",
  "reviewedAt",
  "convertedTechnologyId",
  "sourceCandidateId",
  "candidateId",
  "sourceType",
  "editorialNotes",
  "qualityFlags",
  "CandidateQualitySignals",
  "SourceQualityMetrics",
  "endpointUrl",
  "requestPayloadPreview",
  "responseBodyPreview",
  "retryOfDeliveryRunId",
  "scheduleTime",
  "channelIds",
  "TaskRunnerRun"
];

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

function assertLocalStorePathIsBounded(fileName: string) {
  const dataDirPath = path.resolve(getLocalDataDirPath());
  const filePath = path.resolve(getLocalStoreFilePath(fileName));

  assert.equal(
    filePath.startsWith(`${dataDirPath}${path.sep}`),
    true,
    `${fileName} should resolve inside LOCAL_DATA_DIR.`
  );
}

function validateCandidateReferences() {
  const { snapshot, candidates, duplicateGroups, workspaceRecords } =
    getCandidateWorkflowData();
  const externalSourceIds = new Set(getExternalSources().map((source) => source.id));
  const snapshotSourceIds = new Set(snapshot.sources.map((source) => source.id));
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const workspaceRecordIds = new Set(workspaceRecords.map((record) => record.id));

  for (const candidate of candidates) {
    if (candidate.sourceId) {
      assert.equal(
        externalSourceIds.has(candidate.sourceId) ||
          snapshotSourceIds.has(candidate.sourceId),
        true,
        `ImportedCandidate ${candidate.id} references missing source ${candidate.sourceId}.`
      );
    }

    if (candidate.convertedTechnologyId) {
      assert.equal(
        workspaceRecordIds.has(candidate.convertedTechnologyId),
        true,
        `Converted candidate ${candidate.id} references missing technology draft ${candidate.convertedTechnologyId}.`
      );
    }
  }

  for (const group of duplicateGroups) {
    for (const candidateId of group.candidateIds) {
      assert.equal(
        candidateIds.has(candidateId),
        true,
        `DuplicateGroup ${group.id} references missing candidate ${candidateId}.`
      );
    }

    assert.equal(
      group.candidateIds.includes(group.primaryCandidateId),
      true,
      `DuplicateGroup ${group.id} primaryCandidateId must belong to candidateIds.`
    );
  }
}

function validateImportRunReferences() {
  const sourceIds = new Set(getExternalSources().map((source) => source.id));

  for (const run of getExternalSourceImportRuns()) {
    for (const result of run.sourceResults) {
      assert.equal(
        sourceIds.has(result.sourceId),
        true,
        `ImportRun ${run.id} references missing source ${result.sourceId}.`
      );
    }
  }
}

function validateTechnologyReferences() {
  const knowledgeIds = new Set(getAllKnowledge().map((item) => item.id));
  const skillIds = new Set(getAllSkills().map((item) => item.id));
  const technologies = getAllTechnologies();

  for (const technology of technologies) {
    for (const knowledgeId of technology.relatedKnowledgeIds) {
      assert.equal(
        knowledgeIds.has(knowledgeId),
        true,
        `TechnologyItem ${technology.id} references missing KnowledgeItem ${knowledgeId}.`
      );
    }

    for (const skillId of technology.relatedSkillIds) {
      assert.equal(
        skillIds.has(skillId),
        true,
        `TechnologyItem ${technology.id} references missing SkillItem ${skillId}.`
      );
    }
  }

  assertNoInternalTerms("user-facing technologies", technologies);
}

function validateDigestReferences() {
  const technologies = getAllTechnologies();
  const publishedTechnologyIds = new Set(
    technologies
      .filter((technology) => technology.status === "published")
      .map((technology) => technology.id)
  );

  for (const digest of getDailyDigests()) {
    for (const technologyId of getSelectedDigestTechnologyIds(digest)) {
      assert.equal(
        publishedTechnologyIds.has(technologyId),
        true,
        `DailyDigest ${digest.date} references missing or unpublished TechnologyItem ${technologyId}.`
      );
    }
  }

  assertNoInternalTerms("public digest delivery feed", getDigestDeliveryFeed());
}

function validateDeliveryReferences() {
  const digestIds = new Set(getDailyDigests().map((digest) => digest.id));
  const digestDates = new Set(getDailyDigests().map((digest) => digest.date));
  const channelIds = new Set(getDeliveryChannels().map((channel) => channel.id));
  const deliveryRunIds = new Set(getDeliveryRuns().map((run) => run.id));

  for (const run of getDeliveryRuns()) {
    assert.equal(
      digestIds.has(run.digestId) || digestDates.has(run.digestDate),
      true,
      `DeliveryRun ${run.id} references missing digest ${run.digestId || run.digestDate}.`
    );
    assert.equal(
      channelIds.has(run.channelId),
      true,
      `DeliveryRun ${run.id} references missing channel ${run.channelId}.`
    );
  }

  for (const schedule of getScheduledDeliveries()) {
    for (const channelId of schedule.channelIds) {
      assert.equal(
        channelIds.has(channelId),
        true,
        `ScheduledDelivery ${schedule.id} references missing channel ${channelId}.`
      );
    }
  }

  for (const run of getScheduledDeliveryRuns()) {
    for (const deliveryLogId of run.deliveryLogIds) {
      assert.equal(
        deliveryRunIds.has(deliveryLogId),
        true,
        `ScheduledDeliveryRun ${run.id} references missing DeliveryRun ${deliveryLogId}.`
      );
    }
  }
}

function validateLocalStoreBoundaries() {
  for (const fileName of [
    "imported-candidates.live.json",
    "candidate-review-state.json",
    "external-sources.json",
    "technology-workspace.json",
    "duplicate-groups.json",
    "daily-digests.json",
    "delivery.json",
    "scheduled-delivery.json",
    "task-runner.json",
    "workflow-events.json"
  ]) {
    assertLocalStorePathIsBounded(fileName);
  }

  assert.equal(
    getTechnologyWorkspaceRecords().every((record) =>
      ["draft", "published", "archived"].includes(record.status)
    ),
    true,
    "Technology workspace records should use supported lifecycle statuses."
  );
}

validateLocalStoreBoundaries();
validateCandidateReferences();
validateImportRunReferences();
validateTechnologyReferences();
validateDigestReferences();
validateDeliveryReferences();

console.log("Persistence boundary validation passed.");

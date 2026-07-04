import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

process.env.PERSISTENCE_DRIVER = "json";

import {
  getPublishedTechnologyWorkspaceRecords,
  getTechnologyWorkspacePublishReadiness,
  updateTechnologyWorkspaceRecord,
  updateTechnologyWorkspaceStatus
} from "../src/lib/technology-draft-workflow";
import { getDigestTechnologyIntelligenceSummary } from "../src/lib/content-intelligence";
import { toUserFacingTechnologyItem } from "../src/lib/content";
import { evaluateTechnologyPriority } from "../src/lib/ranking";
import type { TechnologyWorkspaceRecord } from "../src/types/content";

const configDirPath = path.join(process.cwd(), "config");
const technologyWorkspaceStorePath = path.join(
  configDirPath,
  "technology-workspace.json"
);
const workflowEventStorePath = path.join(configDirPath, "workflow-events.json");
const now = "2026-05-29T10:00:00.000Z";
const internalOnlyTerms = [
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "qualityFlags",
  "candidateQuality",
  "sourceQuality",
  "WorkflowEvent",
  "DeliveryRun",
  "endpointUrl"
];

function backupFile(filePath: string): string | undefined {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : undefined;
}

function restoreFile(filePath: string, value: string | undefined) {
  if (value === undefined) {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    return;
  }

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function writeWorkspaceRecords(records: TechnologyWorkspaceRecord[]) {
  mkdirSync(configDirPath, { recursive: true });
  writeFileSync(
    technologyWorkspaceStorePath,
    `${JSON.stringify({ updatedAt: now, records }, null, 2)}\n`,
    "utf8"
  );
}

function assertNoInternalTerms(value: unknown, label: string) {
  const serializedValue = JSON.stringify(value);

  for (const term of internalOnlyTerms) {
    assert.equal(
      serializedValue.includes(term),
      false,
      `${label} should not expose internal-only term ${term}.`
    );
  }
}

function buildTechnologyRecord(
  overrides: Partial<TechnologyWorkspaceRecord> = {}
): TechnologyWorkspaceRecord {
  return {
    id: "content-intelligence-draft",
    slug: "content-intelligence-validation",
    title: {
      original: "Content intelligence validation technology",
      zh: "Content intelligence validation technology"
    },
    summary: {
      original:
        "A complete validation item used to verify content intelligence persistence and publication.",
      zh: "A complete validation item used to verify content intelligence persistence and publication."
    },
    content: {
      original:
        "This validation content is long enough to pass publication checks while exercising the explanation fields that help users understand a technology signal.",
      zh: "This validation content is long enough to pass publication checks while exercising the explanation fields that help users understand a technology signal."
    },
    type: "tool",
    publishDate: "2026-05-29",
    sourceName: "Content Intelligence Validation",
    sourceUrl: "https://example.com/content-intelligence-validation",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "Validation Publisher",
    publisherType: "media",
    importanceLevel: "critical",
    status: "draft",
    tags: ["tag-ai-agents", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-tool-use"],
    relatedSkillIds: ["skill-agent-design"],
    sourceReferences: [],
    whyItMatters: "",
    whoShouldCare: [],
    technicalContext: "",
    impactAreas: [],
    learningPath: [],
    relatedKnowledgeExplanations: {},
    relatedSkillExplanations: {},
    followUpQuestions: [],
    readingDifficulty: "intermediate",
    intelligenceStatus: "needs_enrichment",
    createdAt: now,
    updatedAt: now,
    editorialNotes: ["Validation record."],
    ...overrides
  };
}

function main() {
  const workspaceBackup = backupFile(technologyWorkspaceStorePath);
  const workflowEventBackup = backupFile(workflowEventStorePath);

  try {
    const incompleteRecord = buildTechnologyRecord({
      id: "content-intelligence-incomplete",
      slug: "content-intelligence-incomplete"
    });
    writeWorkspaceRecords([incompleteRecord]);

    const incompleteReadiness = getTechnologyWorkspacePublishReadiness(
      incompleteRecord.id
    );
    assert.equal(incompleteReadiness.isReady, true);
    assert.ok(
      incompleteReadiness.warnings.some(
        (warning) => warning.code === "missing-why-it-matters"
      ),
      "Missing whyItMatters should produce a publish warning."
    );

    const record = buildTechnologyRecord();
    writeWorkspaceRecords([record]);

    const updatedRecord = updateTechnologyWorkspaceRecord(record.id, {
      whyItMatters:
        "This signal matters because it turns a technology item into an explanation users can act on.",
      whoShouldCare: ["AI engineer", "product builder"],
      technicalContext:
        "A content understanding layer above published technology records.",
      impactAreas: ["developer tools", "enterprise AI adoption"],
      learningPath: [
        "Read the source",
        "Review related knowledge",
        "Pick a pilot"
      ],
      relatedKnowledgeExplanations: {
        "knowledge-tool-use":
          "Tool-use knowledge explains why the signal matters."
      },
      relatedSkillExplanations: {
        "skill-agent-design":
          "Agent design helps teams apply the signal safely."
      },
      followUpQuestions: ["What workflow changes first?"],
      readingDifficulty: "beginner",
      intelligenceStatus: "reviewed"
    });

    assert.equal(
      updatedRecord.whyItMatters?.startsWith("This signal matters"),
      true
    );
    assert.deepEqual(updatedRecord.whoShouldCare, [
      "AI engineer",
      "product builder"
    ]);
    assert.equal(updatedRecord.readingDifficulty, "beginner");
    assert.equal(updatedRecord.intelligenceStatus, "reviewed");

    const publishedRecord = updateTechnologyWorkspaceStatus(
      updatedRecord.id,
      "published"
    );
    assert.equal(publishedRecord.status, "published");
    assert.equal(publishedRecord.whyItMatters, updatedRecord.whyItMatters);

    const publishedTechnology = getPublishedTechnologyWorkspaceRecords().find(
      (item) => item.id === updatedRecord.id
    );
    assert.ok(publishedTechnology, "Published technology should be readable.");
    assert.equal(publishedTechnology?.whyItMatters, updatedRecord.whyItMatters);

    const publicTechnology = toUserFacingTechnologyItem(publishedRecord);
    assert.equal(publicTechnology.whyItMatters, updatedRecord.whyItMatters);
    assertNoInternalTerms(publicTechnology, "User-facing technology");

    const minimalPublicTechnology = toUserFacingTechnologyItem(
      buildTechnologyRecord({
        id: "content-intelligence-minimal",
        slug: "content-intelligence-minimal",
        status: "published",
        whyItMatters: undefined,
        whoShouldCare: undefined,
        relatedKnowledgeExplanations: undefined,
        relatedSkillExplanations: undefined,
        learningPath: undefined,
        followUpQuestions: undefined,
        readingDifficulty: undefined
      })
    );
    assert.doesNotThrow(() => JSON.stringify(minimalPublicTechnology));

    const ranking = evaluateTechnologyPriority(publicTechnology);
    const digestSummary = getDigestTechnologyIntelligenceSummary(
      publicTechnology,
      ranking,
      "Priority fallback"
    );
    assert.equal(digestSummary.whyItMatters, publicTechnology.whyItMatters);
    assert.equal(digestSummary.relatedKnowledgeCount, 1);
    assert.equal(digestSummary.relatedSkillCount, 1);
    assert.equal(digestSummary.audience.length, 2);

    const completeReadiness = getTechnologyWorkspacePublishReadiness(
      updatedRecord.id
    );
    assert.equal(completeReadiness.isReady, true);
    assert.equal(
      completeReadiness.warnings.some(
        (warning) => warning.code === "missing-why-it-matters"
      ),
      false
    );

    console.log("Content intelligence validation passed.");
  } finally {
    restoreFile(technologyWorkspaceStorePath, workspaceBackup);
    restoreFile(workflowEventStorePath, workflowEventBackup);
  }
}

main();

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
  getTechnologyWorkspacePublishReadiness,
  getTechnologyWorkspaceRecordById,
  updateTechnologyWorkspaceRecord
} from "../src/lib/technology-draft-workflow";
import { toUserFacingTechnologyItem } from "../src/lib/content";
import {
  applyEditorialEnrichmentSuggestion,
  generateEditorialEnrichmentSuggestion,
  rejectEditorialEnrichmentSuggestion
} from "../src/lib/editorial-enrichment";
import {
  getEditorialEnrichmentSuggestionById,
  getEditorialEnrichmentSuggestionsForDraft
} from "../src/lib/editorial-enrichment-store";
import { getWorkflowEvents } from "../src/lib/workflow-events";
import type { TechnologyWorkspaceRecord } from "../src/types/content";

const configDirPath = path.join(process.cwd(), "config");
const technologyWorkspaceStorePath = path.join(
  configDirPath,
  "technology-workspace.json"
);
const workflowEventStorePath = path.join(configDirPath, "workflow-events.json");
const enrichmentStorePath = path.join(
  configDirPath,
  "editorial-enrichment-suggestions.json"
);
const now = "2026-05-30T10:00:00.000Z";
const internalOnlyTerms = [
  "EditorialEnrichmentSuggestion",
  "generationMode",
  "sourceInputs",
  "reviewerNotes",
  "ai_assisted_placeholder",
  "workflow-events.json",
  "rawPayload",
  "importStatus",
  "duplicateGroupId",
  "qualityFlags",
  "WorkflowEvent"
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

function writeEnrichmentSuggestionsEmpty() {
  mkdirSync(configDirPath, { recursive: true });
  writeFileSync(
    enrichmentStorePath,
    `${JSON.stringify({ updatedAt: now, suggestions: [] }, null, 2)}\n`,
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
    id: "editorial-enrichment-draft",
    slug: "editorial-enrichment-validation",
    title: {
      original: "Editorial enrichment validation technology",
      zh: "Editorial enrichment validation technology"
    },
    summary: {
      original:
        "A complete validation item used to verify editorial enrichment suggestions before publication.",
      zh:
        "A complete validation item used to verify editorial enrichment suggestions before publication."
    },
    content: {
      original:
        "This validation content is long enough to pass publication checks while exercising deterministic editorial enrichment suggestions for content intelligence fields.",
      zh:
        "This validation content is long enough to pass publication checks while exercising deterministic editorial enrichment suggestions for content intelligence fields."
    },
    type: "tool",
    publishDate: "2026-05-30",
    sourceName: "Editorial Enrichment Validation",
    sourceUrl: "https://example.com/editorial-enrichment-validation",
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

async function main() {
  const workspaceBackup = backupFile(technologyWorkspaceStorePath);
  const workflowEventBackup = backupFile(workflowEventStorePath);
  const enrichmentBackup = backupFile(enrichmentStorePath);

  try {
    const record = buildTechnologyRecord();
    writeWorkspaceRecords([record]);
    writeEnrichmentSuggestionsEmpty();

    const missingSuggestionReadiness = getTechnologyWorkspacePublishReadiness(
      record.id
    );
    assert.ok(
      missingSuggestionReadiness.warnings.some(
        (warning) => warning.code === "missing-editorial-enrichment-suggestion"
      ),
      "Missing enrichment suggestion should produce a publish warning."
    );

    const firstSuggestion = await generateEditorialEnrichmentSuggestion(record.id);
    assert.equal(firstSuggestion.status, "draft");
    assert.equal(firstSuggestion.generationMode, "rule_based");
    assert.ok(firstSuggestion.generatedFields.whyItMatters);
    assert.equal(
      getTechnologyWorkspaceRecordById(record.id)?.whyItMatters,
      "",
      "Generating a suggestion should not directly change the draft."
    );

    const unreviewedReadiness = getTechnologyWorkspacePublishReadiness(record.id);
    assert.ok(
      unreviewedReadiness.warnings.some(
        (warning) => warning.code === "unreviewed-editorial-enrichment-suggestion"
      ),
      "Unreviewed enrichment suggestion should produce a publish warning."
    );

    updateTechnologyWorkspaceRecord(record.id, {
      summary: {
        original:
          "A changed validation summary that should make the previous enrichment suggestion stale.",
        zh:
          "A changed validation summary that should make the previous enrichment suggestion stale."
      }
    });
    const secondSuggestion = await generateEditorialEnrichmentSuggestion(record.id);
    const staleSuggestion = getEditorialEnrichmentSuggestionById(firstSuggestion.id);
    assert.equal(
      staleSuggestion?.status,
      "stale",
      "Regeneration after source-input changes should mark old draft suggestions stale."
    );

    const applied = applyEditorialEnrichmentSuggestion(
      record.id,
      secondSuggestion.id
    );
    assert.equal(applied.suggestion.status, "applied");
    assert.ok(applied.record.whyItMatters?.length);
    assert.ok((applied.record.relatedKnowledgeExplanations ?? {})["knowledge-tool-use"]);
    assert.ok((applied.record.relatedSkillExplanations ?? {})["skill-agent-design"]);

    const reviewedReadiness = getTechnologyWorkspacePublishReadiness(record.id);
    assert.equal(
      reviewedReadiness.warnings.some(
        (warning) => warning.code === "unreviewed-editorial-enrichment-suggestion"
      ),
      false,
      "Applied latest enrichment suggestion should clear unreviewed-suggestion warning."
    );

    const thirdSuggestion = await generateEditorialEnrichmentSuggestion(record.id);
    const beforeRejectWhyItMatters = getTechnologyWorkspaceRecordById(
      record.id
    )?.whyItMatters;
    const rejectedSuggestion = rejectEditorialEnrichmentSuggestion(
      record.id,
      thirdSuggestion.id,
      "Too generic for this draft."
    );
    assert.equal(rejectedSuggestion.status, "rejected");
    assert.equal(rejectedSuggestion.reviewerNotes, "Too generic for this draft.");
    assert.equal(
      getTechnologyWorkspaceRecordById(record.id)?.whyItMatters,
      beforeRejectWhyItMatters,
      "Rejecting a suggestion should not change the draft."
    );

    const suggestions = getEditorialEnrichmentSuggestionsForDraft(record.id);
    assert.equal(suggestions.length, 3);

    const events = getWorkflowEvents().filter(
      (event) => event.entityType === "technology_draft" && event.entityId === record.id
    );
    assert.ok(
      events.some((event) => event.action === "editorial_enrichment.generated"),
      "Generation should be recorded as a workflow event."
    );
    assert.ok(
      events.some((event) => event.action === "editorial_enrichment.applied"),
      "Apply should be recorded as a workflow event."
    );
    assert.ok(
      events.some((event) => event.action === "editorial_enrichment.rejected"),
      "Reject should be recorded as a workflow event."
    );

    const publicTechnology = toUserFacingTechnologyItem(applied.record);
    assert.equal(publicTechnology.whyItMatters, applied.record.whyItMatters);
    assertNoInternalTerms(publicTechnology, "User-facing technology");

    console.log("Editorial enrichment validation passed.");
  } finally {
    restoreFile(technologyWorkspaceStorePath, workspaceBackup);
    restoreFile(workflowEventStorePath, workflowEventBackup);
    restoreFile(enrichmentStorePath, enrichmentBackup);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

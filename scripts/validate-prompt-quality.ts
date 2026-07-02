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
  getTechnologyWorkspaceRecordById,
  updateTechnologyWorkspaceRecord
} from "../src/lib/technology-draft-workflow";
import { toUserFacingTechnologyItem } from "../src/lib/content";
import {
  applyEditorialEnrichmentSuggestion,
  generateEditorialEnrichmentSuggestion,
  rejectEditorialEnrichmentSuggestion,
  reviewEditorialEnrichmentSuggestion
} from "../src/lib/editorial-enrichment";
import { getEditorialEnrichmentSuggestionsForDraft } from "../src/lib/editorial-enrichment-store";
import {
  ensureDefaultPromptVersion,
  getActivePromptVersion
} from "../src/lib/prompt-versions";
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
const promptVersionStorePath = path.join(configDirPath, "prompt-versions.json");
const now = "2026-05-30T10:00:00.000Z";
const internalOnlyTerms = [
  "EditorialEnrichmentSuggestion",
  "promptVersionId",
  "promptVersion",
  "qualityScore",
  "qualityLabels",
  "reviewerNotes",
  "rejectionReason",
  "appliedFields",
  "sourceInputs",
  "generationMode",
  "providerName",
  "modelName",
  "tokenUsage",
  "WorkflowEvent",
  "rawPayload",
  "importStatus",
  "duplicateGroupId"
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

function writeJsonFile(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeWorkspaceRecords(records: TechnologyWorkspaceRecord[]) {
  writeJsonFile(technologyWorkspaceStorePath, {
    updatedAt: now,
    records
  });
}

function buildTechnologyRecord(
  overrides: Partial<TechnologyWorkspaceRecord> = {}
): TechnologyWorkspaceRecord {
  return {
    id: "prompt-quality-draft",
    slug: "prompt-quality-validation",
    title: {
      original: "Prompt quality validation technology",
      zh: "Prompt quality validation technology"
    },
    summary: {
      original:
        "A complete validation item used to verify prompt-versioned enrichment suggestions.",
      zh:
        "A complete validation item used to verify prompt-versioned enrichment suggestions."
    },
    content: {
      original:
        "This validation content is long enough to exercise prompt versions, quality review, selected-field apply, rejection, and user-facing isolation.",
      zh:
        "This validation content is long enough to exercise prompt versions, quality review, selected-field apply, rejection, and user-facing isolation."
    },
    type: "tool",
    publishDate: "2026-05-30",
    sourceName: "Prompt Quality Validation",
    sourceUrl: "https://example.com/prompt-quality-validation",
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

async function main() {
  const workspaceBackup = backupFile(technologyWorkspaceStorePath);
  const workflowEventBackup = backupFile(workflowEventStorePath);
  const enrichmentBackup = backupFile(enrichmentStorePath);
  const promptVersionBackup = backupFile(promptVersionStorePath);

  try {
    writeWorkspaceRecords([buildTechnologyRecord()]);
    writeJsonFile(enrichmentStorePath, { updatedAt: now, suggestions: [] });
    writeJsonFile(workflowEventStorePath, { updatedAt: now, events: [] });
    writeJsonFile(promptVersionStorePath, { updatedAt: now, promptVersions: [] });

    const promptVersion = ensureDefaultPromptVersion();
    assert.equal(promptVersion.id, getActivePromptVersion("editorial_enrichment").id);

    const firstSuggestion = await generateEditorialEnrichmentSuggestion(
      "prompt-quality-draft"
    );
    assert.equal(firstSuggestion.promptVersionId, promptVersion.id);
    assert.equal(firstSuggestion.reviewStatus, "unreviewed");

    const reviewed = reviewEditorialEnrichmentSuggestion(
      "prompt-quality-draft",
      firstSuggestion.id,
      {
        qualityScore: 4,
        qualityLabels: ["accurate", "good_enough"],
        reviewerNotes: "Usable after checking source specificity."
      }
    );
    assert.equal(reviewed.qualityScore, 4);
    assert.deepEqual(reviewed.qualityLabels, ["accurate", "good_enough"]);
    assert.ok(reviewed.reviewedAt);

    const applied = applyEditorialEnrichmentSuggestion(
      "prompt-quality-draft",
      firstSuggestion.id,
      {
        fieldsToApply: ["whyItMatters", "whoShouldCare"],
        qualityScore: 5,
        qualityLabels: ["clear"],
        reviewerNotes: "Only user value and audience are ready."
      }
    );
    assert.equal(applied.suggestion.reviewStatus, "partially_accepted");
    assert.deepEqual(applied.suggestion.appliedFields, [
      "whyItMatters",
      "whoShouldCare"
    ]);
    assert.ok(applied.record.whyItMatters);
    assert.ok((applied.record.whoShouldCare ?? []).length > 0);
    assert.equal(
      applied.record.technicalContext,
      "",
      "Apply selected should not overwrite unselected generated fields."
    );

    const secondSuggestion = await generateEditorialEnrichmentSuggestion(
      "prompt-quality-draft"
    );
    updateTechnologyWorkspaceRecord("prompt-quality-draft", {
      summary: {
        original:
          "A changed validation summary that should mark the pending suggestion stale.",
        zh:
          "A changed validation summary that should mark the pending suggestion stale."
      }
    });
    const thirdSuggestion = await generateEditorialEnrichmentSuggestion(
      "prompt-quality-draft"
    );
    const suggestionsAfterRegenerate = getEditorialEnrichmentSuggestionsForDraft(
      "prompt-quality-draft"
    );
    assert.equal(
      suggestionsAfterRegenerate.find((item) => item.id === secondSuggestion.id)
        ?.status,
      "stale",
      "Input changes should mark older pending suggestions stale."
    );

    const beforeRejectTechnicalContext =
      getTechnologyWorkspaceRecordById("prompt-quality-draft")?.technicalContext;
    const rejected = rejectEditorialEnrichmentSuggestion(
      "prompt-quality-draft",
      thirdSuggestion.id,
      {
        qualityScore: 2,
        qualityLabels: ["too_generic", "needs_human_edit"],
        reviewerNotes: "Too broad for the source material.",
        rejectionReason: "Insufficient source-specific context."
      }
    );
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.reviewStatus, "rejected");
    assert.equal(rejected.rejectionReason, "Insufficient source-specific context.");
    assert.equal(
      getTechnologyWorkspaceRecordById("prompt-quality-draft")?.technicalContext,
      beforeRejectTechnicalContext,
      "Rejecting a suggestion should not change draft fields."
    );

    const finalSuggestions = getEditorialEnrichmentSuggestionsForDraft(
      "prompt-quality-draft"
    );
    assert.ok(finalSuggestions.length >= 3);

    const eventActions = new Set(getWorkflowEvents().map((event) => event.action));
    for (const expectedAction of [
      "prompt_version.created",
      "enrichment_suggestion.generated",
      "enrichment_suggestion.reviewed",
      "enrichment_suggestion.applied",
      "enrichment_suggestion.rejected",
      "enrichment_suggestion.marked_stale"
    ]) {
      assert.equal(
        eventActions.has(expectedAction),
        true,
        `WorkflowEvent should include ${expectedAction}.`
      );
    }

    assertNoInternalTerms(
      toUserFacingTechnologyItem(applied.record),
      "User-facing technology"
    );

    console.log("Prompt quality validation passed.");
  } finally {
    restoreFile(technologyWorkspaceStorePath, workspaceBackup);
    restoreFile(workflowEventStorePath, workflowEventBackup);
    restoreFile(enrichmentStorePath, enrichmentBackup);
    restoreFile(promptVersionStorePath, promptVersionBackup);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

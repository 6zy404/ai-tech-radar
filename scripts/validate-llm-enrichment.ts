import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

process.env.PERSISTENCE_DRIVER = "json";
process.env.LLM_API_KEY = "";

import { getTechnologyWorkspaceRecordById } from "../src/lib/candidate-workflow";
import { toUserFacingTechnologyItem } from "../src/lib/content";
import {
  applyEditorialEnrichmentSuggestion,
  generateEditorialEnrichmentSuggestion,
  rejectEditorialEnrichmentSuggestion
} from "../src/lib/editorial-enrichment";
import { getEditorialEnrichmentSuggestionsForDraft } from "../src/lib/editorial-enrichment-store";
import { validateEditorialEnrichmentLlmOutput } from "../src/lib/llm/editorial-enrichment-output";
import { getLlmProviderConfig } from "../src/lib/llm/provider";
import { getWorkflowEvents } from "../src/lib/workflow-events";
import type {
  EditorialEnrichmentSourceInputs,
  TechnologyWorkspaceRecord
} from "../src/types/content";

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
  "providerName",
  "modelName",
  "promptVersion",
  "tokenUsage",
  "generationError",
  "LLM_API_KEY",
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "qualityFlags",
  "WorkflowEvent",
  "DeliveryLog"
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

function buildTechnologyRecord(
  overrides: Partial<TechnologyWorkspaceRecord> = {}
): TechnologyWorkspaceRecord {
  return {
    id: "llm-enrichment-draft",
    slug: "llm-enrichment-validation",
    title: {
      original: "LLM enrichment validation technology",
      zh: "LLM enrichment validation technology"
    },
    summary: {
      original:
        "A complete validation item used to verify optional LLM-assisted editorial enrichment suggestions.",
      zh:
        "A complete validation item used to verify optional LLM-assisted editorial enrichment suggestions."
    },
    content: {
      original:
        "This validation content is long enough to exercise prompt construction, mock provider generation, output validation, apply, reject, and user-facing field isolation.",
      zh:
        "This validation content is long enough to exercise prompt construction, mock provider generation, output validation, apply, reject, and user-facing field isolation."
    },
    type: "tool",
    publishDate: "2026-05-30",
    sourceName: "LLM Enrichment Validation",
    sourceUrl: "https://example.com/llm-enrichment-validation",
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

function getSourceInputs(): EditorialEnrichmentSourceInputs {
  return {
    title: { original: "Schema validation title" },
    summary: { original: "Schema validation summary" },
    contentPreview: "Schema validation content preview.",
    sourceName: "Schema Source",
    publisherName: "Schema Publisher",
    sourceLanguage: "en",
    tags: ["agent"],
    priorityLevel: "watch",
    priorityReasons: ["Complete source metadata."],
    relatedKnowledge: [{ id: "knowledge-tool-use", title: "Tool use" }],
    relatedSkills: [{ id: "skill-agent-design", title: "Agent design" }],
    inputSignature: "schema-input"
  };
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root).flatMap((entry) => {
    const fullPath = path.join(root, entry);
    const stats = statSync(fullPath);

    return stats.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function assertNoClientLlmApiKeyReference() {
  const clientFiles = [
    ...listFiles(path.join(process.cwd(), "src", "components")),
    ...listFiles(path.join(process.cwd(), "src", "app", "technologies")),
    ...listFiles(path.join(process.cwd(), "src", "app", "digest"))
  ].filter((filePath) => /\.(ts|tsx|js|jsx)$/.test(filePath));

  for (const filePath of clientFiles) {
    const content = readFileSync(filePath, "utf8");

    assert.equal(
      content.includes("LLM_API_KEY"),
      false,
      `${filePath} should not reference LLM_API_KEY.`
    );
  }
}

async function main() {
  const workspaceBackup = backupFile(technologyWorkspaceStorePath);
  const workflowEventBackup = backupFile(workflowEventStorePath);
  const enrichmentBackup = backupFile(enrichmentStorePath);
  const originalMockResponse = process.env.LLM_MOCK_RESPONSE;
  const originalProvider = process.env.LLM_PROVIDER;
  const originalApiKey = process.env.LLM_API_KEY;

  try {
    const record = buildTechnologyRecord();
    writeWorkspaceRecords([record]);
    writeEnrichmentSuggestionsEmpty();

    const providerConfig = getLlmProviderConfig();
    assert.equal(
      providerConfig.provider,
      "mock",
      "Missing LLM_API_KEY should fall back to the mock provider."
    );

    const ruleBasedSuggestion = await generateEditorialEnrichmentSuggestion(
      record.id,
      { generationMode: "rule_based" }
    );
    assert.equal(ruleBasedSuggestion.generationMode, "rule_based");
    assert.ok(ruleBasedSuggestion.generatedFields.whyItMatters);

    const mockSuggestion = await generateEditorialEnrichmentSuggestion(record.id, {
      generationMode: "llm_assisted"
    });
    assert.equal(
      mockSuggestion.generationMode,
      "mock_llm",
      "LLM-assisted generation without a real key should safely use mock_llm."
    );
    assert.equal(mockSuggestion.providerName, "mock");
    assert.equal(mockSuggestion.outputValidationStatus, "valid");
    assert.ok(mockSuggestion.generatedFields.whyItMatters);
    assert.ok((mockSuggestion.limitations ?? []).length > 0);

    assert.equal(
      getTechnologyWorkspaceRecordById(record.id)?.whyItMatters,
      "",
      "Generating a suggestion should not update the draft before apply."
    );

    const applied = applyEditorialEnrichmentSuggestion(record.id, mockSuggestion.id);
    assert.ok(applied.record.whyItMatters);
    assert.equal(applied.suggestion.status, "applied");

    const rejectCandidate = await generateEditorialEnrichmentSuggestion(record.id, {
      generationMode: "mock_llm"
    });
    const beforeRejectWhyItMatters =
      getTechnologyWorkspaceRecordById(record.id)?.whyItMatters;
    const rejected = rejectEditorialEnrichmentSuggestion(
      record.id,
      rejectCandidate.id,
      "Needs more specific source evidence."
    );
    assert.equal(rejected.status, "rejected");
    assert.equal(
      getTechnologyWorkspaceRecordById(record.id)?.whyItMatters,
      beforeRejectWhyItMatters,
      "Rejecting a suggestion should not update content intelligence fields."
    );

    process.env.LLM_PROVIDER = "mock";
    process.env.LLM_MOCK_RESPONSE = "{ invalid json";
    const failedSuggestion = await generateEditorialEnrichmentSuggestion(record.id, {
      generationMode: "mock_llm"
    });
    assert.equal(failedSuggestion.outputValidationStatus, "failed");
    assert.ok(failedSuggestion.generationError);

    assert.throws(
      () => applyEditorialEnrichmentSuggestion(record.id, failedSuggestion.id),
      /Failed editorial enrichment suggestions cannot be applied/
    );

    const invalidJsonValidation = validateEditorialEnrichmentLlmOutput(
      "{ invalid json",
      getSourceInputs()
    );
    assert.equal(invalidJsonValidation.ok, false);
    assert.match(invalidJsonValidation.error ?? "", /valid JSON/);

    const internalFieldValidation = validateEditorialEnrichmentLlmOutput(
      JSON.stringify({
        whyItMatters: "Looks useful.",
        rawPayload: { secret: true }
      }),
      getSourceInputs()
    );
    assert.equal(internalFieldValidation.ok, false);
    assert.match(internalFieldValidation.error ?? "", /internal-only/);

    const events = getWorkflowEvents().filter(
      (event) => event.entityType === "technology_draft" && event.entityId === record.id
    );
    assert.ok(
      events.some((event) => event.action === "editorial_enrichment.generated"),
      "Successful generation should record a workflow event."
    );
    assert.ok(
      events.some((event) => event.action === "editorial_enrichment.failed"),
      "Failed generation should record a workflow event."
    );

    const publicTechnology = toUserFacingTechnologyItem(applied.record);
    assertNoInternalTerms(publicTechnology, "User-facing technology");
    assertNoInternalTerms(
      {
        title: publicTechnology.title,
        summary: publicTechnology.summary,
        content: publicTechnology.content,
        whyItMatters: publicTechnology.whyItMatters
      },
      "User-facing excerpt"
    );
    assertNoClientLlmApiKeyReference();

    const suggestions = getEditorialEnrichmentSuggestionsForDraft(record.id);
    assert.ok(suggestions.length >= 4);

    console.log("LLM enrichment validation passed.");
  } finally {
    process.env.LLM_MOCK_RESPONSE = originalMockResponse;
    process.env.LLM_PROVIDER = originalProvider;
    process.env.LLM_API_KEY = originalApiKey;
    restoreFile(technologyWorkspaceStorePath, workspaceBackup);
    restoreFile(workflowEventStorePath, workflowEventBackup);
    restoreFile(enrichmentStorePath, enrichmentBackup);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

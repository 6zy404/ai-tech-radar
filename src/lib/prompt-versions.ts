import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "@/lib/repositories/local-json-store";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type { PromptPurpose, PromptVersion } from "@/types/content";

interface PromptVersionStore {
  updatedAt: string;
  promptVersions: PromptVersion[];
}

const promptVersionStorePath = getLocalStoreFilePath("prompt-versions.json");
const defaultPromptCreatedAt = "2026-05-30T00:00:00.000Z";

export const editorialEnrichmentPromptOutputSchema = {
  type: "object",
  required: [
    "whyItMatters",
    "whoShouldCare",
    "technicalContext",
    "impactAreas",
    "learningPath",
    "relatedKnowledgeExplanations",
    "relatedSkillExplanations",
    "followUpQuestions",
    "readingDifficulty",
    "confidence",
    "limitations"
  ],
  properties: {
    whyItMatters: "string",
    whoShouldCare: "string[]",
    technicalContext: "string",
    impactAreas: "string[]",
    learningPath: "string[]",
    relatedKnowledgeExplanations: "object keyed by related knowledge id",
    relatedSkillExplanations: "object keyed by related skill id",
    followUpQuestions: "string[]",
    readingDifficulty: "beginner | intermediate | advanced",
    confidence: "number from 0 to 1",
    limitations: "string[]"
  }
};

export const defaultEditorialEnrichmentPromptVersion: PromptVersion = {
  id: "prompt-editorial-enrichment-v1",
  name: "Editorial enrichment structured JSON",
  purpose: "editorial_enrichment",
  version: "editorial-enrichment-v1",
  status: "active",
  template:
    "You are an editorial assistant for a high-impact new technology discovery platform. Return only valid JSON. Do not invent facts beyond the provided source material. If evidence is insufficient, put that uncertainty in limitations. Do not include internal workflow fields, raw payloads, audit logs, delivery logs, API keys, endpoint URLs, or reviewer-only information.",
  outputSchema: editorialEnrichmentPromptOutputSchema,
  createdAt: defaultPromptCreatedAt,
  updatedAt: defaultPromptCreatedAt,
  notes:
    "Default v1 prompt for workspace-only editorial enrichment suggestions."
};

export const technologyComparisonPromptOutputSchema = {
  type: "object",
  required: ["similarities", "differences", "whenToPreferA", "whenToPreferB"],
  properties: {
    similarities: "string[] (max 6 items)",
    differences: "string[] (max 6 items)",
    whenToPreferA: "string — when a reader should prefer the first technology",
    whenToPreferB: "string — when a reader should prefer the second technology",
    sharedConsiderations: "string[] optional (max 6 items)"
  }
};

export const defaultTechnologyComparisonPromptVersion: PromptVersion = {
  id: "prompt-technology-comparison-v1",
  name: "Technology comparison structured JSON",
  purpose: "technology_comparison",
  version: "technology-comparison-v1",
  status: "active",
  template:
    "You are helping a reader compare two published AI technology signals on a technology discovery platform. Return only valid JSON. Do not invent facts beyond the provided source material for either technology. Be concise and concrete. Do not include internal workflow fields, raw payloads, audit logs, delivery logs, API keys, endpoint URLs, provider or model names, or reviewer-only information.",
  outputSchema: technologyComparisonPromptOutputSchema,
  createdAt: defaultPromptCreatedAt,
  updatedAt: defaultPromptCreatedAt,
  notes:
    "Default v1 prompt for the public-facing technology comparison feature."
};

export const technologyExplanationPromptOutputSchema = {
  type: "object",
  required: ["explanation", "keyPoints"],
  properties: {
    explanation:
      "string — a plain-language explanation of the technology signal tailored to the reader level",
    keyPoints:
      "string[] (max 5 items) — what a reader at this level should grasp",
    analogy:
      "string optional — a concrete everyday analogy, most useful for beginners",
    nextSteps:
      "string[] optional (max 4 items) — level-appropriate next actions"
  }
};

export const defaultTechnologyExplanationPromptVersion: PromptVersion = {
  id: "prompt-technology-explanation-v1",
  name: "Technology explanation structured JSON",
  purpose: "technology_explanation",
  version: "technology-explanation-v1",
  status: "active",
  template:
    "You are helping a reader understand one published AI technology signal on a technology discovery platform, at the reader's self-selected experience level. Return only valid JSON. Do not invent facts beyond the provided source material. Match depth and vocabulary to the requested level: beginner explanations avoid jargon and lean on analogies, advanced explanations may assume engineering context. Do not include internal workflow fields, raw payloads, audit logs, delivery logs, API keys, endpoint URLs, provider or model names, or reviewer-only information.",
  outputSchema: technologyExplanationPromptOutputSchema,
  createdAt: defaultPromptCreatedAt,
  updatedAt: defaultPromptCreatedAt,
  notes:
    "Default v1 prompt for the public-facing per-level technology explanation feature."
};

export const technologyLearningPathPromptOutputSchema = {
  type: "object",
  required: ["overview", "steps"],
  properties: {
    overview:
      "string — one-paragraph summary of what this learning path prepares the reader to do",
    steps:
      "string[] (3-6 items, ordered) — concrete learning steps that build on the provided related knowledge and skills",
    checkpoints:
      "string[] optional (max 4 items) — self-check questions to confirm understanding"
  }
};

export const defaultTechnologyLearningPathPromptVersion: PromptVersion = {
  id: "prompt-technology-learning-path-v1",
  name: "Technology learning path structured JSON",
  purpose: "technology_learning_path",
  version: "technology-learning-path-v1",
  status: "active",
  template:
    "You are helping a reader plan how to learn one published AI technology signal on a technology discovery platform. Build the path on the provided related background knowledge and related skills — reference them by name in the steps where they fit, and do not invent resources or facts beyond the provided source material. Order steps from foundation to application. Return only valid JSON. Do not include internal workflow fields, raw payloads, audit logs, delivery logs, API keys, endpoint URLs, provider or model names, or reviewer-only information.",
  outputSchema: technologyLearningPathPromptOutputSchema,
  createdAt: defaultPromptCreatedAt,
  updatedAt: defaultPromptCreatedAt,
  notes:
    "Default v1 prompt for the public-facing graph-grounded learning path feature."
};

function getDefaultPromptVersionForPurpose(
  purpose: PromptPurpose
): PromptVersion {
  switch (purpose) {
    case "technology_comparison":
      return defaultTechnologyComparisonPromptVersion;
    case "technology_explanation":
      return defaultTechnologyExplanationPromptVersion;
    case "technology_learning_path":
      return defaultTechnologyLearningPathPromptVersion;
    default:
      return defaultEditorialEnrichmentPromptVersion;
  }
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function getDefaultStore(): PromptVersionStore {
  return {
    updatedAt: getTimestamp(),
    promptVersions: []
  };
}

function normalizePromptVersion(value: PromptVersion): PromptVersion {
  const now = getTimestamp();
  const purpose = value.purpose ?? "editorial_enrichment";

  return {
    ...getDefaultPromptVersionForPurpose(purpose),
    ...value,
    purpose,
    status: value.status ?? "draft",
    outputSchema: value.outputSchema ?? {},
    createdAt: value.createdAt ?? now,
    updatedAt: value.updatedAt ?? now
  };
}

function readStore(): PromptVersionStore {
  const store = readLocalJsonFile<PromptVersionStore>(
    promptVersionStorePath,
    getDefaultStore()
  );

  return {
    updatedAt: store.updatedAt ?? getTimestamp(),
    promptVersions: (store.promptVersions ?? []).map(normalizePromptVersion)
  };
}

function writeStore(store: PromptVersionStore): void {
  writeLocalJsonFile(promptVersionStorePath, {
    updatedAt: getTimestamp(),
    promptVersions: store.promptVersions.map(normalizePromptVersion)
  });
}

export function getPromptVersions(): PromptVersion[] {
  const store = readStore();

  return store.promptVersions.length > 0
    ? store.promptVersions
    : [
        defaultEditorialEnrichmentPromptVersion,
        defaultTechnologyComparisonPromptVersion,
        defaultTechnologyExplanationPromptVersion,
        defaultTechnologyLearningPathPromptVersion
      ];
}

export function getPromptVersionById(
  promptVersionId: string
): PromptVersion | undefined {
  return getPromptVersions().find((prompt) => prompt.id === promptVersionId);
}

export function getActivePromptVersion(purpose: PromptPurpose): PromptVersion {
  const promptVersions = getPromptVersions();
  const activePrompt = promptVersions.find(
    (prompt) => prompt.purpose === purpose && prompt.status === "active"
  );

  return activePrompt ?? getDefaultPromptVersionForPurpose(purpose);
}

export function ensureDefaultPromptVersion(
  purpose: PromptPurpose = "editorial_enrichment"
): PromptVersion {
  const defaultPromptVersion = getDefaultPromptVersionForPurpose(purpose);
  const store = readStore();
  const existingPrompt = store.promptVersions.find(
    (prompt) => prompt.id === defaultPromptVersion.id
  );

  if (existingPrompt) {
    return existingPrompt;
  }

  writeStore({
    updatedAt: getTimestamp(),
    promptVersions: [defaultPromptVersion, ...store.promptVersions]
  });
  tryRecordWorkflowEvent({
    entityType: "prompt_version",
    entityId: defaultPromptVersion.id,
    action: "prompt_version.created",
    actorType: "system",
    afterSnapshot: {
      id: defaultPromptVersion.id,
      name: defaultPromptVersion.name,
      purpose: defaultPromptVersion.purpose,
      version: defaultPromptVersion.version,
      status: defaultPromptVersion.status
    },
    metadata: {
      purpose: defaultPromptVersion.purpose,
      version: defaultPromptVersion.version
    }
  });

  return defaultPromptVersion;
}

export function savePromptVersions(promptVersions: PromptVersion[]): void {
  writeStore({
    updatedAt: getTimestamp(),
    promptVersions
  });
}

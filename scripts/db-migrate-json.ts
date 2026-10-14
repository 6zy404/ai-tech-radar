import {
  getLocalStoreFilePath,
  readLocalJsonDiskFile
} from "../src/lib/repositories/local-json-store";
import {
  getSqliteDatabasePath,
  migrateJsonStoresToSqlite,
  runtimeConfigStoreFileNames
} from "../src/lib/repositories/sqlite-store";
import type {
  DailyDigest,
  DeliveryChannel,
  DeliveryRun,
  DuplicateGroup,
  EditorialEnrichmentSuggestion,
  ExternalSource,
  ImportRun,
  ImportedCandidateSnapshot,
  KnowledgeWorkspaceRecord,
  LinkRelation,
  PromptVersion,
  ScheduledDelivery,
  ScheduledDeliveryRun,
  SkillWorkspaceRecord,
  TaskRunnerRun,
  TechnologyComparisonRecord,
  TechnologyExplanationRecord,
  TechnologyLearningPathRecord,
  TechnologyWorkspaceRecord,
  WorkflowEvent
} from "../src/types/content";
import type { RadarWorkspaceRecord } from "../src/types/radar";

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

function readStore<T>(fileName: string, fallbackValue: T): T {
  return readLocalJsonDiskFile(getLocalStoreFilePath(fileName), fallbackValue);
}

const now = new Date().toISOString();
const summary = migrateJsonStoresToSqlite({
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
  } satisfies PromptVersionStore),
  skillWorkspace: readStore("skill-workspace.json", {
    updatedAt: now,
    records: [] as SkillWorkspaceRecord[]
  }),
  knowledgeWorkspace: readStore("knowledge-workspace.json", {
    updatedAt: now,
    records: [] as KnowledgeWorkspaceRecord[]
  }),
  radarWorkspace: readStore("radar-workspace.json", {
    updatedAt: now,
    records: [] as RadarWorkspaceRecord[]
  }),
  linkRelationWorkspace: readStore("link-relation-workspace.json", {
    updatedAt: now,
    relations: [] as LinkRelation[]
  }),
  // Schedule configs, 本周总结, triage and semantic-match caches, reader push
  // subscriptions: a file that does not exist is left out, not written empty.
  runtimeConfigs: Object.fromEntries(
    runtimeConfigStoreFileNames.map((fileName) => [
      fileName,
      readStore<unknown>(fileName, undefined)
    ])
  ),
  technologyComparisons: readStore("technology-comparisons.json", {
    updatedAt: now,
    comparisons: [] as TechnologyComparisonRecord[]
  }),
  technologyExplanations: readStore("technology-explanations.json", {
    updatedAt: now,
    explanations: [] as TechnologyExplanationRecord[]
  }),
  technologyLearningPaths: readStore("technology-learning-paths.json", {
    updatedAt: now,
    learningPaths: [] as TechnologyLearningPathRecord[]
  })
});

console.log(`JSON stores migrated into SQLite at ${getSqliteDatabasePath()}`);
console.table(summary);

if (summary.errors > 0) {
  process.exitCode = 1;
}

import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

import {
  convertImportedCandidateToDraft,
  getCandidateDraftConversionReadiness,
  getCandidateWorkflowData,
  updateDuplicateGroup
} from "../src/lib/candidate-workflow";
import {
  updateTechnologyWorkspaceRecord,
  updateTechnologyWorkspaceStatus
} from "../src/lib/technology-draft-workflow";
import { getAllTechnologies, getTechnologyBySlug } from "../src/lib/content";
import {
  evaluateCandidateQuality,
  evaluateSourceQuality
} from "../src/lib/quality-signals";
import {
  evaluateImportedCandidatePriority,
  evaluateTechnologyPriority
} from "../src/lib/ranking";
import type {
  ExternalSource,
  ImportRun,
  ImportedCandidate,
  ImportedCandidateSnapshot,
  TechnologyItem
} from "../src/types/content";

const configDirPath = path.join(process.cwd(), "config");
const externalSourcesStorePath = path.join(
  configDirPath,
  "external-sources.json"
);
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
const duplicateGroupStorePath = path.join(
  configDirPath,
  "duplicate-groups.json"
);
const now = new Date("2026-05-22T12:00:00.000Z");

const internalOnlyFields = [
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "relatedCandidateIds",
  "candidateQuality",
  "qualityFlags",
  "sourceQuality",
  "sourceQualityMetrics"
] as const;

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

  writeFileSync(filePath, value, "utf8");
}

function writeJsonFile(filePath: string, value: unknown) {
  mkdirSync(configDirPath, { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildSource(overrides: Partial<ExternalSource>): ExternalSource {
  return {
    id: overrides.id ?? "ranking-source",
    name: overrides.name ?? "Ranking Source",
    type: overrides.type ?? "rss",
    url: overrides.url ?? "https://example.com/ranking.xml",
    enabled: overrides.enabled ?? true,
    description: overrides.description ?? "Ranking validation source.",
    language: overrides.language ?? "en",
    publisherName: overrides.publisherName ?? "Ranking Publisher",
    publisherType: overrides.publisherType ?? "media",
    defaultTags: overrides.defaultTags ?? ["ranking"],
    defaultNormalizedType: overrides.defaultNormalizedType ?? "tool",
    lastFetchedAt: overrides.lastFetchedAt ?? now.toISOString(),
    lastImportStatus: overrides.lastImportStatus ?? "success",
    lastImportMessage:
      overrides.lastImportMessage ?? "Ranking validation import.",
    lastImportCount: overrides.lastImportCount ?? 1,
    lastErrorMessage: overrides.lastErrorMessage,
    consecutiveFailureCount: overrides.consecutiveFailureCount ?? 0,
    totalImportedCount: overrides.totalImportedCount ?? 1,
    lastSuccessfulImportAt:
      overrides.lastSuccessfulImportAt ?? now.toISOString(),
    createdAt: overrides.createdAt ?? now.toISOString(),
    updatedAt: overrides.updatedAt ?? now.toISOString()
  };
}

function buildCandidate(
  overrides: Partial<ImportedCandidate> &
    Pick<ImportedCandidate, "id" | "originalTitle">
): ImportedCandidate {
  const sourceId = overrides.sourceId ?? "ranking-good-source";
  const sourceName = overrides.sourceName ?? "Ranking Good Source";

  return {
    id: overrides.id,
    sourceId,
    sourceType: overrides.sourceType ?? "rss-feed",
    sourceName,
    sourceUrl: overrides.sourceUrl ?? `https://example.com/${overrides.id}`,
    originalTitle: overrides.originalTitle,
    originalSummary:
      overrides.originalSummary ??
      "A complete ranking validation candidate with enough context for priority triage.",
    originalContent:
      overrides.originalContent ??
      "A complete ranking validation body that includes enough detail to avoid quality blocking issues and demonstrate rule-based priority calculation for reviewers.",
    originalLanguage: overrides.originalLanguage ?? "en",
    publishDate: overrides.publishDate ?? "2026-05-20",
    publisherName: overrides.publisherName ?? "Ranking Publisher",
    normalizedType: overrides.normalizedType ?? "tool",
    tags: overrides.tags ?? ["ranking", "validation"],
    importStatus: overrides.importStatus ?? "new",
    relatedCandidateIds: overrides.relatedCandidateIds ?? [],
    rawPayload: overrides.rawPayload ?? {
      sourceId
    }
  };
}

function resetStores() {
  const sources = [
    buildSource({
      id: "ranking-good-source",
      name: "Ranking Good Source",
      url: "https://example.com/ranking-good.xml",
      totalImportedCount: 1
    }),
    buildSource({
      id: "ranking-duplicate-source",
      name: "Ranking Duplicate Source",
      url: "https://example.com/ranking-duplicate.xml",
      lastImportCount: 2,
      totalImportedCount: 2
    }),
    buildSource({
      id: "ranking-poor-source",
      name: "Ranking Poor Source",
      url: "https://example.com/ranking-poor.xml",
      lastImportStatus: "failed",
      lastErrorMessage: "Validation source failed.",
      consecutiveFailureCount: 3,
      lastImportCount: 1,
      totalImportedCount: 1
    })
  ];
  const importRuns: ImportRun[] = [
    {
      id: "ranking-good-run",
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      status: "success",
      totalSources: 1,
      enabledSources: 1,
      skippedSources: 0,
      successfulSources: 1,
      failedSources: 0,
      partialSources: 0,
      totalCandidatesCreated: 1,
      totalCandidatesSkipped: 0,
      messages: ["Good source imported."],
      sourceResults: [
        {
          sourceId: "ranking-good-source",
          sourceName: "Ranking Good Source",
          status: "success",
          message: "Good source imported.",
          candidateCount: 1,
          candidatesCreated: 1,
          candidatesSkipped: 0
        }
      ]
    },
    {
      id: "ranking-poor-run",
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      status: "failed",
      totalSources: 1,
      enabledSources: 1,
      skippedSources: 0,
      successfulSources: 0,
      failedSources: 1,
      partialSources: 0,
      totalCandidatesCreated: 0,
      totalCandidatesSkipped: 0,
      messages: ["Poor source failed."],
      sourceResults: [
        {
          sourceId: "ranking-poor-source",
          sourceName: "Ranking Poor Source",
          status: "failed",
          message: "Poor source failed.",
          candidateCount: 0,
          candidatesCreated: 0,
          candidatesSkipped: 0
        }
      ]
    }
  ];
  const candidates: ImportedCandidate[] = [
    buildCandidate({
      id: "ranking-high-candidate",
      originalTitle: "Ranking high priority validation signal"
    }),
    buildCandidate({
      id: "ranking-poor-candidate",
      sourceId: "ranking-poor-source",
      sourceName: "Ranking Poor Source",
      sourceUrl: "not-a-url",
      originalTitle: "Ranking incomplete validation signal",
      originalSummary: "",
      originalContent: "",
      publishDate: "not-a-date",
      publisherName: "",
      tags: [],
      rawPayload: {
        sourceId: "ranking-poor-source",
        publisherName: ""
      }
    }),
    buildCandidate({
      id: "ranking-duplicate-a",
      sourceId: "ranking-duplicate-source",
      sourceName: "Ranking Duplicate Source",
      sourceUrl: "https://example.com/shared-ranking-event",
      originalTitle: "Shared ranking duplicate event reaches release"
    }),
    buildCandidate({
      id: "ranking-duplicate-b",
      sourceId: "ranking-duplicate-source",
      sourceName: "Ranking Duplicate Source",
      sourceUrl: "https://example.com/shared-ranking-event",
      originalTitle: "Duplicate coverage for shared ranking event"
    })
  ];
  const snapshot: ImportedCandidateSnapshot = {
    syncedAt: now.toISOString(),
    sources: sources.map((source) => ({
      id: source.id,
      sourceType: "rss-feed",
      sourceName: source.name,
      sourceUrl: source.url,
      syncStatus: "fallback",
      itemCount: source.id === "ranking-duplicate-source" ? 2 : 1,
      fetchedAt: now.toISOString()
    })),
    candidates
  };

  writeJsonFile(externalSourcesStorePath, {
    updatedAt: now.toISOString(),
    sources,
    latestImportRun: importRuns[0],
    importRuns
  });
  writeJsonFile(importedCandidatesSnapshotPath, snapshot);
  writeJsonFile(candidateReviewStatePath, {
    updatedAt: now.toISOString(),
    items: {}
  });
  writeJsonFile(technologyWorkspaceStorePath, {
    updatedAt: now.toISOString(),
    records: []
  });
  writeJsonFile(duplicateGroupStorePath, {
    updatedAt: now.toISOString(),
    groups: []
  });
}

function getSourceQuality(sourceId: string, candidates: ImportedCandidate[]) {
  const store = JSON.parse(readFileSync(externalSourcesStorePath, "utf8")) as {
    sources: ExternalSource[];
    importRuns: ImportRun[];
  };
  const source = store.sources.find((item) => item.id === sourceId);

  assert.ok(source, `Expected source ${sourceId} to exist.`);

  return evaluateSourceQuality(source, candidates, store.importRuns);
}

function assertNoInternalQualityFields(item: TechnologyItem) {
  const record = item as unknown as Record<string, unknown>;

  for (const field of internalOnlyFields) {
    assert.equal(
      field in record,
      false,
      `Published item should not expose ${field}.`
    );
  }

  for (const reference of item.sourceReferences ?? []) {
    const referenceRecord = reference as unknown as Record<string, unknown>;

    assert.equal("candidateId" in referenceRecord, false);
    assert.equal("sourceType" in referenceRecord, false);
  }
}

function main() {
  const sourceStoreBackup = backupFile(externalSourcesStorePath);
  const snapshotBackup = backupFile(importedCandidatesSnapshotPath);
  const reviewStateBackup = backupFile(candidateReviewStatePath);
  const workspaceStoreBackup = backupFile(technologyWorkspaceStorePath);
  const duplicateGroupStoreBackup = backupFile(duplicateGroupStorePath);

  try {
    resetStores();

    const { candidates, duplicateGroups } = getCandidateWorkflowData();
    const highCandidate = candidates.find(
      (candidate) => candidate.id === "ranking-high-candidate"
    );
    const poorCandidate = candidates.find(
      (candidate) => candidate.id === "ranking-poor-candidate"
    );
    const duplicateCandidate = candidates.find(
      (candidate) => candidate.id === "ranking-duplicate-a"
    );

    assert.ok(highCandidate, "Expected high-quality candidate to exist.");
    assert.ok(poorCandidate, "Expected poor-quality candidate to exist.");
    assert.ok(duplicateCandidate, "Expected duplicate candidate to exist.");

    const highQuality = evaluateCandidateQuality(highCandidate, {
      canConvert: getCandidateDraftConversionReadiness(highCandidate.id)
        .canConvert
    });
    const highRanking = evaluateImportedCandidatePriority(highCandidate, {
      sourceQuality: getSourceQuality("ranking-good-source", candidates),
      candidateQuality: highQuality,
      now
    });

    assert.ok(
      highRanking.priorityLevel === "high_priority" ||
        highRanking.priorityLevel === "watch",
      "Expected complete high-quality content to become high_priority or watch."
    );
    assert.ok(highRanking.priorityReasons.length > 0);

    const poorRanking = evaluateImportedCandidatePriority(poorCandidate, {
      sourceQuality: getSourceQuality("ranking-poor-source", candidates),
      candidateQuality: evaluateCandidateQuality(poorCandidate, {
        canConvert: getCandidateDraftConversionReadiness(poorCandidate.id)
          .canConvert
      }),
      now
    });

    assert.notEqual(
      poorRanking.priorityLevel,
      "high_priority",
      "Expected incomplete candidate not to become high_priority."
    );
    assert.ok(
      poorRanking.priorityWarnings.some((warning) =>
        /poor|missing|invalid/i.test(warning)
      ),
      "Expected poor source or missing fields to produce priority warnings."
    );

    const duplicateGroup = duplicateGroups.find((group) =>
      group.candidateIds.includes(duplicateCandidate.id)
    );

    assert.ok(duplicateGroup, "Expected duplicate group to be generated.");

    const unresolvedDuplicateRanking = evaluateImportedCandidatePriority(
      duplicateCandidate,
      {
        sourceQuality: getSourceQuality("ranking-duplicate-source", candidates),
        candidateQuality: evaluateCandidateQuality(duplicateCandidate, {
          canConvert: getCandidateDraftConversionReadiness(
            duplicateCandidate.id
          ).canConvert
        }),
        duplicateGroupStatus: duplicateGroup.status,
        now
      }
    );

    assert.notEqual(
      unresolvedDuplicateRanking.priorityLevel,
      "high_priority",
      "Expected unresolved duplicate to lower priority."
    );

    const primaryCandidateId = "ranking-duplicate-a";
    const resolvedGroup = updateDuplicateGroup(duplicateGroup.id, {
      primaryCandidateId,
      status: "resolved"
    });

    assert.equal(resolvedGroup.status, "resolved");

    const draft = convertImportedCandidateToDraft(primaryCandidateId);
    const rankingWithoutReferences = evaluateTechnologyPriority(
      {
        ...draft,
        sourceReferences: []
      },
      { now }
    );
    const rankingWithReferences = evaluateTechnologyPriority(draft, { now });

    assert.ok(
      rankingWithReferences.priorityScore >
        rankingWithoutReferences.priorityScore,
      "Expected additional references to improve ranking score."
    );

    const publishableDraft = updateTechnologyWorkspaceRecord(draft.id, {
      slug: "ranking-validation-draft",
      title: {
        original: "Ranking validation draft"
      },
      summary: {
        original:
          "A publishable ranking validation draft generated from a resolved duplicate group."
      },
      content: {
        original:
          "This ranking validation draft verifies that priority information remains compatible with candidate conversion, draft editing, publish readiness, and user-facing display."
      },
      tags: ["tag-ai-agents", "tag-workflow"],
      relatedKnowledgeIds: ["knowledge-tool-use"],
      relatedSkillIds: ["skill-agent-design"],
      editorialNotes: ["Ranking validation completed."]
    });

    updateTechnologyWorkspaceStatus(publishableDraft.id, "published");

    const publishedTechnology = getTechnologyBySlug("ranking-validation-draft");

    assert.ok(
      publishedTechnology,
      "Expected published draft detail lookup to work."
    );
    assert.ok(
      getAllTechnologies().some(
        (technology) => technology.id === publishableDraft.id
      ),
      "Expected published draft to appear in user-facing technology list."
    );
    assert.strictEqual(
      publishedTechnology.priority,
      undefined,
      "Expected published technology to carry no ranking internals (priority is derived on demand)."
    );

    const derivedRanking = evaluateTechnologyPriority(publishedTechnology);

    assert.ok(
      derivedRanking.priorityLevel,
      "Expected priority level to be derivable from the public technology item."
    );
    assert.ok(derivedRanking.priorityReasons.length > 0);
    assertNoInternalQualityFields(publishedTechnology);

    console.log("Ranking workflow validation passed.");
  } finally {
    restoreFile(externalSourcesStorePath, sourceStoreBackup);
    restoreFile(importedCandidatesSnapshotPath, snapshotBackup);
    restoreFile(candidateReviewStatePath, reviewStateBackup);
    restoreFile(technologyWorkspaceStorePath, workspaceStoreBackup);
    restoreFile(duplicateGroupStorePath, duplicateGroupStoreBackup);
  }
}

main();

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
  getCandidateDraftConversionReadiness,
  getCandidateWorkflowData
} from "../src/lib/candidate-workflow";
import { getAllTechnologies } from "../src/lib/content";
import {
  evaluateCandidateQuality,
  evaluateSourceQuality
} from "../src/lib/quality-signals";
import type {
  ExternalSource,
  ImportRun,
  ImportedCandidate,
  ImportedCandidateSnapshot
} from "../src/types/content";

const configDirPath = path.join(process.cwd(), "config");
const externalSourcesStorePath = path.join(configDirPath, "external-sources.json");
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

const internalQualityFields = [
  "candidateQuality",
  "qualityFlags",
  "sourceQuality",
  "qualityLevel",
  "successRate",
  "duplicateRate",
  "conversionRate",
  "rejectionRate"
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
    id: overrides.id ?? "quality-source",
    name: overrides.name ?? "Quality Validation Source",
    type: overrides.type ?? "rss",
    url: overrides.url ?? "https://example.com/quality.xml",
    enabled: overrides.enabled ?? true,
    description: overrides.description ?? "Quality validation source.",
    language: overrides.language ?? "en",
    publisherName: overrides.publisherName ?? "Quality Publisher",
    publisherType: overrides.publisherType ?? "media",
    defaultTags: overrides.defaultTags ?? ["quality", "validation"],
    defaultNormalizedType: overrides.defaultNormalizedType ?? "tool",
    lastFetchedAt: overrides.lastFetchedAt,
    lastImportStatus: overrides.lastImportStatus ?? "never_run",
    lastImportMessage: overrides.lastImportMessage,
    lastImportCount: overrides.lastImportCount ?? 0,
    lastErrorMessage: overrides.lastErrorMessage,
    consecutiveFailureCount: overrides.consecutiveFailureCount ?? 0,
    totalImportedCount: overrides.totalImportedCount ?? 0,
    lastSuccessfulImportAt: overrides.lastSuccessfulImportAt,
    createdAt: overrides.createdAt ?? "2026-05-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-05-01T00:00:00.000Z"
  };
}

function buildCandidate(
  overrides: Partial<ImportedCandidate> & Pick<ImportedCandidate, "id" | "originalTitle">
): ImportedCandidate {
  return {
    id: overrides.id,
    sourceId: overrides.sourceId ?? "quality-good-source",
    sourceType: overrides.sourceType ?? "rss-feed",
    sourceName: overrides.sourceName ?? "Quality Good Source",
    sourceUrl: overrides.sourceUrl ?? `https://example.com/${overrides.id}`,
    originalTitle: overrides.originalTitle,
    originalSummary:
      overrides.originalSummary ??
      "A complete quality validation candidate with enough summary detail for review.",
    originalContent:
      overrides.originalContent ??
      "A complete quality validation candidate body with enough context to exercise candidate quality readiness without relying on ranking or recommendation logic. It includes enough detail to avoid the too-short quality flag.",
    originalLanguage: overrides.originalLanguage ?? "en",
    publishDate: overrides.publishDate ?? "2026-05-10",
    publisherName: overrides.publisherName ?? "Quality Publisher",
    normalizedType: overrides.normalizedType ?? "tool",
    tags: overrides.tags ?? ["quality", "validation"],
    importStatus: overrides.importStatus ?? "new",
    relatedCandidateIds: overrides.relatedCandidateIds ?? [],
    rawPayload:
      overrides.rawPayload ?? {
        sourceId: overrides.sourceId ?? "quality-good-source"
      }
  };
}

function resetValidationStores() {
  const now = "2026-05-20T10:00:00.000Z";
  const sources = [
    buildSource({
      id: "quality-good-source",
      name: "Quality Good Source",
      url: "https://example.com/quality-good.xml",
      lastFetchedAt: now,
      lastImportStatus: "success",
      lastImportMessage: "Imported validation candidates.",
      lastImportCount: 4,
      totalImportedCount: 4,
      lastSuccessfulImportAt: now
    }),
    buildSource({
      id: "quality-failing-source",
      name: "Quality Failing Source",
      url: "https://example.com/quality-failing.xml",
      lastFetchedAt: now,
      lastImportStatus: "failed",
      lastImportMessage: "Validation import failed.",
      lastImportCount: 1,
      lastErrorMessage: "Feed was unavailable.",
      consecutiveFailureCount: 2,
      totalImportedCount: 1
    })
  ];
  const importRuns: ImportRun[] = [
    {
      id: "quality-run-success",
      startedAt: "2026-05-20T09:00:00.000Z",
      finishedAt: "2026-05-20T09:00:05.000Z",
      status: "success",
      totalSources: 1,
      enabledSources: 1,
      skippedSources: 0,
      successfulSources: 1,
      failedSources: 0,
      partialSources: 0,
      totalCandidatesCreated: 4,
      totalCandidatesSkipped: 0,
      messages: ["Good source imported."],
      sourceResults: [
        {
          sourceId: "quality-good-source",
          sourceName: "Quality Good Source",
          status: "success",
          message: "Good source imported.",
          candidateCount: 4,
          candidatesCreated: 4,
          candidatesSkipped: 0
        }
      ]
    },
    {
      id: "quality-run-failed",
      startedAt: "2026-05-20T10:00:00.000Z",
      finishedAt: "2026-05-20T10:00:05.000Z",
      status: "failed",
      totalSources: 1,
      enabledSources: 1,
      skippedSources: 0,
      successfulSources: 0,
      failedSources: 1,
      partialSources: 0,
      totalCandidatesCreated: 0,
      totalCandidatesSkipped: 0,
      messages: ["Failing source unavailable."],
      sourceResults: [
        {
          sourceId: "quality-failing-source",
          sourceName: "Quality Failing Source",
          status: "failed",
          message: "Failing source unavailable.",
          candidateCount: 0,
          candidatesCreated: 0,
          candidatesSkipped: 0
        }
      ]
    }
  ];
  const candidates: ImportedCandidate[] = [
    buildCandidate({
      id: "quality-ready",
      originalTitle: "Quality ready candidate"
    }),
    buildCandidate({
      id: "quality-converted",
      originalTitle: "Quality converted candidate",
      importStatus: "converted",
      convertedTechnologyId: "quality-tech-draft"
    }),
    buildCandidate({
      id: "quality-duplicate-a",
      originalTitle: "Quality shared duplicate event",
      sourceUrl: "https://example.com/shared-quality-event"
    }),
    buildCandidate({
      id: "quality-duplicate-b",
      originalTitle: "Quality duplicate event follow up",
      sourceUrl: "https://example.com/shared-quality-event"
    }),
    buildCandidate({
      id: "quality-rejected",
      originalTitle: "Quality rejected candidate",
      importStatus: "rejected"
    }),
    buildCandidate({
      id: "quality-missing",
      sourceId: "quality-failing-source",
      sourceName: "Quality Failing Source",
      sourceUrl: "not-a-url",
      originalTitle: "Quality incomplete candidate",
      originalSummary: "",
      originalContent: "",
      publishDate: "not-a-date",
      publisherName: "",
      tags: [],
      rawPayload: {
        sourceId: "quality-failing-source",
        publisherName: ""
      }
    })
  ];
  const snapshot: ImportedCandidateSnapshot = {
    syncedAt: now,
    sources: sources.map((source) => ({
      id: source.id,
      sourceType: source.type === "official_blog" ? "official-blog" : "rss-feed",
      sourceName: source.name,
      sourceUrl: source.url,
      syncStatus: "fallback",
      itemCount: source.id === "quality-good-source" ? 5 : 1,
      fetchedAt: now
    })),
    candidates
  };

  writeJsonFile(externalSourcesStorePath, {
    updatedAt: now,
    sources,
    latestImportRun: importRuns[1],
    importRuns
  });
  writeJsonFile(importedCandidatesSnapshotPath, snapshot);
  writeJsonFile(candidateReviewStatePath, {
    updatedAt: now,
    items: {
      "quality-converted": {
        importStatus: "converted",
        reviewedAt: now,
        convertedTechnologyId: "quality-tech-draft"
      },
      "quality-rejected": {
        importStatus: "rejected",
        reviewedAt: now
      }
    }
  });
  writeJsonFile(technologyWorkspaceStorePath, {
    updatedAt: now,
    records: []
  });
  writeJsonFile(duplicateGroupStorePath, {
    updatedAt: now,
    groups: []
  });
}

function assertNoUserFacingQualityFields() {
  for (const technology of getAllTechnologies()) {
    const record = technology as unknown as Record<string, unknown>;

    for (const field of internalQualityFields) {
      assert.equal(
        field in record,
        false,
        `User-facing technology should not expose ${field}.`
      );
    }
  }
}

function main() {
  const sourceStoreBackup = backupFile(externalSourcesStorePath);
  const snapshotBackup = backupFile(importedCandidatesSnapshotPath);
  const reviewStateBackup = backupFile(candidateReviewStatePath);
  const workspaceStoreBackup = backupFile(technologyWorkspaceStorePath);
  const duplicateGroupStoreBackup = backupFile(duplicateGroupStorePath);

  try {
    resetValidationStores();

    const { candidates } = getCandidateWorkflowData();
    const goodSource = buildSource({
      id: "quality-good-source",
      name: "Quality Good Source",
      url: "https://example.com/quality-good.xml",
      lastImportStatus: "success",
      lastSuccessfulImportAt: "2026-05-20T10:00:00.000Z"
    });
    const failingSource = buildSource({
      id: "quality-failing-source",
      name: "Quality Failing Source",
      url: "https://example.com/quality-failing.xml",
      lastImportStatus: "failed",
      consecutiveFailureCount: 2
    });
    const sourceStore = JSON.parse(readFileSync(externalSourcesStorePath, "utf8")) as {
      importRuns: ImportRun[];
      sources: ExternalSource[];
    };
    const readyCandidate = candidates.find((item) => item.id === "quality-ready");
    const missingCandidate = candidates.find((item) => item.id === "quality-missing");
    const duplicateCandidate = candidates.find(
      (item) => item.id === "quality-duplicate-a"
    );

    assert.ok(readyCandidate, "Expected ready candidate to exist.");
    assert.ok(missingCandidate, "Expected incomplete candidate to exist.");
    assert.ok(duplicateCandidate, "Expected duplicate candidate to exist.");

    const goodQuality = evaluateSourceQuality(
      sourceStore.sources.find((source) => source.id === goodSource.id) ?? goodSource,
      candidates,
      sourceStore.importRuns
    );
    const failingQuality = evaluateSourceQuality(
      sourceStore.sources.find((source) => source.id === failingSource.id) ??
        failingSource,
      candidates,
      sourceStore.importRuns
    );

    assert.equal(goodQuality.totalImportRuns, 1);
    assert.equal(goodQuality.successfulImportRuns, 1);
    assert.equal(goodQuality.convertedCandidateCount, 1);
    assert.equal(goodQuality.rejectedCandidateCount, 1);
    assert.ok(
      goodQuality.duplicateCandidateCount >= 2,
      "Expected duplicate candidates to affect source duplicate count."
    );
    assert.ok(
      goodQuality.duplicateRate > 0,
      "Expected duplicate candidates to affect duplicateRate."
    );
    assert.ok(
      goodQuality.conversionRate > 0,
      "Expected converted candidates to affect conversionRate."
    );
    assert.ok(
      goodQuality.rejectionRate > 0,
      "Expected rejected candidates to affect rejectionRate."
    );
    assert.equal(failingQuality.failedImportRuns, 1);
    assert.equal(failingQuality.consecutiveFailureCount, 2);
    assert.equal(
      failingQuality.qualityLevel,
      "poor",
      "Expected repeated failures to mark source quality as poor."
    );

    const readyQuality = evaluateCandidateQuality(readyCandidate, {
      canConvert: getCandidateDraftConversionReadiness(readyCandidate.id).canConvert
    });
    const missingQuality = evaluateCandidateQuality(missingCandidate, {
      canConvert: getCandidateDraftConversionReadiness(missingCandidate.id)
        .canConvert
    });
    const duplicateQuality = evaluateCandidateQuality(duplicateCandidate, {
      canConvert: getCandidateDraftConversionReadiness(duplicateCandidate.id)
        .canConvert
    });

    assert.ok(readyQuality.flags.includes("ready_for_review"));
    assert.ok(missingQuality.flags.includes("missing_summary"));
    assert.ok(missingQuality.flags.includes("missing_content"));
    assert.ok(missingQuality.flags.includes("missing_publisher"));
    assert.ok(missingQuality.flags.includes("invalid_source_url"));
    assert.ok(missingQuality.flags.includes("invalid_publish_date"));
    assert.ok(missingQuality.flags.includes("missing_tags"));
    assert.ok(duplicateQuality.flags.includes("possible_duplicate"));

    assertNoUserFacingQualityFields();

    console.log("Quality signal validation passed.");
  } finally {
    restoreFile(externalSourcesStorePath, sourceStoreBackup);
    restoreFile(importedCandidatesSnapshotPath, snapshotBackup);
    restoreFile(candidateReviewStatePath, reviewStateBackup);
    restoreFile(technologyWorkspaceStorePath, workspaceStoreBackup);
    restoreFile(duplicateGroupStorePath, duplicateGroupStoreBackup);
  }
}

main();

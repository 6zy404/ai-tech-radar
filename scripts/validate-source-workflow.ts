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
  createExternalSource,
  ExternalSourceValidationError,
  getExternalSourceById,
  getImportedCandidatesForExternalSource,
  getLatestExternalSourceImportRun,
  runBatchImportForEnabledSources,
  runImportForSource
} from "../src/lib/source-workflow";
import type { ExternalSourceInput } from "../src/lib/source-workflow";

const configDirPath = path.join(process.cwd(), "config");
const externalSourcesStorePath = path.join(
  configDirPath,
  "external-sources.json"
);
const importedCandidatesSnapshotPath = path.join(
  configDirPath,
  "imported-candidates.live.json"
);

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

function resetSourceStore() {
  mkdirSync(configDirPath, { recursive: true });
  writeFileSync(
    externalSourcesStorePath,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), sources: [] }, null, 2)}\n`,
    "utf8"
  );
  writeFileSync(
    importedCandidatesSnapshotPath,
    `${JSON.stringify(
      {
        syncedAt: new Date().toISOString(),
        sources: [],
        candidates: []
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function buildSourceInput(
  overrides: Partial<ExternalSourceInput> = {}
): ExternalSourceInput {
  return {
    name: "Validation RSS Source",
    type: "rss",
    url: "https://example.com/validation-feed.xml",
    enabled: true,
    description: "Validation-only source config.",
    language: "en",
    publisherName: "Validation Publisher",
    publisherType: "media",
    defaultTags: ["validation", "workflow"],
    defaultNormalizedType: "tool",
    ...overrides
  };
}

async function main() {
  const sourceStoreBackup = backupFile(externalSourcesStorePath);
  const candidateSnapshotBackup = backupFile(importedCandidatesSnapshotPath);

  try {
    resetSourceStore();

    const source = createExternalSource(buildSourceInput());

    assert.equal(
      source.enabled,
      true,
      "Expected created source to be enabled."
    );
    assert.equal(source.lastImportStatus, "never_run");
    assert.deepEqual(source.defaultTags, ["validation", "workflow"]);

    assert.throws(
      () =>
        createExternalSource(
          buildSourceInput({
            name: "Duplicate URL Source"
          })
        ),
      ExternalSourceValidationError,
      "Expected duplicate source URL to be rejected."
    );

    assert.throws(
      () =>
        createExternalSource(
          buildSourceInput({
            name: "Invalid URL Source",
            url: "not-a-url"
          })
        ),
      ExternalSourceValidationError,
      "Expected invalid source URL to be rejected."
    );

    const disabledSource = createExternalSource(
      buildSourceInput({
        name: "Disabled Validation Source",
        url: "https://example.com/disabled-validation-feed.xml",
        enabled: false
      })
    );

    const batchResult = await runBatchImportForEnabledSources({
      useFallbackOnFailure: true
    });
    const batchResults = batchResult.results;

    assert.ok(
      batchResults.some((result) => result.source.id === source.id),
      "Expected enabled source to participate in batch import."
    );
    assert.equal(
      batchResults.some((result) => result.source.id === disabledSource.id),
      false,
      "Expected disabled source to be skipped by batch import."
    );
    assert.equal(batchResult.run.totalSources, 2);
    assert.equal(batchResult.run.enabledSources, 1);
    assert.equal(batchResult.run.skippedSources, 1);
    assert.equal(
      batchResult.run.totalCandidatesCreated > 0,
      true,
      "Expected batch import summary to record created candidates."
    );

    const importedCandidates = getImportedCandidatesForExternalSource(
      source.id
    );

    assert.ok(
      importedCandidates.length > 0,
      "Expected source import to generate imported candidates."
    );
    assert.equal(importedCandidates[0].sourceId, source.id);
    assert.equal(importedCandidates[0].sourceName, source.name);
    assert.equal(importedCandidates[0].sourceUrl, source.url);
    assert.ok(
      importedCandidates[0].importedAt,
      "Expected importedAt to be set."
    );
    assert.equal(importedCandidates[0].importRunId, batchResult.run.id);

    const importedSource = getExternalSourceById(source.id);

    assert.ok(
      importedSource?.lastFetchedAt,
      "Expected source lastFetchedAt to update."
    );
    assert.ok(
      importedSource?.lastImportStatus === "success" ||
        importedSource?.lastImportStatus === "partial",
      "Expected source lastImportStatus to become success or partial."
    );
    assert.ok(
      importedSource?.lastImportMessage,
      "Expected source lastImportMessage to be recorded."
    );
    assert.ok(
      typeof importedSource?.lastImportCount === "number",
      "Expected source lastImportCount to update."
    );
    assert.ok(
      typeof importedSource?.consecutiveFailureCount === "number",
      "Expected source consecutiveFailureCount to update."
    );
    assert.ok(
      typeof importedSource?.totalImportedCount === "number" &&
        importedSource.totalImportedCount > 0,
      "Expected source totalImportedCount to update."
    );
    assert.equal(
      getLatestExternalSourceImportRun()?.id,
      batchResult.run.id,
      "Expected latest batch import summary to be persisted."
    );

    const repeatedBatchResult = await runBatchImportForEnabledSources({
      useFallbackOnFailure: true
    });

    assert.ok(
      repeatedBatchResult.run.totalCandidatesSkipped > 0,
      "Expected repeated import to skip existing duplicate candidates."
    );

    assert.equal(
      getImportedCandidatesForExternalSource(disabledSource.id).length,
      0,
      "Expected disabled source to have no batch-imported candidates."
    );

    const failingSource = createExternalSource(
      buildSourceInput({
        name: "Failing Validation Source",
        url: "http://127.0.0.1:9/unavailable-feed.xml"
      })
    );
    const failureBatchResult = await runBatchImportForEnabledSources({
      useFallbackOnFailure: false
    });

    assert.equal(
      failureBatchResult.results.length,
      2,
      "Expected all enabled sources to be attempted even when imports fail."
    );
    assert.ok(
      failureBatchResult.run.failedSources > 0,
      "Expected batch summary to record failed sources."
    );

    const failureResult = await runImportForSource(failingSource.id, {
      useFallbackOnFailure: false
    });

    assert.equal(failureResult.status, "failed");
    assert.equal(
      getExternalSourceById(failingSource.id)?.lastImportStatus,
      "failed",
      "Expected failed import state to be persisted."
    );
    assert.ok(
      getExternalSourceById(failingSource.id)?.lastErrorMessage,
      "Expected failed source error message to be visible in source health."
    );

    // Regression guard (2026-08-10): four of the five writeStore call sites
    // omitted `...store`, so a single-source import — and creating, editing, or
    // toggling a source — silently erased the batch import history that
    // /workspace/operations and the source quality metrics read. Nothing had
    // ever asserted that the history outlives an unrelated write.
    const runBeforeSingleImport = getLatestExternalSourceImportRun();

    assert.ok(
      runBeforeSingleImport,
      "Expected a batch import run to exist before the preservation check."
    );

    await runImportForSource(failingSource.id);

    const runAfterSingleImport = getLatestExternalSourceImportRun();

    assert.equal(
      runAfterSingleImport?.id,
      runBeforeSingleImport?.id,
      "Expected the batch import run history to survive a single-source import."
    );

    console.log("Source workflow validation passed.");
  } finally {
    restoreFile(externalSourcesStorePath, sourceStoreBackup);
    restoreFile(importedCandidatesSnapshotPath, candidateSnapshotBackup);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

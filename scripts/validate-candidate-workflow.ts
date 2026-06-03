import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

import {
  convertImportedCandidateToDraft,
  getCandidateWorkflowData,
  getImportedCandidateById,
  getTechnologyWorkspacePublishReadiness,
  getTechnologyWorkspaceRecordById,
  updateImportedCandidateStatus,
  updateTechnologyWorkspaceRecord,
  updateTechnologyWorkspaceStatus
} from "../src/lib/candidate-workflow";
import {
  getAllTechnologies,
  getTechnologyBySlug
} from "../src/lib/content";
import { PublishReadinessError } from "../src/lib/publish-readiness";
import { getLocalizedTechnologyText } from "../src/lib/technology-localization";
import type { TechnologyWorkspaceRecord } from "../src/types/content";

const configDirPath = path.join(process.cwd(), "config");
const candidateReviewStatePath = path.join(
  configDirPath,
  "candidate-review-state.json"
);
const technologyWorkspaceStorePath = path.join(
  configDirPath,
  "technology-workspace.json"
);
const importedCandidatesSnapshotPath = path.join(
  configDirPath,
  "imported-candidates.live.json"
);
const duplicateGroupStorePath = path.join(configDirPath, "duplicate-groups.json");
const internalOnlyTechnologyFields = [
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "relatedCandidateIds",
  "reviewedAt",
  "convertedTechnologyId",
  "sourceCandidateId",
  "createdAt",
  "updatedAt",
  "editorialNotes"
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

function readWorkspaceRecords(): TechnologyWorkspaceRecord[] {
  if (!existsSync(technologyWorkspaceStorePath)) {
    return [];
  }

  const store = JSON.parse(readFileSync(technologyWorkspaceStorePath, "utf8")) as {
    records?: TechnologyWorkspaceRecord[];
  };

  return store.records ?? [];
}

function writeWorkspaceRecords(records: TechnologyWorkspaceRecord[]) {
  writeFileSync(
    technologyWorkspaceStorePath,
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        records
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function assertPublishBlocked(recordId: string, expectedCode: string) {
  try {
    updateTechnologyWorkspaceStatus(recordId, "published");
    assert.fail(`Expected ${recordId} publishing to be blocked.`);
  } catch (error) {
    assert.ok(
      error instanceof PublishReadinessError,
      "Expected publish blocking to throw PublishReadinessError."
    );
    assert.ok(
      error.readiness.blockingErrors.some((issue) => issue.code === expectedCode),
      `Expected publish blocking to include ${expectedCode}.`
    );
  }
}

function assertIssueCodes(
  issues: Array<{ code: string }>,
  expectedCodes: string[],
  context: string
) {
  for (const expectedCode of expectedCodes) {
    assert.ok(
      issues.some((issue) => issue.code === expectedCode),
      `Expected ${context} to include ${expectedCode}.`
    );
  }
}

function assertNoInternalOnlyTechnologyFields(
  item: Record<string, unknown>,
  context: string
) {
  for (const field of internalOnlyTechnologyFields) {
    assert.equal(
      field in item,
      false,
      `${context} should not expose internal-only field ${field}.`
    );
  }
}

function main() {
  const reviewStateBackup = backupFile(candidateReviewStatePath);
  const workspaceStoreBackup = backupFile(technologyWorkspaceStorePath);
  const importedCandidatesSnapshotBackup = backupFile(importedCandidatesSnapshotPath);
  const duplicateGroupStoreBackup = backupFile(duplicateGroupStorePath);

  try {
    if (existsSync(importedCandidatesSnapshotPath)) {
      unlinkSync(importedCandidatesSnapshotPath);
    }

    writeFileSync(
      duplicateGroupStorePath,
      `${JSON.stringify(
        {
          updatedAt: new Date().toISOString(),
          groups: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const { candidates } = getCandidateWorkflowData();

    assert.ok(candidates.length > 0, "Expected imported candidates to exist.");
    assert.ok(
      candidates.some((candidate) => candidate.sourceType === "rss-feed"),
      "Expected at least one RSS candidate."
    );
    assert.ok(
      candidates.some((candidate) => candidate.sourceType === "github-release"),
      "Expected at least one GitHub release candidate."
    );
    assert.ok(
      candidates.some((candidate) => candidate.sourceType === "official-blog"),
      "Expected at least one official blog candidate."
    );
    assert.ok(
      candidates.some((candidate) => candidate.relatedCandidateIds.length > 0),
      "Expected duplicate detection to identify at least one candidate pair."
    );

    const targetCandidate = candidates[0];

    updateImportedCandidateStatus(targetCandidate.id, "reviewed");
    assert.equal(
      getImportedCandidateById(targetCandidate.id)?.importStatus,
      "reviewed",
      "Expected candidate status to update to reviewed."
    );

    const draft = convertImportedCandidateToDraft(targetCandidate.id);

    assert.equal(
      draft.sourceCandidateId,
      targetCandidate.id,
      "Expected workspace record to keep a source candidate link."
    );
    assert.equal(
      getImportedCandidateById(targetCandidate.id)?.convertedTechnologyId,
      draft.id,
      "Expected converted candidate to reference the generated draft."
    );
    assert.equal(
      getTechnologyWorkspaceRecordById(draft.id)?.status,
      "draft",
      "Expected converted record to start as draft."
    );

    const editedDraft = updateTechnologyWorkspaceRecord(draft.id, {
      slug: "validated-workspace-draft",
      title: {
        original: `${draft.title.original} validation edit`,
        zh: "Validation translated title"
      },
      summary: {
        original: `${draft.summary.original} validation edit`,
        zh: "Validation translated summary"
      },
      content: {
        original: `${draft.content.original} validation edit`,
        zh: "Validation translated content"
      },
      translationStatus: "done",
      tags: ["tag-ai-agents", "tag-workflow"],
      relatedKnowledgeIds: ["knowledge-tool-use"],
      relatedSkillIds: ["skill-agent-design"],
      editorialNotes: ["Validation edit saved."]
    });

    assert.equal(
      editedDraft.slug,
      "validated-workspace-draft",
      "Expected workspace record edits to update the slug."
    );
    assert.equal(
      editedDraft.translationStatus,
      "done",
      "Expected workspace record edits to update translation status."
    );
    assert.deepEqual(
      editedDraft.relatedKnowledgeIds,
      ["knowledge-tool-use"],
      "Expected workspace record edits to update related knowledge."
    );

    updateImportedCandidateStatus(targetCandidate.id, "converted");
    const beforePublish = getAllTechnologies().find((item) => item.id === draft.id);

    assert.equal(
      beforePublish,
      undefined,
      "Draft records should not appear in the user-facing technology feed before publishing."
    );

    updateTechnologyWorkspaceStatus(draft.id, "published");
    const publishedTechnology = getAllTechnologies().find((item) => item.id === draft.id);

    assert.ok(
      publishedTechnology,
      "Published workspace records should appear in the user-facing technology feed."
    );
    assertNoInternalOnlyTechnologyFields(
      publishedTechnology as unknown as Record<string, unknown>,
      "Published user-facing technology item"
    );
    assert.equal(
      publishedTechnology?.slug,
      "validated-workspace-draft",
      "Expected user-facing published item to use saved workspace edits."
    );
    assert.ok(
      getTechnologyBySlug("validated-workspace-draft"),
      "Expected published technology detail lookup to resolve by slug."
    );

    const incompleteRecord: TechnologyWorkspaceRecord = {
      ...editedDraft,
      id: "validation-incomplete-record",
      slug: "",
      title: { original: "" },
      summary: { original: "" },
      content: { original: "" },
      sourceName: "",
      sourceUrl: "not-a-url",
      publishDate: "",
      status: "draft",
      tags: [],
      relatedKnowledgeIds: [],
      relatedSkillIds: [],
      editorialNotes: [],
      updatedAt: new Date().toISOString()
    };
    const duplicateSlugRecord: TechnologyWorkspaceRecord = {
      ...editedDraft,
      id: "validation-duplicate-slug-record",
      slug: "model-context-protocol",
      sourceUrl: "https://example.com/validation-duplicate-slug",
      status: "draft",
      updatedAt: new Date().toISOString()
    };
    const warningOnlyRecord: TechnologyWorkspaceRecord = {
      ...editedDraft,
      id: "validation-warning-only-record",
      slug: "validation-warning-only-record",
      title: { original: "Validation warning-only record" },
      summary: {
        original: "Short summary."
      },
      content: {
        original: "Short content."
      },
      sourceName: "Validation Source",
      sourceUrl: "https://example.com/validation-warning-only-record",
      sourceLanguage: "en",
      translationStatus: "pending",
      publisherName: "",
      tags: [],
      relatedKnowledgeIds: [],
      relatedSkillIds: [],
      editorialNotes: [],
      status: "draft",
      updatedAt: new Date().toISOString()
    };

    writeWorkspaceRecords([
      ...readWorkspaceRecords(),
      incompleteRecord,
      duplicateSlugRecord,
      warningOnlyRecord
    ]);

    const incompleteReadiness = getTechnologyWorkspacePublishReadiness(
      incompleteRecord.id
    );

    assert.equal(
      incompleteReadiness.isReady,
      false,
      "Expected incomplete record to fail publish readiness."
    );
    assertIssueCodes(
      incompleteReadiness.blockingErrors,
      [
        "missing-title",
        "missing-summary",
        "missing-slug",
        "missing-source-name",
        "invalid-source-url",
        "invalid-publish-date",
        "missing-content"
      ],
      "incomplete record blocking errors"
    );
    assertIssueCodes(
      incompleteReadiness.warnings,
      [
        "too-few-tags",
        "missing-related-knowledge",
        "missing-related-skills",
        "short-summary",
        "short-content",
        "missing-editorial-notes"
      ],
      "incomplete record warnings"
    );
    assertPublishBlocked(incompleteRecord.id, "missing-title");
    assertPublishBlocked(duplicateSlugRecord.id, "duplicate-slug");

    const warningOnlyReadiness = getTechnologyWorkspacePublishReadiness(
      warningOnlyRecord.id
    );

    assert.equal(
      warningOnlyReadiness.isReady,
      true,
      "Expected warning-only record to be publishable."
    );
    assertIssueCodes(
      warningOnlyReadiness.warnings,
      [
        "missing-chinese-title-summary",
        "too-few-tags",
        "missing-related-knowledge",
        "missing-related-skills",
        "missing-publisher-name",
        "short-summary",
        "short-content",
        "missing-editorial-notes"
      ],
      "warning-only record warnings"
    );

    updateTechnologyWorkspaceStatus(warningOnlyRecord.id, "published");
    const warningOnlyTechnology = getAllTechnologies().find(
      (item) => item.id === warningOnlyRecord.id
    );

    assert.ok(
      warningOnlyTechnology,
      "Expected warning-only record to appear after publishing."
    );
    assertNoInternalOnlyTechnologyFields(
      warningOnlyTechnology as unknown as Record<string, unknown>,
      "Warning-only user-facing technology item"
    );
    assert.equal(
      getLocalizedTechnologyText(
        warningOnlyTechnology.title,
        "zh",
        warningOnlyTechnology.sourceLanguage
      ),
      warningOnlyRecord.title.original,
      "Expected bilingual fallback to return original title when Chinese is missing."
    );
    assert.equal(
      getLocalizedTechnologyText(
        warningOnlyTechnology.summary,
        "zh",
        warningOnlyTechnology.sourceLanguage
      ),
      warningOnlyRecord.summary.original,
      "Expected bilingual fallback to return original summary when Chinese is missing."
    );
    assert.equal(
      getLocalizedTechnologyText(
        warningOnlyTechnology.content,
        "zh",
        warningOnlyTechnology.sourceLanguage
      ),
      warningOnlyRecord.content.original,
      "Expected bilingual fallback to return original content when Chinese is missing."
    );

    console.log("Candidate and publishing workflow validation passed.");
  } finally {
    restoreFile(candidateReviewStatePath, reviewStateBackup);
    restoreFile(technologyWorkspaceStorePath, workspaceStoreBackup);
    restoreFile(importedCandidatesSnapshotPath, importedCandidatesSnapshotBackup);
    restoreFile(duplicateGroupStorePath, duplicateGroupStoreBackup);
  }
}

main();

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
  getCandidateWorkflowData,
  getDuplicateGroups,
  getImportedCandidateById,
  updateDuplicateGroup
} from "../src/lib/candidate-workflow";
import {
  updateTechnologyWorkspaceRecord,
  updateTechnologyWorkspaceStatus
} from "../src/lib/technology-draft-workflow";
import { getAllTechnologies, getTechnologyBySlug } from "../src/lib/content";
import type {
  ImportedCandidate,
  ImportedCandidateSnapshot,
  TechnologyItem,
  TechnologyWorkspaceRecord
} from "../src/types/content";

const configDirPath = path.join(process.cwd(), "config");
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

const internalOnlyFields = [
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

function writeJsonFile(filePath: string, value: unknown) {
  mkdirSync(configDirPath, { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildCandidate(
  overrides: Partial<ImportedCandidate> & Pick<ImportedCandidate, "id" | "originalTitle">
): ImportedCandidate {
  const sourceType = overrides.sourceType ?? "rss-feed";
  const sourceName = overrides.sourceName ?? "Validation Source";
  const sourceUrl =
    overrides.sourceUrl ?? `https://example.com/${overrides.id}`;

  return {
    id: overrides.id,
    sourceId: overrides.sourceId ?? "validation-source",
    sourceType,
    sourceName,
    sourceUrl,
    originalTitle: overrides.originalTitle,
    originalSummary:
      overrides.originalSummary ??
      "Validation candidate used to exercise duplicate review workflow.",
    originalContent:
      overrides.originalContent ??
      "Validation content with enough body text to generate a publishable Technology draft after editorial edits.",
    originalLanguage: overrides.originalLanguage ?? "en",
    publishDate: overrides.publishDate ?? "2026-05-01",
    publisherName: overrides.publisherName ?? "Validation Publisher",
    normalizedType: overrides.normalizedType ?? "tool",
    tags: overrides.tags ?? ["validation", "duplicate"],
    importStatus: overrides.importStatus ?? "new",
    relatedCandidateIds: overrides.relatedCandidateIds ?? [],
    rawPayload:
      overrides.rawPayload ?? {
        canonicalUrl: sourceUrl,
        sourceId: overrides.sourceId ?? "validation-source"
      }
  };
}

function resetValidationStores() {
  const candidates: ImportedCandidate[] = [
    buildCandidate({
      id: "validation-same-url-a",
      sourceId: "validation-rss",
      sourceName: "Validation RSS",
      sourceUrl: "https://example.com/news/shared-protocol-update",
      originalTitle: "Validation shared protocol update"
    }),
    buildCandidate({
      id: "validation-same-url-b",
      sourceId: "validation-blog",
      sourceType: "official-blog",
      sourceName: "Validation Blog",
      sourceUrl: "https://example.com/news/shared-protocol-update",
      originalTitle: "Validation duplicate URL follow up"
    }),
    buildCandidate({
      id: "validation-title-a",
      sourceId: "validation-rss",
      sourceName: "Validation RSS",
      sourceUrl: "https://example.com/news/agent-browser-stable-a",
      originalTitle: "Autonomous agent browser control reaches stable release",
      publisherName: "Validation Publisher"
    }),
    buildCandidate({
      id: "validation-title-b",
      sourceId: "validation-blog",
      sourceType: "official-blog",
      sourceName: "Validation Blog",
      sourceUrl: "https://example.com/blog/stable-agent-browser-control",
      originalTitle: "Stable release for autonomous agent browser control",
      publisherName: "Validation Publisher",
      publishDate: "2026-05-03"
    }),
    buildCandidate({
      id: "validation-github-release-a",
      sourceId: "validation-github",
      sourceType: "github-release",
      sourceName: "Validation GitHub Releases",
      sourceUrl: "https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v1.2.0",
      originalTitle: "TypeScript SDK v1.2.0 release",
      publisherName: "modelcontextprotocol",
      publishDate: "2026-05-10",
      rawPayload: {
        release: {
          html_url:
            "https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v1.2.0"
        },
        repository: {
          full_name: "modelcontextprotocol/typescript-sdk"
        }
      }
    }),
    buildCandidate({
      id: "validation-github-release-b",
      sourceId: "validation-github",
      sourceType: "github-release",
      sourceName: "Validation GitHub Releases",
      sourceUrl: "https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v1.2.1",
      originalTitle: "TypeScript SDK v1.2.1 release",
      publisherName: "modelcontextprotocol",
      publishDate: "2026-05-12",
      rawPayload: {
        release: {
          html_url:
            "https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v1.2.1"
        },
        repository: {
          full_name: "modelcontextprotocol/typescript-sdk"
        }
      }
    })
  ];
  const snapshot: ImportedCandidateSnapshot = {
    syncedAt: new Date().toISOString(),
    sources: [
      {
        id: "validation-rss",
        sourceType: "rss-feed",
        sourceName: "Validation RSS",
        sourceUrl: "https://example.com/rss.xml",
        syncStatus: "fallback",
        itemCount: 2,
        fetchedAt: new Date().toISOString()
      },
      {
        id: "validation-blog",
        sourceType: "official-blog",
        sourceName: "Validation Blog",
        sourceUrl: "https://example.com/blog",
        syncStatus: "fallback",
        itemCount: 2,
        fetchedAt: new Date().toISOString()
      },
      {
        id: "validation-github",
        sourceType: "github-release",
        sourceName: "Validation GitHub Releases",
        sourceUrl: "https://github.com/modelcontextprotocol/typescript-sdk/releases",
        syncStatus: "fallback",
        itemCount: 2,
        fetchedAt: new Date().toISOString()
      }
    ],
    candidates
  };

  writeJsonFile(importedCandidatesSnapshotPath, snapshot);
  writeJsonFile(candidateReviewStatePath, {
    updatedAt: new Date().toISOString(),
    items: {}
  });
  writeJsonFile(technologyWorkspaceStorePath, {
    updatedAt: new Date().toISOString(),
    records: []
  });
  writeJsonFile(duplicateGroupStorePath, {
    updatedAt: new Date().toISOString(),
    groups: []
  });
}

function getGroupContaining(candidateId: string) {
  const group = getDuplicateGroups().find((item) =>
    item.candidateIds.includes(candidateId)
  );

  assert.ok(group, `Expected duplicate group for ${candidateId}.`);

  return group;
}

function assertNoInternalOnlyFields(item: TechnologyItem) {
  const record = item as unknown as Record<string, unknown>;

  for (const field of internalOnlyFields) {
    assert.equal(
      field in record,
      false,
      `User-facing technology should not expose ${field}.`
    );
  }

  for (const reference of item.sourceReferences ?? []) {
    const referenceRecord = reference as unknown as Record<string, unknown>;

    assert.equal("candidateId" in referenceRecord, false);
    assert.equal("sourceType" in referenceRecord, false);
  }
}

function main() {
  const snapshotBackup = backupFile(importedCandidatesSnapshotPath);
  const reviewStateBackup = backupFile(candidateReviewStatePath);
  const workspaceStoreBackup = backupFile(technologyWorkspaceStorePath);
  const duplicateGroupStoreBackup = backupFile(duplicateGroupStorePath);

  try {
    resetValidationStores();

    const { candidates, duplicateGroups } = getCandidateWorkflowData();

    assert.equal(candidates.length, 6, "Expected validation candidates to load.");
    assert.ok(
      duplicateGroups.length >= 3,
      "Expected duplicate groups to be generated."
    );

    const sameUrlGroup = getGroupContaining("validation-same-url-a");
    assert.ok(
      sameUrlGroup.reasons.includes("same_source_url"),
      "Expected same source URL duplicate reason."
    );

    const similarTitleGroup = getGroupContaining("validation-title-a");
    assert.ok(
      similarTitleGroup.reasons.includes("similar_title"),
      "Expected similar title duplicate reason."
    );
    assert.ok(
      similarTitleGroup.reasons.includes("same_publisher_near_date"),
      "Expected same publisher near date duplicate reason."
    );

    const githubGroup = getGroupContaining("validation-github-release-a");
    assert.ok(
      githubGroup.reasons.includes("same_repo_release_family"),
      "Expected same repo release family duplicate reason."
    );

    const primaryCandidateId = "validation-same-url-a";
    const nonPrimaryCandidateId = "validation-same-url-b";
    const resolvedGroup = updateDuplicateGroup(sameUrlGroup.id, {
      primaryCandidateId,
      status: "resolved"
    });

    assert.equal(resolvedGroup.primaryCandidateId, primaryCandidateId);
    assert.equal(resolvedGroup.status, "resolved");

    assert.throws(
      () => convertImportedCandidateToDraft(nonPrimaryCandidateId),
      /not the primary candidate/,
      "Expected non-primary duplicate candidate conversion to be blocked."
    );

    const draft = convertImportedCandidateToDraft(primaryCandidateId);

    assert.equal(draft.sourceCandidateId, primaryCandidateId);
    assert.equal(
      draft.sourceReferences?.length,
      1,
      "Expected non-primary duplicate source to be retained as an additional reference."
    );
    assert.equal(
      draft.sourceReferences?.[0]?.candidateId,
      nonPrimaryCandidateId,
      "Expected additional reference to point at the non-primary candidate."
    );
    assert.equal(
      getImportedCandidateById(nonPrimaryCandidateId)?.convertedTechnologyId,
      draft.id,
      "Expected non-primary duplicate to link to the generated draft."
    );

    const publishableDraft: TechnologyWorkspaceRecord = updateTechnologyWorkspaceRecord(
      draft.id,
      {
        slug: "validation-duplicate-review-draft",
        title: {
          original: "Validation duplicate review draft"
        },
        summary: {
          original:
            "A validation draft generated from the primary candidate of a resolved duplicate group."
        },
        content: {
          original:
            "This validation draft confirms that duplicate review preserves additional source references while keeping internal duplicate fields out of the user-facing product."
        },
        tags: ["tag-ai-agents", "tag-workflow"],
        relatedKnowledgeIds: ["knowledge-tool-use"],
        relatedSkillIds: ["skill-agent-design"],
        editorialNotes: ["Duplicate review validation completed."]
      }
    );

    updateTechnologyWorkspaceStatus(publishableDraft.id, "published");

    const publishedTechnology = getAllTechnologies().find(
      (item) => item.id === publishableDraft.id
    );

    assert.ok(
      publishedTechnology,
      "Expected converted draft to appear in the user-facing feed after publishing."
    );
    assert.ok(
      getTechnologyBySlug("validation-duplicate-review-draft"),
      "Expected published duplicate review draft detail route to resolve by slug."
    );
    assertNoInternalOnlyFields(publishedTechnology);

    console.log("Duplicate review workflow validation passed.");
  } finally {
    restoreFile(importedCandidatesSnapshotPath, snapshotBackup);
    restoreFile(candidateReviewStatePath, reviewStateBackup);
    restoreFile(technologyWorkspaceStorePath, workspaceStoreBackup);
    restoreFile(duplicateGroupStorePath, duplicateGroupStoreBackup);
  }
}

main();

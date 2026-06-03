import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

import { getAllTechnologies } from "../src/lib/content";
import {
  buildDailyDigestFromTechnologies,
  evaluateDailyDigestPublishReadiness,
  generateDailyDigest,
  getDigestTechnologySections,
  getPublishedDailyDigestByDate,
  getSelectedDigestTechnologyIds,
  publishDailyDigest,
  updateDailyDigest,
  updateDailyDigestItemControl
} from "../src/lib/digest-workflow";
import { evaluateTechnologyPriority } from "../src/lib/ranking";
import type { DailyDigest, TechnologyItem } from "../src/types/content";

const configDirPath = path.join(process.cwd(), "config");
const digestStorePath = path.join(configDirPath, "daily-digests.json");
const now = new Date("2026-05-23T12:00:00.000Z");

const internalOnlyTerms = [
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "qualityFlags",
  "candidateQuality",
  "sourceQuality",
  "priorityScore",
  "editorialNotes",
  "manuallyAddedTechnologyIds",
  "excludedTechnologyIds",
  "pinnedTechnologyIds",
  "orderedTechnologyIds"
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

  writeFileSync(filePath, value, "utf8");
}

function writeDigestStore(digests: DailyDigest[]) {
  mkdirSync(configDirPath, { recursive: true });
  writeFileSync(
    digestStorePath,
    JSON.stringify({ updatedAt: now.toISOString(), digests }, null, 2),
    "utf8"
  );
}

function buildTechnology(
  overrides: Partial<TechnologyItem> & Pick<TechnologyItem, "id" | "slug">
): TechnologyItem {
  return {
    id: overrides.id,
    slug: overrides.slug,
    title: overrides.title ?? {
      original: `Digest validation ${overrides.id}`
    },
    summary: overrides.summary ?? {
      original:
        "A complete digest validation technology item with enough context for daily briefing."
    },
    content: overrides.content ?? {
      original:
        "This technology item is complete enough to validate Daily Digest selection, aggregation, and user-facing field isolation."
    },
    type: overrides.type ?? "tool",
    publishDate: overrides.publishDate ?? "2026-05-22",
    sourceName: overrides.sourceName ?? "Digest Validation Source",
    sourceUrl: overrides.sourceUrl ?? `https://example.com/${overrides.slug}`,
    sourceLanguage: overrides.sourceLanguage ?? "en",
    translationStatus: overrides.translationStatus ?? "pending",
    publisherName: overrides.publisherName ?? "Digest Publisher",
    publisherType: overrides.publisherType ?? "big-tech",
    importanceLevel: overrides.importanceLevel ?? "critical",
    status: overrides.status ?? "published",
    tags: overrides.tags ?? ["tag-ai-agents"],
    relatedKnowledgeIds: overrides.relatedKnowledgeIds ?? ["knowledge-tool-use"],
    relatedSkillIds: overrides.relatedSkillIds ?? ["skill-agent-design"],
    sourceReferences: overrides.sourceReferences,
    priority: overrides.priority
  };
}

function buildStoreDigest(
  date: string,
  technologies: TechnologyItem[]
): DailyDigest {
  const selectedTechnologies = technologies.slice(0, 2);

  return {
    id: `digest-${date}`,
    date,
    status: "draft",
    title: `Daily Technology Digest - ${date}`,
    summary: "2 item(s) are selected for editorial validation.",
    editorialSummary: "",
    highPriorityTechnologyIds: [selectedTechnologies[0].id],
    watchTechnologyIds: [selectedTechnologies[1].id],
    manuallyAddedTechnologyIds: [],
    excludedTechnologyIds: [],
    pinnedTechnologyIds: [],
    orderedTechnologyIds: selectedTechnologies.map((technology) => technology.id),
    skillIds: Array.from(
      new Set(selectedTechnologies.flatMap((technology) => technology.relatedSkillIds))
    ),
    knowledgeIds: Array.from(
      new Set(
        selectedTechnologies.flatMap((technology) => technology.relatedKnowledgeIds)
      )
    ),
    sourceNames: Array.from(
      new Set(selectedTechnologies.map((technology) => technology.sourceName))
    ),
    generatedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    editorialNotes: ["Validation seed digest."]
  };
}

function assertNoInternalDigestFields(value: unknown) {
  const serializedValue = JSON.stringify(value);

  for (const term of internalOnlyTerms) {
    assert.equal(
      serializedValue.includes(term),
      false,
      `Digest user-facing data should not include ${term}.`
    );
  }
}

function toPublicDigestPayload(digest: DailyDigest) {
  const { highPriorityTechnologies, watchTechnologies } =
    getDigestTechnologySections(digest);
  const toPublicTechnology = (technology: TechnologyItem) => ({
    title: technology.title,
    slug: technology.slug,
    summary: technology.summary,
    sourceName: technology.sourceName,
    publishDate: technology.publishDate,
    tags: technology.tags
  });

  return {
    title: digest.title,
    summary: digest.editorialSummary?.trim() || digest.summary,
    date: digest.date,
    highPriorityTechnologies: highPriorityTechnologies.map(toPublicTechnology),
    watchTechnologies: watchTechnologies.map(toPublicTechnology),
    skillIds: digest.skillIds,
    knowledgeIds: digest.knowledgeIds,
    sourceNames: digest.sourceNames
  };
}

function main() {
  const digestStoreBackup = backupFile(digestStorePath);

  try {
    mkdirSync(configDirPath, { recursive: true });
    writeDigestStore([]);

    const highPriorityTechnology = buildTechnology({
      id: "digest-high",
      slug: "digest-high-priority"
    });
    const watchTechnology = buildTechnology({
      id: "digest-watch",
      slug: "digest-watch",
      importanceLevel: "signal",
      publisherType: "startup",
      tags: [],
      relatedKnowledgeIds: [],
      relatedSkillIds: []
    });
    const lowPriorityTechnology = buildTechnology({
      id: "digest-low",
      slug: "digest-low",
      title: { original: "Low quality digest validation item" },
      summary: { original: "" },
      content: { original: "" },
      publishDate: "2025-01-01",
      publisherName: "",
      publisherType: "media",
      importanceLevel: "signal",
      tags: [],
      relatedKnowledgeIds: [],
      relatedSkillIds: []
    });
    const draftTechnology = buildTechnology({
      id: "digest-draft",
      slug: "digest-draft",
      status: "draft"
    });
    const generatedDigest = buildDailyDigestFromTechnologies(
      [
        highPriorityTechnology,
        watchTechnology,
        lowPriorityTechnology,
        draftTechnology
      ],
      "2026-05-23",
      { now }
    );

    assert.equal(
      evaluateTechnologyPriority(highPriorityTechnology, { now }).priorityLevel,
      "high_priority"
    );
    assert.equal(
      evaluateTechnologyPriority(watchTechnology, { now }).priorityLevel,
      "watch"
    );
    assert.equal(
      evaluateTechnologyPriority(lowPriorityTechnology, { now }).priorityLevel,
      "low_priority"
    );
    assert.deepEqual(generatedDigest.highPriorityTechnologyIds, ["digest-high"]);
    assert.deepEqual(generatedDigest.watchTechnologyIds, ["digest-watch"]);
    assert.equal(
      generatedDigest.highPriorityTechnologyIds.includes("digest-draft"),
      false
    );
    assert.equal(generatedDigest.watchTechnologyIds.includes("digest-draft"), false);
    assert.equal(generatedDigest.highPriorityTechnologyIds.includes("digest-low"), false);
    assert.equal(generatedDigest.watchTechnologyIds.includes("digest-low"), false);

    const publishedTechnologies = getAllTechnologies();

    assert.ok(
      publishedTechnologies.length >= 3,
      "Expected at least three published technologies for digest workflow validation."
    );

    const date = "2026-05-23";
    const seedDigest = buildStoreDigest(date, publishedTechnologies);

    writeDigestStore([seedDigest]);

    const editedDigest = updateDailyDigest(date, {
      title: "Edited Daily Digest",
      summary: "Edited generated summary.",
      editorialSummary: "Editor-written public summary.",
      editorialNotes: ["Manual editorial note."]
    });

    assert.equal(editedDigest.title, "Edited Daily Digest");
    assert.equal(editedDigest.summary, "Edited generated summary.");
    assert.equal(editedDigest.editorialSummary, "Editor-written public summary.");

    const excludedTechnologyId = publishedTechnologies[0].id;
    const manuallyAddedTechnologyId = publishedTechnologies[2].id;
    const excludedDigest = updateDailyDigestItemControl(
      date,
      excludedTechnologyId,
      "exclude"
    );

    assert.equal(
      getSelectedDigestTechnologyIds(excludedDigest).includes(excludedTechnologyId),
      false
    );

    const manuallyAddedDigest = updateDailyDigestItemControl(
      date,
      manuallyAddedTechnologyId,
      "include"
    );

    assert.ok(
      manuallyAddedDigest.manuallyAddedTechnologyIds.includes(
        manuallyAddedTechnologyId
      )
    );

    const pinnedDigest = updateDailyDigestItemControl(
      date,
      manuallyAddedTechnologyId,
      "pin"
    );

    assert.ok(pinnedDigest.pinnedTechnologyIds.includes(manuallyAddedTechnologyId));

    const movedDigest = updateDailyDigestItemControl(
      date,
      manuallyAddedTechnologyId,
      "move_up"
    );

    assert.ok(movedDigest.orderedTechnologyIds.includes(manuallyAddedTechnologyId));

    const regeneratedDigest = generateDailyDigest(date);

    assert.ok(regeneratedDigest.excludedTechnologyIds.includes(excludedTechnologyId));
    assert.ok(
      regeneratedDigest.manuallyAddedTechnologyIds.includes(
        manuallyAddedTechnologyId
      )
    );
    assert.ok(regeneratedDigest.pinnedTechnologyIds.includes(manuallyAddedTechnologyId));
    assert.equal(
      regeneratedDigest.editorialSummary,
      "Editor-written public summary."
    );

    const incompleteReadiness = evaluateDailyDigestPublishReadiness({
      ...regeneratedDigest,
      title: "",
      highPriorityTechnologyIds: [],
      watchTechnologyIds: [],
      manuallyAddedTechnologyIds: [],
      excludedTechnologyIds: []
    });

    assert.equal(incompleteReadiness.isReady, false);
    assert.ok(
      incompleteReadiness.blockingErrors.some(
        (issue) => issue.code === "missing_title"
      )
    );

    const unpublishedReadiness = evaluateDailyDigestPublishReadiness(
      {
        ...regeneratedDigest,
        highPriorityTechnologyIds: [draftTechnology.id],
        watchTechnologyIds: [],
        manuallyAddedTechnologyIds: [],
        excludedTechnologyIds: []
      },
      {
        publishedTechnologies: [highPriorityTechnology],
        allTechnologies: [highPriorityTechnology, draftTechnology]
      }
    );

    assert.equal(unpublishedReadiness.isReady, false);
    assert.ok(
      unpublishedReadiness.blockingErrors.some(
        (issue) => issue.code === "unpublished_technology"
      )
    );

    const duplicateReadiness = evaluateDailyDigestPublishReadiness(
      {
        ...regeneratedDigest,
        highPriorityTechnologyIds: [publishedTechnologies[1].id],
        watchTechnologyIds: [publishedTechnologies[1].id],
        manuallyAddedTechnologyIds: [],
        excludedTechnologyIds: []
      },
      { publishedTechnologies, allTechnologies: publishedTechnologies }
    );

    assert.equal(duplicateReadiness.isReady, false);
    assert.ok(
      duplicateReadiness.blockingErrors.some(
        (issue) => issue.code === "duplicate_technology"
      )
    );

    // Reset to a clean publishable digest after mutation-focused assertions above.
    writeDigestStore([
      {
        ...buildStoreDigest(date, publishedTechnologies),
        title: "Edited Daily Digest",
        summary: "Edited generated summary.",
        editorialSummary: "Editor-written public summary."
      }
    ]);

    const publishedDigest = publishDailyDigest(date);
    const lookupDigest = getPublishedDailyDigestByDate(date);

    assert.equal(publishedDigest.status, "published");
    assert.ok(publishedDigest.publishedAt);
    assert.ok(lookupDigest, "Expected published digest date lookup to work.");
    assert.equal(lookupDigest?.date, date);
    assertNoInternalDigestFields(toPublicDigestPayload(publishedDigest));

    const draftDate = "2026-05-24";

    writeDigestStore([
      publishedDigest,
      {
        ...publishedDigest,
        id: `digest-${draftDate}`,
        date: draftDate,
        status: "draft",
        publishedAt: undefined
      }
    ]);

    assert.equal(getPublishedDailyDigestByDate(draftDate), undefined);

    console.log("Digest workflow validation passed.");
  } finally {
    restoreFile(digestStorePath, digestStoreBackup);
  }
}

main();

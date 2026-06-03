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
  buildDigestShareText,
  getDigestDeliveryFeed,
  renderDigestJsonFeed,
  renderDigestRssXml
} from "../src/lib/digest-delivery";
import {
  getLatestPublishedDailyDigest,
  getPublishedDailyDigestByDate
} from "../src/lib/digest-workflow";
import type { DailyDigest, TechnologyItem } from "../src/types/content";

const configDirPath = path.join(process.cwd(), "config");
const digestStorePath = path.join(configDirPath, "daily-digests.json");
const validationBaseUrl = "https://example.test";
const now = "2026-05-23T12:00:00.000Z";
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
    JSON.stringify({ updatedAt: now, digests }, null, 2),
    "utf8"
  );
}

function buildDigest(
  date: string,
  status: DailyDigest["status"],
  technologies: TechnologyItem[]
): DailyDigest {
  const [highPriorityTechnology, watchTechnology] = technologies;

  return {
    id: `digest-${date}`,
    date,
    status,
    title: `Delivery validation digest ${date}`,
    summary: "A public delivery validation digest built from published records.",
    editorialSummary: "Editor-approved delivery summary for public readers.",
    highPriorityTechnologyIds: [highPriorityTechnology.id],
    watchTechnologyIds: [watchTechnology.id],
    manuallyAddedTechnologyIds: [],
    excludedTechnologyIds: [],
    pinnedTechnologyIds: [],
    orderedTechnologyIds: [highPriorityTechnology.id, watchTechnology.id],
    skillIds: Array.from(
      new Set(technologies.flatMap((technology) => technology.relatedSkillIds))
    ),
    knowledgeIds: Array.from(
      new Set(technologies.flatMap((technology) => technology.relatedKnowledgeIds))
    ),
    sourceNames: Array.from(
      new Set(technologies.map((technology) => technology.sourceName))
    ),
    generatedAt: now,
    updatedAt: now,
    publishedAt: status === "published" ? now : undefined,
    editorialNotes: ["Workspace-only note that must not appear in feeds."]
  };
}

function assertNoInternalFields(value: unknown, label: string) {
  const serializedValue =
    typeof value === "string" ? value : JSON.stringify(value);

  for (const term of internalOnlyTerms) {
    assert.equal(
      serializedValue.includes(term),
      false,
      `${label} should not include internal-only field ${term}.`
    );
  }
}

function main() {
  const digestStoreBackup = backupFile(digestStorePath);

  try {
    const technologies = getAllTechnologies().slice(0, 2);

    assert.equal(
      technologies.length,
      2,
      "Expected at least two published technologies for delivery validation."
    );

    const publishedDigest = buildDigest("2026-05-23", "published", technologies);
    const draftDigest = buildDigest("2026-05-24", "draft", technologies);
    const archivedDigest = buildDigest("2026-05-25", "archived", technologies);

    writeDigestStore([draftDigest, archivedDigest, publishedDigest]);

    const feed = getDigestDeliveryFeed(undefined, validationBaseUrl);

    assert.equal(feed.items.length, 1);
    assert.equal(feed.items[0].date, publishedDigest.date);
    assert.equal(feed.items[0].title, publishedDigest.title);
    assert.equal(
      feed.items.some((item) => item.date === draftDigest.date),
      false,
      "Draft digest should not appear in delivery feed."
    );
    assert.equal(
      feed.items.some((item) => item.date === archivedDigest.date),
      false,
      "Archived digest should not appear in delivery feed by default."
    );

    const feedItem = feed.items[0];

    assert.ok(feedItem.digestUrl.endsWith(`/digest/${publishedDigest.date}`));
    assert.equal(new URL(feedItem.digestUrl).origin, validationBaseUrl);
    assert.ok(feedItem.highPriorityItems.length > 0);
    assert.ok(Array.isArray(feedItem.watchItems));
    assert.ok(feedItem.skillNames.length > 0);
    assert.ok(feedItem.knowledgeNames.length > 0);
    assert.ok(feedItem.sourceNames.length > 0);

    const jsonFeed = renderDigestJsonFeed(feed);
    const rssFeed = renderDigestRssXml(feed);
    const shareText = buildDigestShareText(publishedDigest, validationBaseUrl);

    assertNoInternalFields(feed, "Delivery feed model");
    assertNoInternalFields(jsonFeed, "JSON feed");
    assertNoInternalFields(rssFeed, "RSS feed");
    assertNoInternalFields(shareText, "Share text");
    assert.equal(JSON.stringify(jsonFeed).includes(draftDigest.title), false);
    assert.equal(JSON.stringify(jsonFeed).includes(archivedDigest.title), false);
    assert.equal(rssFeed.includes(publishedDigest.title), true);
    assert.equal(rssFeed.includes(draftDigest.title), false);
    assert.equal(rssFeed.includes(archivedDigest.title), false);
    assert.equal(shareText.includes(`/digest/${publishedDigest.date}`), true);

    assert.equal(
      getLatestPublishedDailyDigest()?.date,
      publishedDigest.date,
      "/digest/today should resolve to the latest published digest."
    );
    assert.ok(
      getPublishedDailyDigestByDate(publishedDigest.date),
      "Published digest date lookup should work."
    );
    assert.equal(getPublishedDailyDigestByDate(draftDigest.date), undefined);
    assert.equal(getPublishedDailyDigestByDate(archivedDigest.date), undefined);

    console.log("Digest delivery validation passed.");
  } finally {
    restoreFile(digestStorePath, digestStoreBackup);
  }
}

main();

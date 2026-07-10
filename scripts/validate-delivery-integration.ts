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
  buildDailyDigestWebhookPayload,
  buildDeliveryRequestPayload,
  createDeliveryChannel,
  getDeliveryRuns,
  maskEndpointUrl,
  retryDeliveryRun,
  sendDailyDigestToChannel
} from "../src/lib/delivery-workflow";
import {
  getDigestDeliveryFeed,
  renderDigestJsonFeed
} from "../src/lib/digest-delivery";
import type { DailyDigest, TechnologyItem } from "../src/types/content";

const configDirPath = path.join(process.cwd(), "config");
const digestStorePath = path.join(configDirPath, "daily-digests.json");
const deliveryStorePath = path.join(configDirPath, "delivery.json");
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
  "orderedTechnologyIds",
  "endpointUrl",
  "DeliveryChannel",
  "DeliveryRun",
  "requestPayloadPreview",
  "responseBodyPreview",
  "retryOfDeliveryRunId"
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
    title: `Delivery integration validation ${date}`,
    summary: "A published digest prepared for webhook delivery validation.",
    editorialSummary: "Editor-approved public summary for delivery validation.",
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
      new Set(
        technologies.flatMap((technology) => technology.relatedKnowledgeIds)
      )
    ),
    sourceNames: Array.from(
      new Set(technologies.map((technology) => technology.sourceName))
    ),
    generatedAt: now,
    updatedAt: now,
    publishedAt: status === "published" ? now : undefined,
    editorialNotes: ["Workspace-only delivery note."]
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

async function assertRejectsWithMessage(
  promise: Promise<unknown>,
  expectedMessage: string
) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message.includes(expectedMessage), true);

    return true;
  });
}

async function main() {
  const digestStoreBackup = backupFile(digestStorePath);
  const deliveryStoreBackup = backupFile(deliveryStorePath);

  try {
    if (existsSync(deliveryStorePath)) {
      unlinkSync(deliveryStorePath);
    }

    const technologies = getAllTechnologies()
      .filter((technology) => technology.status === "published")
      .slice(0, 2);

    assert.equal(
      technologies.length,
      2,
      "Expected at least two published technologies for delivery integration validation."
    );

    const publishedDigest = buildDigest(
      "2026-05-23",
      "published",
      technologies
    );
    const draftDigest = buildDigest("2026-05-24", "draft", technologies);
    const archivedDigest = buildDigest("2026-05-25", "archived", technologies);

    writeDigestStore([draftDigest, archivedDigest, publishedDigest]);

    const successChannel = createDeliveryChannel({
      name: "Validation success webhook",
      type: "webhook",
      enabled: true,
      endpointUrl: "mock://success",
      description: "Simulates a successful webhook response.",
      format: "json"
    });
    const failedChannel = createDeliveryChannel({
      name: "Validation failed webhook",
      type: "webhook",
      enabled: true,
      endpointUrl: "mock://failed",
      description: "Simulates a failed webhook response.",
      format: "json"
    });
    const disabledChannel = createDeliveryChannel({
      name: "Validation disabled webhook",
      type: "webhook",
      enabled: false,
      endpointUrl: "mock://success",
      description: "Disabled channels must not send.",
      format: "text"
    });

    await assertRejectsWithMessage(
      sendDailyDigestToChannel({
        digestDate: publishedDigest.date,
        channelId: disabledChannel.id
      }),
      "停用"
    );
    await assertRejectsWithMessage(
      sendDailyDigestToChannel({
        digestDate: draftDigest.date,
        channelId: successChannel.id
      }),
      "已发布"
    );
    await assertRejectsWithMessage(
      sendDailyDigestToChannel({
        digestDate: archivedDigest.date,
        channelId: successChannel.id
      }),
      "已发布"
    );

    const payload = buildDailyDigestWebhookPayload(
      publishedDigest,
      now,
      "https://example.test"
    );
    const requestPayload = buildDeliveryRequestPayload(
      publishedDigest,
      successChannel,
      now
    );

    assert.equal(payload.type, "daily_digest");
    assert.equal(payload.digestDate, publishedDigest.date);
    assert.equal(
      payload.digestUrl,
      `https://example.test/digest/${publishedDigest.date}`
    );
    assert.ok(payload.highPriorityItems.length > 0);
    assert.ok(Array.isArray(payload.watchItems));
    assert.equal(requestPayload.contentType.includes("application/json"), true);
    assertNoInternalFields(payload, "Webhook JSON payload");
    assertNoInternalFields(requestPayload.preview, "Webhook request preview");

    const successRun = await sendDailyDigestToChannel({
      digestDate: publishedDigest.date,
      channelId: successChannel.id
    });

    assert.equal(successRun.status, "success");
    assert.equal(successRun.responseStatus, 200);

    const failedRun = await sendDailyDigestToChannel({
      digestDate: publishedDigest.date,
      channelId: failedChannel.id
    });

    assert.equal(failedRun.status, "failed");
    assert.equal(failedRun.responseStatus, 500);
    assert.ok(failedRun.errorMessage?.includes("HTTP 500"));

    const retryRun = await retryDeliveryRun(failedRun.id);

    assert.equal(retryRun.retryOfDeliveryRunId, failedRun.id);
    assert.equal(retryRun.status, "failed");

    const runs = getDeliveryRuns();

    assert.ok(runs.some((run) => run.id === successRun.id));
    assert.ok(runs.some((run) => run.id === failedRun.id));
    assert.ok(runs.some((run) => run.retryOfDeliveryRunId === failedRun.id));

    const maskedEndpoint = maskEndpointUrl(
      "https://example.test/webhook?token=super-secret&channel=digest"
    );

    assert.equal(maskedEndpoint.includes("super-secret"), false);
    assert.equal(maskedEndpoint.includes("token="), true);

    const publicFeed = getDigestDeliveryFeed(undefined, "https://example.test");
    const jsonFeed = renderDigestJsonFeed(publicFeed);

    assertNoInternalFields(publicFeed, "Public digest feed");
    assertNoInternalFields(jsonFeed, "Public JSON feed");
    assert.equal(
      publicFeed.items.some((item) => item.date === draftDigest.date),
      false,
      "Draft digest should not be publicly delivered."
    );
    assert.equal(
      publicFeed.items.some((item) => item.date === archivedDigest.date),
      false,
      "Archived digest should not be publicly delivered by default."
    );

    console.log("Digest delivery integration validation passed.");
  } finally {
    restoreFile(digestStorePath, digestStoreBackup);
    restoreFile(deliveryStorePath, deliveryStoreBackup);
  }
}

void main();

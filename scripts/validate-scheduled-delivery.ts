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
  createDeliveryChannel,
  getDeliveryRuns
} from "../src/lib/delivery-workflow";
import {
  getDigestDeliveryFeed,
  renderDigestJsonFeed
} from "../src/lib/digest-delivery";
import {
  createScheduledDelivery,
  getScheduledDeliveryRuns,
  runDueSchedules,
  runScheduleById
} from "../src/lib/scheduled-delivery-workflow";
import type { DailyDigest, TechnologyItem } from "../src/types/content";

const configDirPath = path.join(process.cwd(), "config");
const digestStorePath = path.join(configDirPath, "daily-digests.json");
const deliveryStorePath = path.join(configDirPath, "delivery.json");
const scheduleStorePath = path.join(configDirPath, "scheduled-delivery.json");
const now = "2026-05-25T01:00:00.000Z";
const scheduledRunTime = new Date("2026-05-25T01:05:00.000Z");
const internalOnlyTerms = [
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "qualityFlags",
  "candidateQuality",
  "sourceQuality",
  "priorityScore",
  "endpointUrl",
  "DeliveryChannel",
  "DeliveryRun",
  "DeliveryLog",
  "ScheduledDelivery",
  "ScheduledDeliveryRun",
  "scheduleTime",
  "channelIds",
  "deliveryLogIds",
  "lastRunStatus",
  "lastRunMessage",
  "requestPayloadPreview",
  "responseBodyPreview"
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
    title: `Scheduled delivery validation ${date}`,
    summary: "A public digest prepared for scheduled delivery validation.",
    editorialSummary: "Editor-approved public summary for scheduled delivery.",
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
    editorialNotes: ["Workspace-only scheduled delivery validation note."]
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
  const scheduleStoreBackup = backupFile(scheduleStorePath);

  try {
    for (const filePath of [deliveryStorePath, scheduleStorePath]) {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }

    const technologies = getAllTechnologies()
      .filter((technology) => technology.status === "published")
      .slice(0, 2);

    assert.equal(
      technologies.length,
      2,
      "Expected at least two published technologies for scheduled delivery validation."
    );

    const publishedDigest = buildDigest("2026-05-25", "published", technologies);
    const draftDigest = buildDigest("2026-05-26", "draft", technologies);
    const archivedDigest = buildDigest("2026-05-27", "archived", technologies);

    writeDigestStore([draftDigest, archivedDigest, publishedDigest]);

    const successChannel = createDeliveryChannel({
      name: "Scheduled delivery success webhook",
      type: "webhook",
      enabled: true,
      endpointUrl: "mock://success",
      description: "Simulates a successful scheduled send.",
      format: "json"
    });
    const failedChannel = createDeliveryChannel({
      name: "Scheduled delivery failed webhook",
      type: "feishu_webhook",
      enabled: true,
      endpointUrl: "mock://failed",
      description: "Simulates a failed scheduled send.",
      format: "text"
    });
    const disabledChannel = createDeliveryChannel({
      name: "Scheduled delivery disabled webhook",
      type: "webhook",
      enabled: false,
      endpointUrl: "mock://success",
      description: "Disabled channels must be skipped.",
      format: "json"
    });

    const disabledSchedule = createScheduledDelivery({
      name: "Disabled scheduled delivery",
      enabled: false,
      digestTarget: "latest_published_digest",
      channelIds: [successChannel.id],
      scheduleTime: "09:00",
      timezone: "Asia/Shanghai"
    });
    const publishedSchedule = createScheduledDelivery({
      name: "Published digest scheduled delivery",
      enabled: true,
      digestTarget: "digest_by_date",
      digestDate: publishedDigest.date,
      channelIds: [successChannel.id, failedChannel.id, disabledChannel.id],
      scheduleTime: "09:00",
      timezone: "Asia/Shanghai"
    });
    const draftSchedule = createScheduledDelivery({
      name: "Draft digest scheduled delivery",
      enabled: true,
      digestTarget: "digest_by_date",
      digestDate: draftDigest.date,
      channelIds: [successChannel.id],
      scheduleTime: "09:00",
      timezone: "Asia/Shanghai"
    });

    await assertRejectsWithMessage(
      runScheduleById(disabledSchedule.id, {
        triggerType: "manual",
        force: true
      }),
      "disabled"
    );

    const draftRun = await runScheduleById(draftSchedule.id, {
      triggerType: "manual",
      force: true,
      now: scheduledRunTime
    });

    assert.equal(draftRun.status, "failed");
    assert.equal(draftRun.deliveryLogIds.length, 0);
    assert.equal(draftRun.message.includes("published"), true);

    const firstScheduledRun = await runScheduleById(publishedSchedule.id, {
      triggerType: "scheduled",
      force: false,
      now: scheduledRunTime
    });

    assert.equal(firstScheduledRun.status, "partial");
    assert.equal(firstScheduledRun.successfulChannels, 1);
    assert.equal(firstScheduledRun.failedChannels, 1);
    assert.equal(firstScheduledRun.skippedChannels, 1);
    assert.equal(firstScheduledRun.deliveryLogIds.length, 2);

    const duplicateScheduledRun = await runScheduleById(publishedSchedule.id, {
      triggerType: "scheduled",
      force: false,
      now: scheduledRunTime
    });

    assert.equal(duplicateScheduledRun.deliveryLogIds.length, 0);
    assert.equal(duplicateScheduledRun.successfulChannels, 0);
    assert.equal(duplicateScheduledRun.failedChannels, 0);
    assert.equal(duplicateScheduledRun.skippedChannels, 3);

    const manualRun = await runScheduleById(publishedSchedule.id, {
      triggerType: "manual",
      force: true,
      now: scheduledRunTime
    });

    assert.equal(manualRun.deliveryLogIds.length, 2);
    assert.equal(manualRun.successfulChannels, 1);
    assert.equal(manualRun.failedChannels, 1);
    assert.equal(manualRun.skippedChannels, 1);

    const deliveryRuns = getDeliveryRuns();

    assert.equal(
      deliveryRuns.some((run) => run.channelId === disabledChannel.id),
      false,
      "Disabled channel should not generate a DeliveryLog."
    );
    assert.equal(
      deliveryRuns.some((run) => run.digestDate === draftDigest.date),
      false,
      "Draft digest should not generate a DeliveryLog."
    );
    assert.ok(
      deliveryRuns.some((run) => run.status === "success"),
      "Expected at least one successful DeliveryLog."
    );
    assert.ok(
      deliveryRuns.some((run) => run.status === "failed"),
      "Expected at least one failed DeliveryLog."
    );

    const dueRuns = await runDueSchedules(new Date("2099-05-25T01:00:00.000Z"));

    assert.equal(
      dueRuns.some((run) => run.scheduleId === disabledSchedule.id),
      false,
      "Disabled schedule should not participate in due schedule runs."
    );

    const scheduledRuns = getScheduledDeliveryRuns();

    assert.ok(
      scheduledRuns.some((run) => run.id === firstScheduledRun.id),
      "Scheduled run should be persisted."
    );
    assert.ok(
      scheduledRuns.some((run) => run.id === duplicateScheduledRun.id),
      "Duplicate-protected scheduled run should be persisted."
    );
    assert.ok(
      scheduledRuns.some((run) => run.id === manualRun.id),
      "Manual scheduled run should be persisted."
    );

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

    console.log("Scheduled delivery validation passed.");
  } finally {
    restoreFile(digestStorePath, digestStoreBackup);
    restoreFile(deliveryStorePath, deliveryStoreBackup);
    restoreFile(scheduleStorePath, scheduleStoreBackup);
  }
}

void main();

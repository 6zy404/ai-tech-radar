import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
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
import { createScheduledDelivery } from "../src/lib/scheduled-delivery-workflow";
import {
  getTaskRunnerRuns,
  runScheduledDeliveryTask,
  watchScheduledDeliveryTasks
} from "../src/lib/task-runner";
import type { DailyDigest, TechnologyItem } from "../src/types/content";

const configDirPath = path.join(process.cwd(), "config");
const digestStorePath = path.join(configDirPath, "daily-digests.json");
const deliveryStorePath = path.join(configDirPath, "delivery.json");
const scheduleStorePath = path.join(configDirPath, "scheduled-delivery.json");
const taskRunnerStorePath = path.join(configDirPath, "task-runner.json");
const now = "2026-05-27T01:00:00.000Z";
const dueTime = new Date("2099-05-27T01:05:00.000Z");
const internalOnlyTerms = [
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "endpointUrl",
  "DeliveryChannel",
  "DeliveryRun",
  "ScheduledDelivery",
  "ScheduledDeliveryRun",
  "TaskRunner",
  "task-runner",
  "tasks:run-once",
  "tasks:watch",
  "requestPayloadPreview",
  "responseBodyPreview"
];

function backupFile(filePath: string): string | undefined {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : undefined;
}

function restoreFile(filePath: string, value: string | undefined) {
  if (value === undefined) {
    if (existsSync(filePath)) {
      if (statSync(filePath).isDirectory()) {
        rmSync(filePath, { recursive: true, force: true });
      } else {
        unlinkSync(filePath);
      }
    }

    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    rmSync(filePath, { recursive: true, force: true });
  }

  writeFileSync(filePath, value, "utf8");
}

function removeRuntimeStores() {
  for (const filePath of [
    deliveryStorePath,
    scheduleStorePath,
    taskRunnerStorePath
  ]) {
    if (existsSync(filePath)) {
      if (statSync(filePath).isDirectory()) {
        rmSync(filePath, { recursive: true, force: true });
      } else {
        unlinkSync(filePath);
      }
    }
  }
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
    title: `Task runner validation ${date}`,
    summary: "A public digest prepared for task runner validation.",
    editorialSummary:
      "Editor-approved public summary for task runner validation.",
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
    editorialNotes: ["Workspace-only task runner validation note."]
  };
}

function createLoggerBuffer(): {
  lines: string[];
  logger: (message: string) => void;
} {
  const lines: string[] = [];

  return {
    lines,
    logger(message: string) {
      lines.push(message);
    }
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

async function main() {
  const digestStoreBackup = backupFile(digestStorePath);
  const deliveryStoreBackup = backupFile(deliveryStorePath);
  const scheduleStoreBackup = backupFile(scheduleStorePath);
  const taskRunnerStoreBackup = backupFile(taskRunnerStorePath);

  try {
    removeRuntimeStores();

    const technologies = getAllTechnologies()
      .filter((technology) => technology.status === "published")
      .slice(0, 2);

    assert.equal(
      technologies.length,
      2,
      "Expected at least two published technologies for task runner validation."
    );

    const emptyLogger = createLoggerBuffer();
    const emptyRun = await runScheduledDeliveryTask({
      mode: "run_once",
      now: new Date("2000-01-01T00:00:00.000Z"),
      logger: emptyLogger.logger
    });

    assert.equal(emptyRun.dueScheduleCount, 0);
    assert.equal(emptyRun.status, "success");
    assert.equal(
      emptyLogger.lines.some((line) => line.includes("No due schedules.")),
      true
    );

    removeRuntimeStores();

    const publishedDigest = buildDigest(
      "2026-05-27",
      "published",
      technologies
    );
    const draftDigest = buildDigest("2026-05-28", "draft", technologies);
    const archivedDigest = buildDigest("2026-05-29", "archived", technologies);

    writeDigestStore([draftDigest, archivedDigest, publishedDigest]);

    const successChannel = createDeliveryChannel({
      name: "Task runner success webhook",
      type: "webhook",
      enabled: true,
      endpointUrl: "mock://success",
      description: "Simulates a successful runner send.",
      format: "json"
    });
    const failedChannel = createDeliveryChannel({
      name: "Task runner failed webhook",
      type: "feishu_webhook",
      enabled: true,
      endpointUrl: "mock://failed?token=super-secret",
      description: "Simulates a failed runner send.",
      format: "text"
    });
    const disabledChannel = createDeliveryChannel({
      name: "Task runner disabled webhook",
      type: "webhook",
      enabled: false,
      endpointUrl: "mock://success",
      description: "Disabled channels must be skipped.",
      format: "json"
    });

    const disabledSchedule = createScheduledDelivery({
      name: "Task runner disabled schedule",
      enabled: false,
      digestTarget: "latest_published_digest",
      channelIds: [successChannel.id],
      scheduleTime: "09:00",
      timezone: "Asia/Shanghai"
    });
    const publishedSchedule = createScheduledDelivery({
      name: "Task runner published schedule",
      enabled: true,
      digestTarget: "digest_by_date",
      digestDate: publishedDigest.date,
      channelIds: [successChannel.id, failedChannel.id, disabledChannel.id],
      scheduleTime: "09:00",
      timezone: "Asia/Shanghai"
    });
    const draftSchedule = createScheduledDelivery({
      name: "Task runner draft schedule",
      enabled: true,
      digestTarget: "digest_by_date",
      digestDate: draftDigest.date,
      channelIds: [successChannel.id],
      scheduleTime: "09:00",
      timezone: "Asia/Shanghai"
    });
    const runOnceLogger = createLoggerBuffer();
    const runOnce = await runScheduledDeliveryTask({
      mode: "run_once",
      now: dueTime,
      logger: runOnceLogger.logger
    });

    assert.equal(runOnce.dueScheduleCount, 2);
    assert.equal(runOnce.skippedScheduleCount >= 1, true);
    assert.equal(runOnce.partialCount, 1);
    assert.equal(runOnce.failedCount, 1);
    assert.equal(runOnce.deliveryLogsCreated, 2);
    assert.equal(runOnce.status, "partial");
    assert.equal(
      runOnce.messages.some((message) =>
        message.includes(publishedSchedule.name)
      ),
      true
    );
    assert.equal(
      runOnce.messages.some((message) => message.includes(draftSchedule.name)),
      true
    );
    assert.equal(
      runOnce.messages.some((message) =>
        message.includes(disabledSchedule.name)
      ),
      false
    );

    const deliveryRuns = getDeliveryRuns();

    assert.equal(
      deliveryRuns.some((run) => run.channelId === disabledChannel.id),
      false,
      "Disabled channel should not send from the task runner."
    );
    assert.equal(
      deliveryRuns.some((run) => run.digestDate === draftDigest.date),
      false,
      "Draft digest should not create delivery logs."
    );
    assert.ok(
      deliveryRuns.some((run) => run.status === "failed"),
      "Failed delivery should create a failed DeliveryRun."
    );

    const duplicateLogger = createLoggerBuffer();
    const duplicateRun = await runScheduledDeliveryTask({
      mode: "run_once",
      now: dueTime,
      logger: duplicateLogger.logger
    });

    assert.equal(duplicateRun.deliveryLogsCreated, 0);
    assert.equal(
      duplicateRun.messages.some((message) => message.includes("3 skipped")),
      true,
      "Duplicate-protected second run should skip the already sent channels."
    );

    const allLogLines = [...runOnceLogger.lines, ...duplicateLogger.lines].join(
      "\n"
    );

    assert.equal(allLogLines.includes("super-secret"), false);
    assert.equal(allLogLines.includes("endpointUrl"), false);
    assert.equal(allLogLines.includes("mock://failed?token"), false);

    const watchRuns = await watchScheduledDeliveryTasks({
      intervalMs: 0,
      maxIterations: 2,
      nowProvider: () => dueTime,
      logger: createLoggerBuffer().logger
    });

    assert.equal(watchRuns.length, 2);

    for (const filePath of [deliveryStorePath, scheduleStorePath]) {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }
    writeDigestStore([draftDigest, archivedDigest]);

    const noPublishedChannel = createDeliveryChannel({
      name: "No published digest webhook",
      type: "webhook",
      enabled: true,
      endpointUrl: "mock://success",
      description: "Should not send without a published digest.",
      format: "json"
    });

    createScheduledDelivery({
      name: "No published digest schedule",
      enabled: true,
      digestTarget: "latest_published_digest",
      channelIds: [noPublishedChannel.id],
      scheduleTime: "09:00",
      timezone: "Asia/Shanghai"
    });

    const noPublishedRun = await runScheduledDeliveryTask({
      mode: "run_once",
      now: dueTime,
      logger: createLoggerBuffer().logger
    });

    assert.equal(noPublishedRun.failedCount, 1);
    assert.equal(noPublishedRun.deliveryLogsCreated, 0);
    assert.equal(getDeliveryRuns().length, 0);

    const taskRuns = getTaskRunnerRuns();

    assert.ok(taskRuns.length > 0);
    assert.ok(taskRuns.some((run) => run.mode === "run_once"));
    assert.ok(taskRuns.some((run) => run.mode === "watch"));

    if (existsSync(taskRunnerStorePath)) {
      if (statSync(taskRunnerStorePath).isDirectory()) {
        rmSync(taskRunnerStorePath, { recursive: true, force: true });
      } else {
        unlinkSync(taskRunnerStorePath);
      }
    }

    mkdirSync(taskRunnerStorePath);

    const writeFailureLogger = createLoggerBuffer();
    const writeFailureRun = await runScheduledDeliveryTask({
      mode: "run_once",
      now: new Date("2000-01-01T00:00:00.000Z"),
      logger: writeFailureLogger.logger
    });

    assert.equal(writeFailureRun.status, "partial");
    assert.equal(
      writeFailureRun.messages.some((message) =>
        message.includes("Task runner audit write failed")
      ),
      true
    );
    assert.equal(
      writeFailureLogger.lines.some((line) =>
        line.includes("Task runner audit write failed")
      ),
      true
    );

    rmSync(taskRunnerStorePath, { recursive: true, force: true });

    const publicFeed = getDigestDeliveryFeed(undefined, "https://example.test");
    const jsonFeed = renderDigestJsonFeed(publicFeed);

    assertNoInternalFields(publicFeed, "Public digest feed");
    assertNoInternalFields(jsonFeed, "Public JSON feed");

    console.log("Task runner validation passed.");
  } finally {
    restoreFile(digestStorePath, digestStoreBackup);
    restoreFile(deliveryStorePath, deliveryStoreBackup);
    restoreFile(scheduleStorePath, scheduleStoreBackup);
    restoreFile(taskRunnerStorePath, taskRunnerStoreBackup);
  }
}

void main();

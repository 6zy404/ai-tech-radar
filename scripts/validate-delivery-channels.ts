import { getLocalDataDirPath } from "@/lib/local-data";
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
  buildDeliveryRequestPayload,
  createDeliveryChannel,
  getDeliveryChannels,
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

const configDirPath = getLocalDataDirPath();
const digestStorePath = path.join(configDirPath, "daily-digests.json");
const deliveryStorePath = path.join(configDirPath, "delivery.json");
const now = "2026-05-24T12:00:00.000Z";
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
    title: `Delivery channel validation ${date}`,
    summary: "A public digest prepared for delivery channel validation.",
    editorialSummary: "Editor-approved delivery channel validation summary.",
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
    editorialNotes: ["Workspace-only delivery channel validation note."]
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
      "Expected at least two published technologies for delivery channel validation."
    );

    const publishedDigest = buildDigest(
      "2026-05-24",
      "published",
      technologies
    );
    const draftDigest = buildDigest("2026-05-25", "draft", technologies);

    writeDigestStore([draftDigest, publishedDigest]);

    const webhookChannel = createDeliveryChannel({
      name: "Validation generic webhook",
      type: "webhook",
      enabled: true,
      endpointUrl: "mock://success",
      description: "Generic webhook must remain supported.",
      format: "json"
    });
    const feishuChannel = createDeliveryChannel({
      name: "Validation Feishu webhook",
      type: "feishu_webhook",
      enabled: true,
      endpointUrl: "mock://success",
      description: "Simulates a successful Feishu bot webhook.",
      format: "text"
    });
    const disabledFeishuChannel = createDeliveryChannel({
      name: "Disabled Feishu webhook",
      type: "feishu_webhook",
      enabled: false,
      endpointUrl: "mock://success",
      description: "Disabled Feishu channels must not send.",
      format: "text"
    });
    const failedFeishuChannel = createDeliveryChannel({
      name: "Failed Feishu webhook",
      type: "feishu_webhook",
      enabled: true,
      endpointUrl: "mock://failed?token=super-secret",
      description: "Simulates a failed Feishu bot webhook.",
      format: "text"
    });

    const feishuRequest = buildDeliveryRequestPayload(
      publishedDigest,
      feishuChannel,
      now
    );
    const feishuBody = JSON.parse(feishuRequest.body) as {
      msg_type?: string;
      content?: { text?: string };
    };

    assert.equal(feishuRequest.contentType.includes("application/json"), true);
    assert.equal(feishuBody.msg_type, "text");
    assert.ok(feishuBody.content?.text?.includes(publishedDigest.title));
    assert.ok(feishuBody.content?.text?.includes("今日立即关注"));
    assert.ok(feishuBody.content?.text?.includes("值得跟踪"));
    assert.ok(
      feishuBody.content?.text?.includes(`/digest/${publishedDigest.date}`)
    );
    assertNoInternalFields(feishuRequest.body, "Feishu request body");
    assertNoInternalFields(feishuRequest.preview, "Feishu preview");

    await assertRejectsWithMessage(
      sendDailyDigestToChannel({
        digestDate: publishedDigest.date,
        channelId: disabledFeishuChannel.id
      }),
      "停用"
    );
    await assertRejectsWithMessage(
      sendDailyDigestToChannel({
        digestDate: draftDigest.date,
        channelId: feishuChannel.id
      }),
      "已发布"
    );

    const webhookRun = await sendDailyDigestToChannel({
      digestDate: publishedDigest.date,
      channelId: webhookChannel.id
    });
    const feishuRun = await sendDailyDigestToChannel({
      digestDate: publishedDigest.date,
      channelId: feishuChannel.id
    });
    const failedRun = await sendDailyDigestToChannel({
      digestDate: publishedDigest.date,
      channelId: failedFeishuChannel.id
    });
    const retryRun = await retryDeliveryRun(failedRun.id);

    assert.equal(webhookRun.status, "success");
    assert.equal(webhookRun.channelType, "webhook");
    assert.equal(feishuRun.status, "success");
    assert.equal(feishuRun.channelType, "feishu_webhook");
    assert.equal(failedRun.status, "failed");
    assert.equal(failedRun.channelType, "feishu_webhook");
    assert.ok(failedRun.errorMessage?.includes("HTTP 500"));
    assert.equal(retryRun.retryOfDeliveryRunId, failedRun.id);

    const runs = getDeliveryRuns();

    assert.ok(runs.some((run) => run.id === webhookRun.id));
    assert.ok(runs.some((run) => run.id === feishuRun.id));
    assert.ok(runs.some((run) => run.id === failedRun.id));
    assert.ok(runs.some((run) => run.retryOfDeliveryRunId === failedRun.id));

    for (const run of runs) {
      const serializedRun = JSON.stringify(run);

      assert.equal(
        serializedRun.includes("super-secret"),
        false,
        "DeliveryRun must not store complete sensitive webhook URL."
      );
      assert.equal(
        serializedRun.includes("mock://failed?token="),
        false,
        "DeliveryRun must not store endpoint URLs."
      );
    }

    const maskedEndpoint = maskEndpointUrl(
      "https://open.feishu.cn/open-apis/bot/v2/hook/abc?token=super-secret"
    );

    assert.equal(maskedEndpoint.includes("super-secret"), false);
    assert.equal(
      maskedEndpoint.includes("/hook/abc"),
      false,
      "Feishu hook token in the path must be masked."
    );

    // Telegram and Discord (2026-10-13), on mock endpoints: the real Bot API
    // and Discord were never called from this script.
    const telegramToken = "123456789:AAH_validation-token-0123456789abc";
    const telegramChannel = createDeliveryChannel({
      name: "Validation Telegram bot",
      type: "telegram",
      enabled: true,
      endpointUrl: "mock://success",
      format: "text",
      botToken: telegramToken,
      chatId: "-1001234567890"
    });
    const discordChannel = createDeliveryChannel({
      name: "Validation Discord webhook",
      type: "discord",
      enabled: true,
      endpointUrl: "mock://success",
      format: "json"
    });
    const telegramRequest = buildDeliveryRequestPayload(
      publishedDigest,
      telegramChannel,
      now
    );
    const telegramBody = JSON.parse(telegramRequest.body) as {
      chat_id?: string;
      text?: string;
      parse_mode?: string;
    };

    assert.equal(telegramBody.chat_id, "-1001234567890");
    assert.equal(telegramBody.parse_mode, "HTML");
    assert.ok(telegramBody.text?.includes(`/digest/${publishedDigest.date}`));
    assert.ok((telegramBody.text?.length ?? 0) <= 4096);
    assertNoInternalFields(telegramRequest.body, "Telegram request body");

    const discordRequest = buildDeliveryRequestPayload(
      publishedDigest,
      discordChannel,
      now
    );
    const discordBody = JSON.parse(discordRequest.body) as {
      embeds?: Array<{ url?: string; fields?: unknown[] }>;
    };

    assert.equal(discordChannel.format, "text");
    assert.equal(discordBody.embeds?.length, 1);
    assert.ok(
      discordBody.embeds?.[0].url?.endsWith(`/digest/${publishedDigest.date}`)
    );
    assertNoInternalFields(discordRequest.body, "Discord request body");

    const telegramRun = await sendDailyDigestToChannel({
      digestDate: publishedDigest.date,
      channelId: telegramChannel.id
    });
    const discordRun = await sendDailyDigestToChannel({
      digestDate: publishedDigest.date,
      channelId: discordChannel.id
    });

    assert.equal(telegramRun.status, "success");
    assert.equal(discordRun.status, "success");

    const telegramSecret = telegramToken.split(":")[1];

    assert.equal(
      JSON.stringify(getDeliveryRuns()).includes(telegramSecret),
      false,
      "DeliveryRun must not store the Telegram bot token."
    );
    assert.equal(
      JSON.stringify(getDeliveryChannels()).includes(telegramSecret),
      false,
      "Channel reads outside the workflow must not carry the bot token."
    );
    assert.equal(
      getDeliveryChannels().find((channel) => channel.id === telegramChannel.id)
        ?.botTokenMasked,
      "123456789:***"
    );

    const publicFeed = getDigestDeliveryFeed(undefined, "https://example.test");
    const jsonFeed = renderDigestJsonFeed(publicFeed);

    assertNoInternalFields(publicFeed, "Public digest feed");
    assertNoInternalFields(jsonFeed, "Public JSON feed");

    console.log("Delivery channel expansion validation passed.");
  } finally {
    restoreFile(digestStorePath, digestStoreBackup);
    restoreFile(deliveryStorePath, deliveryStoreBackup);
  }
}

void main();

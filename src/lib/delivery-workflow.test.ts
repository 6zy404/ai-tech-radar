import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDeliveryChannel,
  sendDailyDigestToChannel
} from "@/lib/delivery-workflow";
import type { DailyDigest } from "@/types/content";

/**
 * The send path and the site address (2026-10-21). The scheduled task runner
 * never saw `NEXT_PUBLIC_SITE_URL`, so every digest it would have delivered
 * linked to `http://localhost:3000`. A send to a real service is now refused
 * while the address is local, with the variable named; a stand-in on this
 * machine — what every validator uses — is still allowed.
 */

const fixtures = vi.hoisted(() => ({
  digest: {
    id: "digest-2026-10-20",
    date: "2026-10-20",
    status: "published",
    title: "技术简报 - 2026-10-20",
    summary: "两条信号。",
    highPriorityTechnologyIds: [],
    watchTechnologyIds: [],
    manuallyAddedTechnologyIds: [],
    excludedTechnologyIds: [],
    pinnedTechnologyIds: [],
    orderedTechnologyIds: [],
    skillIds: [],
    knowledgeIds: [],
    sourceNames: [],
    generatedAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
    editorialNotes: ""
  },
  send: vi.fn()
}));

// workflow-events.ts fixes its file path when it is first imported, so a temp
// LOCAL_DATA_DIR set in beforeEach would not reach it; swallow the calls.
vi.mock("@/lib/workflow-events", () => ({
  tryRecordWorkflowEvent: () => undefined
}));

vi.mock("@/lib/digest-workflow", () => ({
  getDailyDigestByDate: () => fixtures.digest as unknown as DailyDigest
}));

vi.mock("@/lib/delivery/adapters", () => ({
  getSupportedDeliveryChannelTypes: () => ["webhook"],
  getDeliveryAdapter: () => ({
    type: "webhook",
    label: "Webhook",
    buildPayload: () => ({
      body: "{}",
      contentType: "application/json",
      preview: "{}"
    }),
    send: fixtures.send,
    validateChannelConfig: () => []
  })
}));

const originalDataDir = process.env.LOCAL_DATA_DIR;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
let dataDir: string;

function channelFor(endpointUrl: string) {
  return createDeliveryChannel({
    name: "测试渠道",
    type: "webhook",
    enabled: true,
    endpointUrl,
    format: "json"
  });
}

describe("sendDailyDigestToChannel and the site address", () => {
  beforeEach(() => {
    dataDir = mkdtempSync(path.join(tmpdir(), "delivery-workflow-"));
    process.env.LOCAL_DATA_DIR = dataDir;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    fixtures.send.mockReset();
    fixtures.send.mockResolvedValue({
      ok: true,
      status: 200,
      bodyPreview: "ok"
    });
  });

  afterEach(() => {
    if (originalDataDir === undefined) {
      delete process.env.LOCAL_DATA_DIR;
    } else {
      process.env.LOCAL_DATA_DIR = originalDataDir;
    }

    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }

    rmSync(dataDir, { recursive: true, force: true });
  });

  it("refuses a send to a real service while the site address is local, naming the variable", async () => {
    const channel = channelFor("https://discord.com/api/webhooks/1/token");

    const run = await sendDailyDigestToChannel({
      digestDate: "2026-10-20",
      channelId: channel.id
    });

    expect(run.status).toBe("failed");
    expect(run.errorMessage).toContain("NEXT_PUBLIC_SITE_URL");
    expect(run.errorMessage).toContain("http://localhost:3000");
    expect(run.errorMessage).toContain("已拒绝发送");
    expect(fixtures.send).not.toHaveBeenCalled();
  });

  it("refuses when the variable is set to this machine", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3000";
    const channel = channelFor(
      "https://open.feishu.cn/open-apis/bot/v2/hook/x"
    );

    const run = await sendDailyDigestToChannel({
      digestDate: "2026-10-20",
      channelId: channel.id
    });

    expect(run.status).toBe("failed");
    expect(run.errorMessage).toContain("指向本机");
    expect(fixtures.send).not.toHaveBeenCalled();
  });

  it("still sends to a stand-in on this machine", async () => {
    const channel = channelFor("http://127.0.0.1:9/hook");

    const run = await sendDailyDigestToChannel({
      digestDate: "2026-10-20",
      channelId: channel.id
    });

    expect(run.status).toBe("success");
    expect(fixtures.send).toHaveBeenCalledTimes(1);
  });

  it("sends to a real service once the address is public", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://aizyradar.cn";
    const channel = channelFor("https://discord.com/api/webhooks/1/token");

    const run = await sendDailyDigestToChannel({
      digestDate: "2026-10-20",
      channelId: channel.id
    });

    expect(run.status).toBe("success");
    expect(fixtures.send).toHaveBeenCalledTimes(1);
  });
});

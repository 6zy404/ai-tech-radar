import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const token = "123456789:AAH_test-token-0123456789abcdefghijk";
const secret = token.split(":")[1];
const discordToken = "discord-secret-token-XYZ";
const feishuToken = "feishu-hook-secret-123";

interface RecordedRequest {
  url: string;
  contentType: string;
  body: string;
}

describe("ops alert", () => {
  let dataDir: string;
  let projectRoot: string;
  let previousDataDir: string | undefined;
  let server: Server;
  let baseUrl: string;
  const requests: RecordedRequest[] = [];

  function readBody(request: IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => resolve(body));
    });
  }

  beforeEach(async () => {
    requests.length = 0;
    dataDir = mkdtempSync(path.join(tmpdir(), "ops-alert-data-"));
    projectRoot = mkdtempSync(path.join(tmpdir(), "ops-alert-root-"));
    previousDataDir = process.env.LOCAL_DATA_DIR;
    process.env.LOCAL_DATA_DIR = dataDir;
    vi.resetModules();

    server = createServer(async (request, response) => {
      const body = await readBody(request);

      requests.push({
        url: request.url ?? "",
        contentType: String(request.headers["content-type"] ?? ""),
        body
      });

      if (request.url?.startsWith("/fail")) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        response.end(`rejected ${token}`);
      } else if (request.url?.includes("/sendMessage")) {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: true, result: { message_id: 1 } }));
      } else if (request.url?.startsWith("/api/webhooks/")) {
        response.writeHead(204);
        response.end();
      } else {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ code: 0 }));
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));

    if (previousDataDir === undefined) {
      delete process.env.LOCAL_DATA_DIR;
    } else {
      process.env.LOCAL_DATA_DIR = previousDataDir;
    }

    rmSync(dataDir, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  });

  async function loadModules() {
    const workflow = await import("@/lib/delivery-workflow");
    const opsAlert = await import("@/lib/ops-alert");

    return { workflow, opsAlert };
  }

  const alert = {
    title: "【AI Tech Radar】隧道已重启，公网已恢复",
    body: "公网连续 2 次非 200（530），本机 200。已重启 ai-tech-radar-tunnel，30 秒后公网 200。",
    at: new Date("2026-10-20T02:19:33.000Z")
  };

  it("does nothing when no channel is configured", async () => {
    const { opsAlert } = await loadModules();
    const result = await opsAlert.sendOpsAlert(alert, { env: {}, projectRoot });

    expect(result.status).toBe("not_configured");
    expect(result.message).toContain("OPS_ALERT_CHANNEL_ID");
    expect(requests).toHaveLength(0);
  });

  it("reads the channel id from .env.local when the environment has none", async () => {
    const { opsAlert } = await loadModules();

    writeFileSync(
      path.join(projectRoot, ".env.local"),
      [
        "# comment",
        "LLM_API_KEY=not-this",
        'OPS_ALERT_CHANNEL_ID="delivery-channel-from-file"',
        ""
      ].join("\r\n")
    );

    expect(opsAlert.getOpsAlertChannelId({}, projectRoot)).toBe(
      "delivery-channel-from-file"
    );
    expect(
      opsAlert.getOpsAlertChannelId(
        { OPS_ALERT_CHANNEL_ID: " from-env " },
        projectRoot
      )
    ).toBe("from-env");
  });

  it("formats the time in Asia/Shanghai", async () => {
    const { opsAlert } = await loadModules();

    expect(opsAlert.formatOpsAlertTime(alert.at)).toBe(
      "2026-10-20 10:19:33 GMT+8"
    );
  });

  it("sends title, body and time through every channel type", async () => {
    const { workflow, opsAlert } = await loadModules();
    const channels = [
      workflow.createDeliveryChannel({
        name: "hook json",
        type: "webhook",
        enabled: true,
        endpointUrl: `${baseUrl}/hook?token=hook-secret`,
        format: "json"
      }),
      workflow.createDeliveryChannel({
        name: "hook text",
        type: "webhook",
        enabled: true,
        endpointUrl: `${baseUrl}/hook-text`,
        format: "text"
      }),
      workflow.createDeliveryChannel({
        name: "feishu",
        type: "feishu_webhook",
        enabled: true,
        endpointUrl: `${baseUrl}/open-apis/bot/v2/hook/${feishuToken}`,
        format: "text"
      }),
      workflow.createDeliveryChannel({
        name: "telegram",
        type: "telegram",
        enabled: true,
        endpointUrl: baseUrl,
        format: "text",
        botToken: token,
        chatId: "-1001234567890"
      }),
      workflow.createDeliveryChannel({
        name: "discord",
        type: "discord",
        enabled: true,
        endpointUrl: `${baseUrl}/api/webhooks/42/${discordToken}`,
        format: "text"
      })
    ];

    for (const channel of channels) {
      const result = await opsAlert.sendOpsAlert(alert, {
        env: { OPS_ALERT_CHANNEL_ID: channel.id },
        projectRoot
      });

      expect(result.status, channel.name).toBe("sent");
      expect(result.channelType).toBe(channel.type);
      expect(result.message).toContain(channel.name);
    }

    expect(requests).toHaveLength(5);

    const [hookJson, hookText, feishu, telegram, discord] = requests;
    const time = "2026-10-20 10:19:33 GMT+8";

    const json = JSON.parse(hookJson.body) as Record<string, string>;
    expect(hookJson.url).toBe("/hook?token=hook-secret");
    expect(hookJson.contentType).toContain("application/json");
    expect(json).toEqual({
      kind: "ops_alert",
      title: alert.title,
      body: alert.body,
      time
    });

    expect(hookText.contentType).toContain("text/plain");
    expect(hookText.body).toBe(
      `${alert.title}\n\n${alert.body}\n\n时间：${time}`
    );

    const feishuBody = JSON.parse(feishu.body) as {
      msg_type: string;
      content: { text: string };
    };
    expect(feishu.url).toBe(`/open-apis/bot/v2/hook/${feishuToken}`);
    expect(feishuBody.msg_type).toBe("text");
    expect(feishuBody.content.text).toBe(hookText.body);

    const telegramBody = JSON.parse(telegram.body) as Record<string, unknown>;
    expect(telegram.url).toBe(`/bot${token}/sendMessage`);
    expect(telegramBody.chat_id).toBe("-1001234567890");
    expect(telegramBody.parse_mode).toBe("HTML");
    expect(String(telegramBody.text)).toBe(
      `<b>${alert.title}</b>\n\n${alert.body}\n\n时间：${time}`
    );

    const discordBody = JSON.parse(discord.body) as {
      embeds: Array<{
        title: string;
        description: string;
        footer: { text: string };
      }>;
      allowed_mentions: { parse: string[] };
    };
    expect(discord.url).toBe(`/api/webhooks/42/${discordToken}`);
    expect(discordBody.embeds).toHaveLength(1);
    expect(discordBody.embeds[0].title).toBe(alert.title);
    expect(discordBody.embeds[0].description).toContain("公网连续 2 次非 200");
    expect(discordBody.embeds[0].footer.text).toBe(time);
    expect(discordBody.allowed_mentions.parse).toEqual([]);
  });

  it("escapes Telegram HTML and keeps the message within its limit", async () => {
    const { workflow, opsAlert } = await loadModules();
    const channel = workflow.createDeliveryChannel({
      name: "telegram",
      type: "telegram",
      enabled: true,
      endpointUrl: baseUrl,
      format: "text",
      botToken: token,
      chatId: "@ops_alerts"
    });
    const result = await opsAlert.sendOpsAlert(
      {
        title: "a < b & c",
        body: "<script>&".repeat(600),
        at: alert.at
      },
      { channelId: channel.id, env: {}, projectRoot }
    );

    expect(result.status).toBe("sent");

    const body = JSON.parse(requests[0].body) as { text: string };

    expect(body.text.startsWith("<b>a &lt; b &amp; c</b>")).toBe(true);
    expect(body.text).not.toContain("<script>");
    expect(body.text.length).toBeLessThanOrEqual(4096);
    expect(body.text.endsWith("时间：2026-10-20 10:19:33 GMT+8")).toBe(true);
  });

  it("masks secrets in the message and in what it reports back", async () => {
    const { workflow, opsAlert } = await loadModules();
    const channel = workflow.createDeliveryChannel({
      name: "hook",
      type: "webhook",
      enabled: true,
      endpointUrl: `${baseUrl}/hook`,
      format: "text"
    });
    const sent = await opsAlert.sendOpsAlert(
      {
        title: `token ${token} leaked`,
        body: `see https://discord.com/api/webhooks/42/${discordToken} and ?token=qp-secret`,
        at: alert.at
      },
      { channelId: channel.id, env: {}, projectRoot }
    );

    expect(sent.status).toBe("sent");
    expect(requests[0].body).not.toContain(secret);
    expect(requests[0].body).not.toContain(discordToken);
    expect(requests[0].body).not.toContain("qp-secret");
    expect(requests[0].body).toContain("123456789:***");
    expect(requests[0].body).toContain("/api/webhooks/42/***");

    const failing = workflow.createDeliveryChannel({
      name: "failing hook",
      type: "webhook",
      enabled: true,
      endpointUrl: `${baseUrl}/fail`,
      format: "text"
    });
    const failed = await opsAlert.sendOpsAlert(alert, {
      channelId: failing.id,
      env: {},
      projectRoot
    });

    expect(failed.status).toBe("failed");
    expect(failed.responseStatus).toBe(500);
    expect(failed.message).toContain("HTTP 500");
    expect(failed.message).not.toContain(secret);
    expect(failed.message).toContain("123456789:***");
  });

  it("reports a missing or disabled channel and a dry run without sending", async () => {
    const { workflow, opsAlert } = await loadModules();
    const disabled = workflow.createDeliveryChannel({
      name: "off",
      type: "webhook",
      enabled: false,
      endpointUrl: `${baseUrl}/hook`,
      format: "text"
    });

    expect(
      (
        await opsAlert.sendOpsAlert(alert, {
          channelId: "delivery-channel-missing",
          env: {},
          projectRoot
        })
      ).status
    ).toBe("channel_not_found");
    expect(
      (
        await opsAlert.sendOpsAlert(alert, {
          channelId: disabled.id,
          env: {},
          projectRoot
        })
      ).status
    ).toBe("channel_disabled");

    const enabled = workflow.createDeliveryChannel({
      name: "on",
      type: "webhook",
      enabled: true,
      endpointUrl: `${baseUrl}/hook`,
      format: "text"
    });
    const dryRun = await opsAlert.sendOpsAlert(alert, {
      channelId: enabled.id,
      dryRun: true,
      env: {},
      projectRoot
    });

    expect(dryRun.status).toBe("sent");
    expect(dryRun.message).toContain("dry-run");
    expect(requests).toHaveLength(0);
  });
});

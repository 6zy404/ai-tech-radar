import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DailyDigestWebhookTechnology } from "@/lib/delivery/digest-payload";
import type { DailyDigest } from "@/types/content";

import {
  buildDiscordDigestEmbed,
  countDiscordEmbedCharacters,
  discordAdapter,
  discordLimits,
  escapeDiscordMarkdown
} from "./discord";
import {
  ellipsis,
  fitBlocks,
  truncatePlainText,
  type DigestChatMessage
} from "./digest-message";
import {
  buildTelegramDigestHtml,
  escapeTelegramHtml,
  telegramAdapter,
  telegramMessageLimit
} from "./telegram";

const digestUrl = "https://aizyradar.cn/digest/2026-10-13";
const token = "123456789:AAH_test-token-0123456789abcdefghijk";

function makeItem(
  index: number,
  overrides: Partial<DailyDigestWebhookTechnology> = {}
): DailyDigestWebhookTechnology {
  return {
    title: `信号 ${index}`,
    summary: `摘要 ${index}`,
    url: `https://aizyradar.cn/technologies/signal-${index}`,
    priorityLevel: "high_priority",
    reason: `原因 ${index}`,
    sourceName: "来源",
    publishDate: "2026-10-13",
    tags: [],
    ...overrides
  };
}

function makeMessage(
  overrides: Partial<DigestChatMessage> = {}
): DigestChatMessage {
  return {
    title: "技术简报 - 2026-10-13",
    date: "2026-10-13",
    summary: "今天的重点是推理部署。",
    digestUrl,
    highPriorityItems: [makeItem(1), makeItem(2), makeItem(3)],
    watchItems: [makeItem(4), makeItem(5), makeItem(6)],
    ...overrides
  };
}

describe("fitBlocks", () => {
  it("keeps every block when they fit", () => {
    expect(fitBlocks(["a", "b"], "|tail", 100)).toBe("a\nb|tail");
  });

  it("drops whole blocks, marks the cut and always keeps the tail", () => {
    const result = fitBlocks(["aaaa", "bbbb", "cccc"], "|tail", 16);

    expect(result.endsWith("|tail")).toBe(true);
    expect(result).toContain(ellipsis);
    expect(result).not.toContain("cccc");
    expect(result.length).toBeLessThanOrEqual(16);
  });
});

describe("truncatePlainText", () => {
  it("ends a cut string in an ellipsis within the limit", () => {
    const result = truncatePlainText("一二三四五六七八九十", 5);

    expect(result).toBe(`一二三四${ellipsis}`);
  });

  it("never splits a surrogate pair", () => {
    const result = truncatePlainText("ab😀cdef", 4);

    expect(result).toBe(`ab${ellipsis}`);
  });
});

describe("telegram message", () => {
  it("escapes HTML in every piece of text", () => {
    expect(escapeTelegramHtml("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");

    const html = buildTelegramDigestHtml(
      makeMessage({
        title: "<script>&",
        highPriorityItems: [
          makeItem(1, { title: "A<B", url: 'https://x.test/"q' })
        ]
      })
    );

    expect(html).toContain("<b>&lt;script&gt;&amp;</b>");
    expect(html).toContain("A&lt;B");
    expect(html).toContain('href="https://x.test/&quot;q"');
    expect(html).not.toContain("<script>");
  });

  it("lists at most what it was given and ends with the digest link", () => {
    const html = buildTelegramDigestHtml(makeMessage());

    expect(html).toContain("今日立即关注");
    expect(html).toContain("值得跟踪");
    expect(html.trimEnd().endsWith(digestUrl)).toBe(true);
    expect(html).toContain(`<a href="${digestUrl}">阅读全文</a>`);
  });

  it("stays within 4096 and keeps the link when the content is long", () => {
    const long = "很长的说明".repeat(400);
    const html = buildTelegramDigestHtml(
      makeMessage({
        summary: long,
        highPriorityItems: [1, 2, 3].map((index) =>
          makeItem(index, { title: long, reason: long })
        ),
        watchItems: [4, 5, 6].map((index) =>
          makeItem(index, {
            title: long,
            reason: long,
            url: `https://aizyradar.cn/technologies/${"x".repeat(900)}-${index}`
          })
        )
      })
    );

    expect(html.length).toBeLessThanOrEqual(telegramMessageLimit);
    expect(html).toContain(ellipsis);
    expect(html.trimEnd().endsWith(digestUrl)).toBe(true);
  });

  it("requires a well-formed token and chat id", () => {
    const base = {
      type: "telegram" as const,
      endpointUrl: "",
      format: "text" as const
    };

    expect(
      telegramAdapter.validateChannelConfig({
        ...base,
        botToken: token,
        chatId: "-1001234567890"
      })
    ).toEqual([]);
    expect(
      telegramAdapter.validateChannelConfig({
        ...base,
        botToken: token,
        chatId: "@ai_radar"
      })
    ).toEqual([]);
    expect(
      telegramAdapter.validateChannelConfig({ ...base, chatId: "1" })
    ).toHaveLength(1);
    expect(
      telegramAdapter.validateChannelConfig({
        ...base,
        botToken: "nope",
        chatId: "x y"
      })
    ).toHaveLength(2);
  });
});

describe("discord embed", () => {
  it("escapes markdown so a title cannot break its link", () => {
    expect(escapeDiscordMarkdown("[a](b) *c*")).toBe("\\[a\\]\\(b\\) \\*c\\*");
  });

  it("links the title and the description to the digest", () => {
    const embed = buildDiscordDigestEmbed(makeMessage());

    expect(embed.url).toBe(digestUrl);
    expect(embed.description.endsWith(`[阅读全文](${digestUrl})`)).toBe(true);
    expect(embed.fields.map((field) => field.name)).toEqual([
      "今日立即关注",
      "值得跟踪"
    ]);
  });

  it("stays within every Discord limit when the content is long", () => {
    const long = "很长的说明".repeat(1500);
    const embed = buildDiscordDigestEmbed(
      makeMessage({
        title: long,
        summary: long,
        highPriorityItems: [1, 2, 3].map((index) =>
          makeItem(index, {
            reason: long,
            url: `https://aizyradar.cn/technologies/${"y".repeat(600)}-${index}`
          })
        ),
        watchItems: [4, 5, 6].map((index) => makeItem(index, { reason: long }))
      })
    );

    expect(embed.title.length).toBeLessThanOrEqual(discordLimits.title);
    expect(embed.description.length).toBeLessThanOrEqual(
      discordLimits.description
    );
    expect(embed.description.endsWith(`[阅读全文](${digestUrl})`)).toBe(true);

    for (const field of embed.fields) {
      expect(field.value.length).toBeLessThanOrEqual(discordLimits.fieldValue);
    }

    expect(countDiscordEmbedCharacters(embed)).toBeLessThanOrEqual(
      discordLimits.embedTotal
    );
  });

  it("accepts only webhook-shaped addresses", () => {
    const check = (endpointUrl: string) =>
      discordAdapter.validateChannelConfig({
        type: "discord",
        endpointUrl,
        format: "text"
      });

    expect(check("https://discord.com/api/webhooks/123/abc-DEF_9")).toEqual([]);
    expect(check("mock://success")).toEqual([]);
    expect(check("https://discord.com/channels/1/2")).toHaveLength(1);
    expect(check("ftp://discord.com/api/webhooks/1/2")).toHaveLength(1);
  });
});

describe("Telegram and Discord through the delivery workflow", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;
  let server: Server;
  let baseUrl: string;
  const requests: Array<{ url: string; body: string }> = [];

  function readBody(request: IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => resolve(body));
    });
  }

  beforeEach(async () => {
    requests.length = 0;
    dataDir = mkdtempSync(path.join(tmpdir(), "delivery-adapters-"));
    previousDataDir = process.env.LOCAL_DATA_DIR;
    process.env.LOCAL_DATA_DIR = dataDir;
    vi.resetModules();

    const digest: DailyDigest = {
      id: "digest-2026-10-13",
      date: "2026-10-13",
      status: "published",
      title: "技术简报 - 2026-10-13",
      summary: "公开摘要。",
      highPriorityTechnologyIds: [],
      watchTechnologyIds: [],
      manuallyAddedTechnologyIds: [],
      excludedTechnologyIds: [],
      pinnedTechnologyIds: [],
      orderedTechnologyIds: [],
      skillIds: [],
      knowledgeIds: [],
      sourceNames: [],
      generatedAt: "2026-10-13T00:00:00.000Z",
      updatedAt: "2026-10-13T00:00:00.000Z",
      publishedAt: "2026-10-13T00:00:00.000Z",
      editorialNotes: ["内部备注"]
    };

    writeFileSync(
      path.join(dataDir, "daily-digests.json"),
      JSON.stringify({ updatedAt: digest.updatedAt, digests: [digest] })
    );

    server = createServer(async (request, response) => {
      const body = await readBody(request);

      requests.push({ url: request.url ?? "", body });

      if (request.url?.includes("/sendMessage")) {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: true, result: { message_id: 1 } }));
      } else {
        response.writeHead(204);
        response.end();
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
  });

  it("sends to the fake Telegram API and keeps the token out of every record", async () => {
    const workflow = await import("@/lib/delivery-workflow");
    const channel = workflow.createDeliveryChannel({
      name: "TG",
      type: "telegram",
      enabled: true,
      endpointUrl: baseUrl,
      format: "text",
      botToken: token,
      chatId: "-1001234567890"
    });

    expect(channel).not.toHaveProperty("botToken");
    expect(channel.botTokenMasked).toBe("123456789:***");

    const run = await workflow.sendDailyDigestToChannel({
      digestDate: "2026-10-13",
      channelId: channel.id
    });

    expect(run.status).toBe("success");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(`/bot${token}/sendMessage`);

    const body = JSON.parse(requests[0].body) as Record<string, unknown>;

    expect(body.chat_id).toBe("-1001234567890");
    expect(body.parse_mode).toBe("HTML");
    expect(String(body.text)).toContain("技术简报 - 2026-10-13");
    expect(String(body.text)).not.toContain("内部备注");

    // Edited with the token left blank: the stored one survives.
    workflow.updateDeliveryChannel(channel.id, {
      name: "TG renamed",
      type: "telegram",
      enabled: true,
      endpointUrl: baseUrl,
      format: "text",
      chatId: "-1001234567890"
    });

    const secondRun = await workflow.sendDailyDigestToChannel({
      digestDate: "2026-10-13",
      channelId: channel.id
    });

    expect(secondRun.status).toBe("success");
    expect(requests[1].url).toBe(`/bot${token}/sendMessage`);

    const secret = token.split(":")[1];

    expect(JSON.stringify(workflow.getDeliveryRuns())).not.toContain(secret);
    expect(JSON.stringify(workflow.getDeliveryChannels())).not.toContain(
      secret
    );
    expect(
      readFileSync(path.join(dataDir, "workflow-events.json"), "utf8")
    ).not.toContain(secret);
    // The store itself holds it: that is where the adapter reads it from.
    expect(readFileSync(path.join(dataDir, "delivery.json"), "utf8")).toContain(
      secret
    );
  });

  it("refuses a new Telegram channel without a token", async () => {
    const workflow = await import("@/lib/delivery-workflow");

    expect(() =>
      workflow.createDeliveryChannel({
        name: "TG",
        type: "telegram",
        enabled: true,
        endpointUrl: "",
        format: "text",
        chatId: "-100"
      })
    ).toThrow(workflow.DeliveryChannelValidationError);
  });

  it("posts one embed to the fake Discord webhook", async () => {
    const workflow = await import("@/lib/delivery-workflow");
    const channel = workflow.createDeliveryChannel({
      name: "DC",
      type: "discord",
      enabled: true,
      endpointUrl: `${baseUrl}/api/webhooks/42/secret-webhook-token`,
      format: "json"
    });

    expect(channel.format).toBe("text");

    const run = await workflow.sendDailyDigestToChannel({
      digestDate: "2026-10-13",
      channelId: channel.id
    });

    expect(run.status).toBe("success");
    expect(run.responseStatus).toBe(204);

    const body = JSON.parse(requests[0].body) as {
      embeds: Array<{ title: string; url: string }>;
      allowed_mentions: { parse: string[] };
    };

    expect(body.embeds).toHaveLength(1);
    expect(body.embeds[0].url).toContain("/digest/2026-10-13");
    expect(body.allowed_mentions.parse).toEqual([]);
    expect(workflow.maskEndpointUrl(channel.endpointUrl)).not.toContain(
      "secret-webhook-token"
    );
  });
});

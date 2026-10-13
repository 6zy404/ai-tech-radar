import { describe, expect, it } from "vitest";

import {
  maskEndpointUrl,
  maskSecretsInText,
  maskTelegramBotToken
} from "@/lib/secret-masking";
import { sanitizeOperationsText } from "@/lib/operations-metrics";

const telegramToken = "123456789:AAH_test-token-0123456789abcdefghijk";

describe("maskEndpointUrl", () => {
  it("masks the token in a Feishu hook path, which used to show in full", () => {
    const masked = maskEndpointUrl(
      "https://open.feishu.cn/open-apis/bot/v2/hook/0a1b2c3d-feishu-secret"
    );

    expect(masked).toBe("https://open.feishu.cn/open-apis/bot/v2/hook/***");
  });

  it("masks a Discord webhook token and keeps the webhook id", () => {
    expect(
      maskEndpointUrl("https://discord.com/api/webhooks/1234567/abc.DEF_ghi-9")
    ).toBe("https://discord.com/api/webhooks/1234567/***");
  });

  it("masks a Telegram bot token in a path", () => {
    expect(
      maskEndpointUrl(`https://api.telegram.org/bot${telegramToken}/sendMessage`)
    ).toBe("https://api.telegram.org/bot123456789:***/sendMessage");
  });

  it("still masks query secrets and credentials", () => {
    const masked = maskEndpointUrl(
      "https://user:pass@example.com/hook?token=super-secret&x=1"
    );

    expect(masked).not.toContain("super-secret");
    expect(masked).not.toContain("pass@");
    expect(masked).toContain("x=1");
  });
});

describe("maskSecretsInText", () => {
  it("recognises a bare bot token inside a message", () => {
    expect(maskSecretsInText(`failed with ${telegramToken} today`)).toBe(
      "failed with 123456789:*** today"
    );
  });

  it("leaves ordinary text and times alone", () => {
    expect(maskSecretsInText("导入于 2026-10-13 08:05:02，新增 3 条")).toBe(
      "导入于 2026-10-13 08:05:02，新增 3 条"
    );
  });
});

describe("maskTelegramBotToken", () => {
  it("keeps only the bot id", () => {
    expect(maskTelegramBotToken(telegramToken)).toBe("123456789:***");
    expect(maskTelegramBotToken("no-colon")).toBe("***");
    expect(maskTelegramBotToken(undefined)).toBe("");
  });
});

describe("existing sanitizers", () => {
  it("operations text drops a bot token outside a URL", () => {
    expect(sanitizeOperationsText(`token ${telegramToken}`)).not.toContain(
      "AAH_test"
    );
  });
});

describe("workflow event snapshots", () => {
  it("redact a bot token under its key and inside free text", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { vi } = await import("vitest");
    const dataDir = mkdtempSync(path.join(tmpdir(), "secret-masking-"));
    const previous = process.env.LOCAL_DATA_DIR;

    process.env.LOCAL_DATA_DIR = dataDir;
    vi.resetModules();

    try {
      const { recordWorkflowEvent } = await import("@/lib/workflow-events");
      const event = recordWorkflowEvent({
        entityType: "delivery_channel",
        entityId: "channel-1",
        action: "delivery.failed",
        afterSnapshot: {
          botToken: telegramToken,
          endpointUrl: "https://discord.com/api/webhooks/1/discord-secret",
          note: `sent with ${telegramToken}`
        },
        metadata: { message: `bot${telegramToken}/sendMessage failed` }
      });
      const serialized = JSON.stringify(event);

      expect(serialized).not.toContain("AAH_test");
      expect(serialized).not.toContain("discord-secret");
      expect(
        (event.afterSnapshot as Record<string, unknown>).botToken
      ).toBe("[redacted]");
    } finally {
      if (previous === undefined) {
        delete process.env.LOCAL_DATA_DIR;
      } else {
        process.env.LOCAL_DATA_DIR = previous;
      }

      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

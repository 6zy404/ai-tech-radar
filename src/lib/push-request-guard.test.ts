import { afterEach, describe, expect, it } from "vitest";

import { publicAiBodyTooLargeMessage } from "@/lib/public-ai-rate-limit";
import {
  guardPushRequest,
  pushMaxBodyBytes,
  resetPushRateLimit
} from "@/lib/push-request-guard";

function makeRequest(
  headers: Record<string, string>,
  body: string = "{}"
): Request {
  return new Request("https://aizyradar.cn/api/push/subscribe", {
    method: "POST",
    headers: { "cf-connecting-ip": "203.0.113.7", ...headers },
    body
  });
}

const json = { "content-type": "application/json" };

afterEach(() => {
  resetPushRateLimit();
});

describe("guardPushRequest", () => {
  it("passes a same-site JSON request through with its parsed body", async () => {
    expect(
      await guardPushRequest(
        makeRequest(json, '{"topicIds":[]}'),
        "push-subscribe"
      )
    ).toEqual({ ok: true, body: { topicIds: [] } });
  });

  it("refuses cross-site requests before counting them, so another site cannot use up a reader's budget", async () => {
    // The budget is 20 a minute; 30 refused simple POSTs must not touch it.
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const refused = await guardPushRequest(
        makeRequest({ "content-type": "text/plain" }, "x"),
        "push-unsubscribe"
      );

      expect(refused.ok ? 200 : refused.response.status).toBe(415);
    }

    expect(
      (await guardPushRequest(makeRequest(json), "push-unsubscribe")).ok
    ).toBe(true);
  });

  it("refuses a body over the cap with 413", async () => {
    const outcome = await guardPushRequest(
      makeRequest(json, JSON.stringify({ pad: "x".repeat(pushMaxBodyBytes) })),
      "push-subscribe"
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(413);
      expect(await outcome.response.json()).toEqual({
        error: publicAiBodyTooLargeMessage
      });
    }
  });
});

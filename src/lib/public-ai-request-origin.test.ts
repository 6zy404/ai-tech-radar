import { afterEach, describe, expect, it } from "vitest";

import {
  checkPublicAiRequestOrigin,
  publicAiContentTypeMessage,
  publicAiCrossSiteMessage
} from "@/lib/public-ai-rate-limit";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("https://aizyradar.cn/api/ask", {
    method: "POST",
    headers,
    body: "{}"
  });
}

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
});

describe("checkPublicAiRequestOrigin", () => {
  it("accepts the site's own widgets: JSON body, same-origin fetch", () => {
    const decision = checkPublicAiRequestOrigin(
      makeRequest({
        "content-type": "application/json",
        host: "aizyradar.cn",
        origin: "https://aizyradar.cn",
        "sec-fetch-site": "same-origin"
      })
    );

    expect(decision).toEqual({ ok: true });
  });

  it("accepts a request with no Origin or Sec-Fetch-Site at all (curl, scripts)", () => {
    expect(
      checkPublicAiRequestOrigin(
        makeRequest({ "content-type": "application/json; charset=utf-8" })
      )
    ).toEqual({ ok: true });
  });

  it("rejects a simple text/plain POST, which a browser would send cross-origin without preflight", () => {
    const decision = checkPublicAiRequestOrigin(
      makeRequest({ "content-type": "text/plain" })
    );

    expect(decision).toEqual({
      ok: false,
      status: 415,
      message: publicAiContentTypeMessage
    });
    expect(checkPublicAiRequestOrigin(makeRequest({})).ok).toBe(false);
  });

  it("rejects a cross-site request by Sec-Fetch-Site", () => {
    expect(
      checkPublicAiRequestOrigin(
        makeRequest({
          "content-type": "application/json",
          "sec-fetch-site": "cross-site"
        })
      )
    ).toEqual({ ok: false, status: 403, message: publicAiCrossSiteMessage });
  });

  it("rejects a foreign Origin, and allows the configured site URL as well as the request host", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://aizyradar.cn";

    expect(
      checkPublicAiRequestOrigin(
        makeRequest({
          "content-type": "application/json",
          host: "localhost:3000",
          origin: "https://evil.example"
        })
      )
    ).toEqual({ ok: false, status: 403, message: publicAiCrossSiteMessage });

    expect(
      checkPublicAiRequestOrigin(
        makeRequest({
          "content-type": "application/json",
          host: "localhost:3000",
          origin: "https://aizyradar.cn"
        })
      )
    ).toEqual({ ok: true });

    expect(
      checkPublicAiRequestOrigin(
        makeRequest({
          "content-type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000"
        })
      )
    ).toEqual({ ok: true });
  });
});

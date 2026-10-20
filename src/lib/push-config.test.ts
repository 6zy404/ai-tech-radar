import { describe, expect, it } from "vitest";

import { isValidVapidSubject, readPushVapidConfig } from "@/lib/push-config";
import { generateVapidKeyPair } from "@/lib/push-crypto";

const keys = generateVapidKeyPair();

function env(extra: Record<string, string | undefined> = {}) {
  return {
    PUSH_VAPID_PUBLIC_KEY: keys.publicKey,
    PUSH_VAPID_PRIVATE_KEY: keys.privateKey,
    ...extra
  };
}

describe("isValidVapidSubject", () => {
  it("accepts mailto: and https: and nothing else (RFC 8292 §2.1)", () => {
    expect(isValidVapidSubject("mailto:ops@example.com")).toBe(true);
    expect(isValidVapidSubject("https://aizyradar.cn")).toBe(true);
    expect(isValidVapidSubject("http://localhost:3000")).toBe(false);
    expect(isValidVapidSubject("http://aizyradar.cn")).toBe(false);
    expect(isValidVapidSubject("")).toBe(false);
  });
});

describe("readPushVapidConfig", () => {
  it("is off without a matching pair", () => {
    expect(readPushVapidConfig({})).toBeNull();
    expect(
      readPushVapidConfig(env({ PUSH_VAPID_PRIVATE_KEY: undefined }))
    ).toBeNull();
  });

  it("keeps a valid subject", () => {
    expect(
      readPushVapidConfig(env({ PUSH_VAPID_SUBJECT: "mailto:ops@example.com" }))
        ?.subject
    ).toBe("mailto:ops@example.com");
  });

  it("falls back to the site address for a missing or invalid subject", () => {
    expect(
      readPushVapidConfig(
        env({
          PUSH_VAPID_SUBJECT: "ftp://nope",
          NEXT_PUBLIC_SITE_URL: "https://aizyradar.cn/"
        })
      )?.subject
    ).toBe("https://aizyradar.cn");
    expect(
      readPushVapidConfig(env({ NEXT_PUBLIC_SITE_URL: "https://aizyradar.cn" }))
        ?.subject
    ).toBe("https://aizyradar.cn");
  });

  it("reports the localhost fallback as it is, for the send path to refuse", () => {
    const config = readPushVapidConfig(
      env({ NEXT_PUBLIC_SITE_URL: undefined })
    );

    expect(config?.subject).toBe("http://localhost:3000");
    expect(isValidVapidSubject(config?.subject ?? "")).toBe(false);
  });
});

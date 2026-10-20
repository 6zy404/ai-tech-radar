import { describe, expect, it } from "vitest";

import {
  getPublicSiteUrlProblem,
  getSiteUrl,
  isLoopbackUrl
} from "@/lib/site-url";

describe("getSiteUrl", () => {
  it("falls back to localhost and strips trailing slashes", () => {
    expect(getSiteUrl(undefined)).toBe("http://localhost:3000");
    expect(getSiteUrl("")).toBe("http://localhost:3000");
    expect(getSiteUrl("   ")).toBe("http://localhost:3000");
    expect(getSiteUrl("https://aizyradar.cn/")).toBe("https://aizyradar.cn");
    expect(getSiteUrl("https://aizyradar.cn//")).toBe("https://aizyradar.cn");
  });
});

describe("isLoopbackUrl", () => {
  it("recognises the addresses only this machine can open", () => {
    for (const url of [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://127.1.2.3",
      "http://[::1]:3000",
      "http://0.0.0.0:3000",
      "http://app.localhost:3000",
      "not a url"
    ]) {
      expect(isLoopbackUrl(url), url).toBe(true);
    }
  });

  it("treats a public host as public", () => {
    for (const url of [
      "https://aizyradar.cn",
      "https://aizyradar.cn/digest/2026-10-20",
      "http://192.168.1.10:3000",
      "https://staging.example.com"
    ]) {
      expect(isLoopbackUrl(url), url).toBe(false);
    }
  });
});

describe("getPublicSiteUrlProblem", () => {
  it("is silent for a public address", () => {
    expect(getPublicSiteUrlProblem("https://aizyradar.cn")).toBeUndefined();
  });

  it("says the variable is unset when the fallback is in use", () => {
    expect(getPublicSiteUrlProblem(undefined)).toBe(
      "未设置 NEXT_PUBLIC_SITE_URL，站点地址回落为 http://localhost:3000，发出去的链接别人打不开。"
    );
  });

  it("says the variable points at this machine when it is set to one", () => {
    expect(getPublicSiteUrlProblem("http://127.0.0.1:3000/")).toBe(
      "站点地址 NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 指向本机，发出去的链接别人打不开。"
    );
  });
});

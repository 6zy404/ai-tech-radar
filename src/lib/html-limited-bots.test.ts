import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

/**
 * `htmlLimitedBots` in next.config.ts replaces Next's default list instead
 * of extending it, so a Next upgrade that adds a crawler to the default, or
 * an edit that drops one, would silently hand that crawler an empty <head>.
 * The configured list must keep every default entry and add the Chinese
 * crawlers the default lacks (seo-1, 2026-10-21).
 */
describe("htmlLimitedBots", () => {
  const configured = nextConfig.htmlLimitedBots;

  it("is configured as a case-insensitive pattern", () => {
    expect(configured).toBeInstanceOf(RegExp);
    expect(configured?.flags).toContain("i");
  });

  it("keeps every alternative of Next's default list", () => {
    const defaults = HTML_LIMITED_BOT_UA_RE.source.split("|");
    const ours = new Set(configured!.source.split("|"));

    expect(defaults.length).toBeGreaterThan(20);
    expect(defaults.filter((entry) => !ours.has(entry))).toEqual([]);
  });

  it.each([
    "Mozilla/5.0 (compatible; 360Spider)",
    "Mozilla/5.0 (compatible; HaosouSpider; http://www.haosou.com/help/help_3_2.html)",
    "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.81 YisouSpider/5.0 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 7.0;) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)",
    // Two from the default list, so the copy is known to still match them.
    "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"
  ])("gets a blocking render for %s", (userAgent) => {
    expect(configured!.test(userAgent)).toBe(true);
  });

  it("leaves ordinary browsers and Google's JS-capable crawler streaming", () => {
    for (const userAgent of [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    ]) {
      expect(configured!.test(userAgent)).toBe(false);
    }
  });
});

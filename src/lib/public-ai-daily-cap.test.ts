import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUBLIC_AI_DAILY_LIMIT_DEFAULT,
  checkPublicAiDailyCap,
  getPublicAiDailyLimit,
  getPublicAiDailyUsage,
  getPublicAiUsageDay,
  getSecondsUntilNextDay,
  publicAiUsageFileName,
  readPublicAiUsage,
  recordPublicAiCall
} from "@/lib/public-ai-daily-cap";
import {
  guardPublicAiRequest,
  publicAiCrossSiteMessage,
  publicAiRateLimitMessage,
  resetPublicAiRateLimit
} from "@/lib/public-ai-rate-limit";

// The site-wide daily cap on the four public AI routes: one count per
// Asia/Shanghai day in config/public-ai-usage.json, shared by every route,
// checked in the guard after the per-client limiter and before the body.

let dataDir: string;
let previousDataDir: string | undefined;

// 10:00 in Asia/Shanghai on 2026-10-20 — fourteen hours before midnight.
const tenInTheMorning = new Date("2026-10-20T02:00:00.000Z");
const nextDay = new Date("2026-10-21T02:00:00.000Z");

function usageFile(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(dataDir, publicAiUsageFileName), "utf8")
  ) as Record<string, unknown>;
}

beforeEach(() => {
  previousDataDir = process.env.LOCAL_DATA_DIR;
  dataDir = mkdtempSync(path.join(tmpdir(), "public-ai-daily-cap-"));
  process.env.LOCAL_DATA_DIR = dataDir;
  vi.stubEnv("PUBLIC_AI_DAILY_LIMIT", "");
  resetPublicAiRateLimit();
});

afterEach(() => {
  vi.unstubAllEnvs();
  if (previousDataDir === undefined) {
    delete process.env.LOCAL_DATA_DIR;
  } else {
    process.env.LOCAL_DATA_DIR = previousDataDir;
  }
  rmSync(dataDir, { recursive: true, force: true });
  resetPublicAiRateLimit();
});

describe("the Asia/Shanghai day", () => {
  it("turns over at 16:00 UTC, not at UTC midnight", () => {
    expect(getPublicAiUsageDay(new Date("2026-10-20T15:59:59.000Z"))).toBe(
      "2026-10-20"
    );
    expect(getPublicAiUsageDay(new Date("2026-10-20T16:00:00.000Z"))).toBe(
      "2026-10-21"
    );
  });

  it("counts the seconds to the next 00:00 Asia/Shanghai", () => {
    expect(getSecondsUntilNextDay(tenInTheMorning)).toBe(14 * 3600);
    expect(getSecondsUntilNextDay(new Date("2026-10-20T15:59:59.000Z"))).toBe(
      1
    );
    // Half a second before midnight still says 1, never 0.
    expect(getSecondsUntilNextDay(new Date("2026-10-20T15:59:59.500Z"))).toBe(
      1
    );
    expect(getSecondsUntilNextDay(new Date("2026-10-20T16:00:00.000Z"))).toBe(
      24 * 3600
    );
  });
});

describe("the daily limit", () => {
  it("defaults to the constant and is overridden by PUBLIC_AI_DAILY_LIMIT", () => {
    expect(getPublicAiDailyLimit()).toBe(PUBLIC_AI_DAILY_LIMIT_DEFAULT);
    expect(PUBLIC_AI_DAILY_LIMIT_DEFAULT).toBe(500);

    vi.stubEnv("PUBLIC_AI_DAILY_LIMIT", "3");
    expect(getPublicAiDailyLimit()).toBe(3);

    vi.stubEnv("PUBLIC_AI_DAILY_LIMIT", "3.7");
    expect(getPublicAiDailyLimit()).toBe(3);
  });

  it("falls back to the default for anything that is not a positive number", () => {
    for (const value of ["0", "-5", "abc", " "]) {
      vi.stubEnv("PUBLIC_AI_DAILY_LIMIT", value);
      expect(getPublicAiDailyLimit()).toBe(PUBLIC_AI_DAILY_LIMIT_DEFAULT);
    }
  });
});

describe("counting", () => {
  it("accumulates within one day, per route and in total, in the data directory", () => {
    recordPublicAiCall("ask", tenInTheMorning);
    recordPublicAiCall("compare", new Date(tenInTheMorning.getTime() + 60_000));
    recordPublicAiCall("ask", new Date(tenInTheMorning.getTime() + 120_000));

    expect(readPublicAiUsage(tenInTheMorning)).toMatchObject({
      day: "2026-10-20",
      total: 3,
      byRoute: { ask: 2, compare: 1 }
    });
    expect(usageFile()).toMatchObject({
      day: "2026-10-20",
      total: 3,
      byRoute: { ask: 2, compare: 1 },
      updatedAt: "2026-10-20T02:02:00.000Z"
    });
  });

  it("survives a process restart, because the count is the file", async () => {
    recordPublicAiCall("explain", tenInTheMorning);
    recordPublicAiCall("learning-path", tenInTheMorning);

    vi.resetModules();
    const fresh = await import("@/lib/public-ai-daily-cap");

    expect(fresh.readPublicAiUsage(tenInTheMorning).total).toBe(2);
    expect(fresh.checkPublicAiDailyCap(tenInTheMorning)).toEqual({
      allowed: true,
      used: 2,
      limit: PUBLIC_AI_DAILY_LIMIT_DEFAULT
    });
  });

  it("starts over on the next Asia/Shanghai day without a write", () => {
    recordPublicAiCall("ask", tenInTheMorning);
    recordPublicAiCall("ask", tenInTheMorning);

    expect(readPublicAiUsage(nextDay)).toMatchObject({
      day: "2026-10-21",
      total: 0,
      byRoute: {}
    });
    // Reading the new day did not touch the file ...
    expect(usageFile()).toMatchObject({ day: "2026-10-20", total: 2 });

    // ... the next counted call replaces it.
    recordPublicAiCall("compare", nextDay);
    expect(usageFile()).toMatchObject({
      day: "2026-10-21",
      total: 1,
      byRoute: { compare: 1 }
    });
  });

  it("reads a damaged counter file as empty instead of failing every request", () => {
    writeFileSync(path.join(dataDir, publicAiUsageFileName), "{not json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(readPublicAiUsage(tenInTheMorning).total).toBe(0);
    expect(recordPublicAiCall("ask", tenInTheMorning).total).toBe(1);
    expect(usageFile()).toMatchObject({ day: "2026-10-20", total: 1 });
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});

describe("checkPublicAiDailyCap", () => {
  it("allows up to the limit and refuses the next call until midnight", () => {
    vi.stubEnv("PUBLIC_AI_DAILY_LIMIT", "2");

    expect(checkPublicAiDailyCap(tenInTheMorning)).toEqual({
      allowed: true,
      used: 0,
      limit: 2
    });

    recordPublicAiCall("ask", tenInTheMorning);
    expect(checkPublicAiDailyCap(tenInTheMorning)).toEqual({
      allowed: true,
      used: 1,
      limit: 2
    });

    recordPublicAiCall("compare", tenInTheMorning);
    expect(checkPublicAiDailyCap(tenInTheMorning)).toEqual({
      allowed: false,
      used: 2,
      limit: 2,
      retryAfterSeconds: 14 * 3600
    });

    // The next day the same file no longer counts.
    expect(checkPublicAiDailyCap(nextDay).allowed).toBe(true);
  });

  it("summarizes today's usage for the dashboard with the limit and ratio", () => {
    vi.stubEnv("PUBLIC_AI_DAILY_LIMIT", "4");
    recordPublicAiCall("ask", tenInTheMorning);

    expect(getPublicAiDailyUsage(tenInTheMorning)).toMatchObject({
      day: "2026-10-20",
      total: 1,
      limit: 4,
      ratio: 0.25,
      byRoute: { ask: 1 }
    });
  });
});

function jsonRequest(
  headers: Record<string, string> = {},
  body: unknown = { question: "什么是 KV 缓存？" }
): Request {
  return new Request("http://127.0.0.1:3000/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
}

describe("guardPublicAiRequest with the daily cap", () => {
  it("answers 429 with Retry-After to the next midnight once the cap is spent", async () => {
    vi.stubEnv("PUBLIC_AI_DAILY_LIMIT", "1");
    recordPublicAiCall("compare");

    const before = getSecondsUntilNextDay();
    const outcome = await guardPublicAiRequest(jsonRequest(), "ask");
    const after = getSecondsUntilNextDay();

    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }

    expect(outcome.response.status).toBe(429);
    expect(await outcome.response.json()).toEqual({
      error: publicAiRateLimitMessage
    });

    const retryAfter = Number(outcome.response.headers.get("Retry-After"));

    expect(retryAfter).toBeGreaterThanOrEqual(after);
    expect(retryAfter).toBeLessThanOrEqual(before);
  });

  it("lets a request through, body and all, while the cap has room", async () => {
    vi.stubEnv("PUBLIC_AI_DAILY_LIMIT", "2");
    recordPublicAiCall("ask");

    const outcome = await guardPublicAiRequest(jsonRequest(), "ask");

    expect(outcome).toEqual({
      ok: true,
      body: { question: "什么是 KV 缓存？" }
    });
    // The guard only reads the count; the route counts when it calls the model.
    expect(readPublicAiUsage().total).toBe(1);
  });

  it("checks the request's origin and the per-client limit before the cap", async () => {
    vi.stubEnv("PUBLIC_AI_DAILY_LIMIT", "1");
    vi.stubEnv("PUBLIC_AI_RATE_LIMIT_PER_MINUTE", "1");
    recordPublicAiCall("ask");

    // A cross-site call is refused for being cross-site, not for the cap.
    const crossSite = await guardPublicAiRequest(
      jsonRequest({ origin: "https://other.example" }),
      "ask"
    );

    expect(crossSite.ok).toBe(false);
    if (!crossSite.ok) {
      expect(crossSite.response.status).toBe(403);
      expect(await crossSite.response.json()).toEqual({
        error: publicAiCrossSiteMessage
      });
    }

    // One address past its own minute bucket gets the bucket's Retry-After
    // (seconds, not hours): the cap is checked after the per-client limit.
    const headers = { "cf-connecting-ip": "203.0.113.9" };
    const first = await guardPublicAiRequest(jsonRequest(headers), "ask");
    const second = await guardPublicAiRequest(jsonRequest(headers), "ask");

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    if (!first.ok && !second.ok) {
      // The first request is already over the daily cap ...
      expect(Number(first.response.headers.get("Retry-After"))).toBeGreaterThan(
        60
      );
      // ... the second is stopped by its own bucket first.
      expect(second.response.status).toBe(429);
      expect(
        Number(second.response.headers.get("Retry-After"))
      ).toBeLessThanOrEqual(60);
    }
  });
});

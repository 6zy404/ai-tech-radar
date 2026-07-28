import { describe, expect, it } from "vitest";

import {
  fetchWithRetry,
  isRetryableStatus,
  resolveImportFetchSettings,
  type ImportFetchSettings
} from "./external-import";

const fastSettings: ImportFetchSettings = {
  attempts: 3,
  timeoutMs: 1000,
  retryDelayMs: 0
};

function jsonResponse(status: number): Response {
  return new Response("{}", { status });
}

describe("isRetryableStatus", () => {
  it("retries the statuses that mean 'come back later'", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it("does not retry a configuration problem", () => {
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(410)).toBe(false);
  });
});

describe("resolveImportFetchSettings", () => {
  it("falls back to the defaults when nothing is configured", () => {
    expect(resolveImportFetchSettings({})).toEqual({
      attempts: 3,
      timeoutMs: 20000,
      retryDelayMs: 800
    });
  });

  it("reads overrides from the environment", () => {
    expect(
      resolveImportFetchSettings({
        IMPORT_FETCH_ATTEMPTS: "2",
        IMPORT_FETCH_TIMEOUT_MS: "5000",
        IMPORT_FETCH_RETRY_DELAY_MS: "100"
      })
    ).toEqual({ attempts: 2, timeoutMs: 5000, retryDelayMs: 100 });
  });

  it("ignores junk and clamps unattended runs to a sane ceiling", () => {
    const settings = resolveImportFetchSettings({
      IMPORT_FETCH_ATTEMPTS: "999",
      IMPORT_FETCH_TIMEOUT_MS: "not-a-number",
      IMPORT_FETCH_RETRY_DELAY_MS: "-5"
    });

    expect(settings).toEqual({
      attempts: 5,
      timeoutMs: 20000,
      retryDelayMs: 800
    });
  });
});

describe("fetchWithRetry", () => {
  it("returns the first successful response without retrying", async () => {
    let calls = 0;
    const response = await fetchWithRetry("https://example.test/feed", {
      settings: fastSettings,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(200);
      }
    });

    expect(response.status).toBe(200);
    expect(calls).toBe(1);
  });

  it("recovers from a transient transport failure — the 2026-07-28 case", async () => {
    let calls = 0;
    const response = await fetchWithRetry("https://example.test/feed", {
      settings: fastSettings,
      fetchImpl: async () => {
        calls += 1;

        if (calls === 1) {
          throw new TypeError("fetch failed");
        }

        return jsonResponse(200);
      }
    });

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });

  it("retries a 503 and gives up after the configured attempts", async () => {
    let calls = 0;

    await expect(
      fetchWithRetry("https://example.test/feed", {
        settings: fastSettings,
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse(503);
        }
      })
    ).rejects.toThrow("重试 3 次后仍失败");

    expect(calls).toBe(3);
  });

  it("does not retry a 404, so a removed feed surfaces immediately", async () => {
    let calls = 0;

    await expect(
      fetchWithRetry("https://example.test/feed", {
        settings: fastSettings,
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse(404);
        }
      })
    ).rejects.toThrow("HTTP 404");

    expect(calls).toBe(1);
  });

  it("keeps the underlying reason in the exhausted-retry message", async () => {
    await expect(
      fetchWithRetry("https://example.test/feed", {
        settings: { ...fastSettings, attempts: 2 },
        fetchImpl: async () => {
          throw new Error("terminated");
        }
      })
    ).rejects.toThrow("terminated");
  });
});

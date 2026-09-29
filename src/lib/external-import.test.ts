import { afterEach, describe, expect, it, vi } from "vitest";

import { evaluateCandidateQuality } from "@/lib/quality-signals";
import type { ExternalSource } from "@/types/content";

import {
  fetchWithRetry,
  importCandidatesForExternalSource,
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

  /**
   * The test above passed the whole time the log was useless: Node's `fetch`
   * reports every transport failure as the bare string `fetch failed` and puts
   * the reason in `cause`. Eight scheduled-run failures on 08-17 and 08-18 all
   * recorded exactly `fetch failed` and nothing else.
   */
  it("unwraps the cause chain a bare fetch failure hides", async () => {
    const cause = Object.assign(new Error("read ECONNRESET"), {
      code: "ECONNRESET"
    });

    await expect(
      fetchWithRetry("https://example.test/feed", {
        settings: { ...fastSettings, attempts: 2 },
        fetchImpl: async () => {
          throw new Error("fetch failed", { cause });
        }
      })
    ).rejects.toThrow("fetch failed ← read ECONNRESET");
  });

  it("appends a code the message does not already carry", async () => {
    const cause = Object.assign(new Error("other side closed"), {
      code: "UND_ERR_SOCKET"
    });

    await expect(
      fetchWithRetry("https://example.test/feed", {
        settings: { ...fastSettings, attempts: 1 },
        fetchImpl: async () => {
          throw new Error("fetch failed", { cause });
        }
      })
    ).rejects.toThrow("fetch failed ← other side closed (UND_ERR_SOCKET)");
  });

  it("does not repeat a code already present in the message", async () => {
    await expect(
      fetchWithRetry("https://example.test/feed", {
        settings: { ...fastSettings, attempts: 1 },
        fetchImpl: async () => {
          throw Object.assign(new Error("connect ETIMEDOUT 1.2.3.4:443"), {
            code: "ETIMEDOUT"
          });
        }
      })
    ).rejects.toThrow("：connect ETIMEDOUT 1.2.3.4:443");
  });

  it("survives a cause cycle", async () => {
    const outer: Error & { cause?: unknown } = new Error("outer");
    const inner: Error & { cause?: unknown } = new Error("inner");
    outer.cause = inner;
    inner.cause = outer;

    await expect(
      fetchWithRetry("https://example.test/feed", {
        settings: { ...fastSettings, attempts: 1 },
        fetchImpl: async () => {
          throw outer;
        }
      })
    ).rejects.toThrow("outer ← inner");
  });
});

function makeSource(overrides: Partial<ExternalSource>): ExternalSource {
  return {
    id: "source-test",
    name: "Test Feed",
    type: "rss",
    url: "https://feeds.example.com/rss",
    enabled: true,
    language: "en",
    publisherType: "media",
    defaultTags: [],
    defaultNormalizedType: "unknown",
    lastImportStatus: "never_run",
    createdAt: "2026-09-29T00:00:00.000Z",
    updatedAt: "2026-09-29T00:00:00.000Z",
    ...overrides
  };
}

function stubFeed(xml: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(xml, { status: 200 }))
  );
}

describe("feed text and links — the 2026-09-29 escaped-HTML case", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cleans an RSS description the feed escaped, and decodes its link", async () => {
    const link =
      "https://www.infoq.cn/article/abc?utm_source=rss&amp;utm_medium=article";

    stubFeed(`<?xml version="1.0"?><rss><channel><title>InfoQ</title>
      <item>
        <title>AI 数据平台，要补的恰恰是“模型不知道的事”</title>
        <link>${link}</link>
        <guid>${link}</guid>
        <description>&lt;p&gt;Keynote at the &lt;a href=&quot;https://x.dev&quot;&gt;Congress&lt;/a&gt; &amp;mdash; notes&lt;/p&gt;&lt;div align=&#39;right&#39;&gt;&lt;a href=&#39;${link}&#39;&gt;点击查看原文&gt;&lt;/a&gt;&lt;/div&gt;</description>
        <pubDate>Tue, 29 Sep 2026 11:24:14 GMT</pubDate>
      </item>
    </channel></rss>`);

    const [candidate] = await importCandidatesForExternalSource(makeSource({}));

    expect(candidate.originalTitle).toBe(
      "AI 数据平台，要补的恰恰是“模型不知道的事”"
    );
    expect(candidate.originalSummary).toBe("Keynote at the Congress — notes");
    expect(candidate.originalContent).toBe("Keynote at the Congress — notes");
    expect(candidate.sourceUrl).toBe(
      "https://www.infoq.cn/article/abc?utm_source=rss&utm_medium=article"
    );
    // The id is still seeded from the link as written, so candidates already
    // in the pool keep their id — and their review state — on the next import.
    expect(candidate.id).toBe(
      "candidate-rss-https-www-infoq-cn-article-abc-utm-source-rss-amp-utm-medium-article"
    );
  });

  it("imports a link-only InfoQ description as no summary, so the quality check says so", async () => {
    const link =
      "https://www.infoq.cn/article/xyz?utm_source=rss&amp;utm_medium=article";

    stubFeed(`<?xml version="1.0"?><rss><channel><title>InfoQ</title>
      <item>
        <title>微软正式发布 Agent Framework Harness</title>
        <link>${link}</link>
        <description>&lt;div align=&#39;right&#39;&gt;&lt;a href=&#39;${link}&#39;&gt;点击查看原文&gt;&lt;/a&gt;&lt;/div&gt;</description>
        <pubDate>Tue, 29 Sep 2026 11:24:14 GMT</pubDate>
      </item>
    </channel></rss>`);

    const [candidate] = await importCandidatesForExternalSource(makeSource({}));

    expect(candidate.originalSummary).toBe("");
    expect(candidate.originalContent).toBe("");
    expect(evaluateCandidateQuality(candidate).flags).toEqual(
      expect.arrayContaining(["missing_summary", "missing_content"])
    );
  });

  it("drops GitHub Blog's WordPress footer and keeps the summary before it", async () => {
    stubFeed(`<?xml version="1.0"?><rss><channel><title>The GitHub Blog</title>
      <item>
        <title>When chat is the wrong UI</title>
        <link>https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/</link>
        <description>&lt;p&gt;Enter canvases.&lt;/p&gt;
&lt;p&gt;The post &lt;a href=&quot;https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/&quot;&gt;When chat is the wrong UI&lt;/a&gt; appeared first on &lt;a href=&quot;https://github.blog&quot;&gt;The GitHub Blog&lt;/a&gt;.&lt;/p&gt;</description>
        <pubDate>Tue, 29 Sep 2026 16:00:00 GMT</pubDate>
      </item>
    </channel></rss>`);

    const [candidate] = await importCandidatesForExternalSource(makeSource({}));

    expect(candidate.originalSummary).toBe("Enter canvases.");
    expect(evaluateCandidateQuality(candidate).flags).not.toContain(
      "missing_summary"
    );
  });

  it("imports a release whose notes are 'No content.' as no summary", async () => {
    stubFeed(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <title>Release notes from ms-swift</title>
      <entry>
        <title>v4.1.3</title>
        <link rel="alternate" href="https://github.com/modelscope/ms-swift/releases/tag/v4.1.3"/>
        <updated>2026-09-29T01:54:15Z</updated>
        <content type="html">No content.</content>
      </entry>
    </feed>`);

    const [candidate] = await importCandidatesForExternalSource(
      makeSource({ type: "atom" })
    );

    expect(candidate.originalSummary).toBe("");
    expect(evaluateCandidateQuality(candidate).flags).toContain(
      "missing_summary"
    );
  });

  it("cleans an Atom entry's escaped HTML content, keeping the id stable", async () => {
    stubFeed(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <title>Release notes</title>
      <entry>
        <title>v0.35.0</title>
        <link rel="alternate" href="https://github.com/o/r/releases/tag/v0.35.0?a=1&amp;b=2"/>
        <updated>2026-09-29T01:54:15Z</updated>
        <content type="html">&lt;h2&gt;Decision models&lt;/h2&gt;
&lt;p&gt;Supports &lt;code&gt;/v1/systemone&lt;/code&gt;, via TypeSafe&amp;rsquo;s API.&lt;/p&gt;</content>
      </entry>
    </feed>`);

    const [candidate] = await importCandidatesForExternalSource(
      makeSource({ type: "atom" })
    );

    expect(candidate.originalSummary).toBe(
      "Decision models Supports /v1/systemone, via TypeSafe’s API."
    );
    expect(candidate.sourceUrl).toBe(
      "https://github.com/o/r/releases/tag/v0.35.0?a=1&b=2"
    );
    expect(candidate.id).toBe(
      "candidate-rss-https-github-com-o-r-releases-tag-v0-35-0-a-1-amp-b-2"
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  extractArticleText,
  fetchArticleExcerpt
} from "@/lib/candidate-article";

describe("extractArticleText", () => {
  it("prefers <article> and drops scripts, nav and footer", () => {
    const html = `<html><head><title>t</title><script>var x = 1;</script></head>
      <body><nav>Home · Blog</nav><header>Site</header>
      <article><h1>Release 2.0</h1><p>Adds &quot;streaming&quot; &amp; tools.</p>
      <script>track()</script></article><footer>© 2026</footer></body></html>`;

    expect(extractArticleText(html)).toBe(
      'Release 2.0 Adds "streaming" & tools.'
    );
  });

  it("falls back to <main>, then <body>", () => {
    expect(
      extractArticleText(
        "<body><div>Menu</div><main><p>Body text</p></main></body>"
      )
    ).toBe("Body text");
    expect(extractArticleText("<body><p>Only body</p></body>")).toBe(
      "Only body"
    );
  });

  it("decodes numeric entities and caps the length", () => {
    expect(extractArticleText("<p>&#20013;&#x6587;</p>")).toBe("中文");
    expect(extractArticleText(`<p>${"a".repeat(50)}</p>`, 10)).toBe(
      "aaaaaaaaaa…"
    );
  });
});

describe("fetchArticleExcerpt", () => {
  const respond = (body: string, init: ResponseInit = {}) =>
    (async () =>
      new Response(body, {
        headers: { "content-type": "text/html; charset=utf-8" },
        ...init
      })) as unknown as typeof fetch;

  it("returns the excerpt of a real article", async () => {
    const result = await fetchArticleExcerpt("https://example.com/a", {
      fetchImpl: respond(`<article><p>${"正文".repeat(60)}</p></article>`)
    });

    expect(result.ok).toBe(true);
  });

  it("reports a refused request and a shell page as no excerpt", async () => {
    expect(
      await fetchArticleExcerpt("https://example.com/a", {
        fetchImpl: respond("forbidden", { status: 403 })
      })
    ).toEqual({ ok: false, error: "HTTP 403" });
    expect(
      await fetchArticleExcerpt("https://example.com/a", {
        fetchImpl: respond('<body><div id="root"></div></body>')
      })
    ).toEqual({ ok: false, error: "页面没有可读正文" });
  });
});

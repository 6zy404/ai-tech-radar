import { describe, expect, it } from "vitest";

import {
  cleanFeedText,
  cleanUrl,
  decodeHtmlEntities,
  htmlToPlainText
} from "./text-sanitize";

describe("decodeHtmlEntities", () => {
  it("decodes named, decimal and hex references", () => {
    expect(decodeHtmlEntities("Let&rsquo;s &amp; &quot;go&quot;")).toBe(
      'Let’s & "go"'
    );
    expect(decodeHtmlEntities("&#39;a&#39; &#x27;b&#x27; &#x1F600;")).toBe(
      "'a' 'b' 😀"
    );
  });

  it("peels exactly one layer", () => {
    expect(decodeHtmlEntities("&amp;lt;p&amp;gt;")).toBe("&lt;p&gt;");
  });

  it("leaves unknown names and impossible code points alone", () => {
    expect(decodeHtmlEntities("&notareal; &#0; &#xD800; &#1114112;")).toBe(
      "&notareal; &#0; &#xD800; &#1114112;"
    );
  });
});

describe("htmlToPlainText", () => {
  it("strips tags and collapses whitespace", () => {
    expect(htmlToPlainText("<p>Hello\n  <b>world</b></p>")).toBe("Hello world");
  });

  it("strips nested tags and drops script, style and comments whole", () => {
    expect(
      htmlToPlainText(
        '<div><ul><li><a href="x"><em>one</em></a></li><li>two</li></ul><script>alert(1)</script><style>p{}</style><!-- note --></div>'
      )
    ).toBe("one two");
  });

  it("strips HTML the feed escaped — the 2026-09-29 Simon Willison case", () => {
    expect(
      htmlToPlainText(
        "&lt;p&gt;On Friday I gave the keynote at the &lt;a href=&quot;https://example.com/?a=1&amp;amp;b=2&quot;&gt;World Congress&lt;/a&gt;.&lt;/p&gt;"
      )
    ).toBe("On Friday I gave the keynote at the World Congress.");
  });

  it("decodes entities inside escaped HTML to their characters", () => {
    expect(
      htmlToPlainText("&lt;p&gt;That&amp;rsquo;s it &amp;#8212; done&lt;/p&gt;")
    ).toBe("That’s it — done");
  });

  it("drops a tag that truncation cut off, keeping the ellipsis", () => {
    expect(
      htmlToPlainText(
        '<p>Yesterday was <a href="x">Grok 4.7</a> (<a href="https://news.ycombinator.com/i…'
      )
    ).toBe("Yesterday was Grok 4.7 (…");
    expect(htmlToPlainText("See &lt;a href=&quot;https://a.dev/lo")).toBe(
      "See"
    );
  });

  it("keeps angle brackets that are not HTML elements", () => {
    expect(htmlToPlainText("if a < b and b > c")).toBe("if a < b and b > c");
    expect(htmlToPlainText("emits a &lt;think&gt; block")).toBe(
      "emits a <think> block"
    );
  });

  it("returns clean text unchanged", () => {
    const clean = "Qwen3.8 adds 128K context; see https://x.dev/a?b=1&c=2.";

    expect(htmlToPlainText(clean)).toBe(clean);
  });

  it("leaves Chinese text alone", () => {
    expect(
      htmlToPlainText("<p>阿里开源代码评审工具，支持「多语言」。</p>")
    ).toBe("阿里开源代码评审工具，支持「多语言」。");
    expect(htmlToPlainText("数据平台要补的是“模型不知道的事”")).toBe(
      "数据平台要补的是“模型不知道的事”"
    );
  });

  it("treats a missing value as empty", () => {
    expect(htmlToPlainText(undefined)).toBe("");
    expect(htmlToPlainText("")).toBe("");
  });
});

describe("cleanFeedText", () => {
  it("reduces InfoQ's link-only description to nothing", () => {
    expect(
      cleanFeedText(
        "&lt;div align=&#39;right&#39;&gt;&lt;a href=&#39;https://www.infoq.cn/article/x?utm_source=rss&amp;utm_medium=article&#39;&gt;点击查看原文&gt;&lt;/a&gt;&lt;/div&gt;"
      )
    ).toBe("");
  });

  it("removes the boilerplate but keeps the text around it", () => {
    expect(
      cleanFeedText("<p>正文第一句。</p><a href='x'>点击查看原文></a>")
    ).toBe("正文第一句。");
  });
});

describe("cleanUrl", () => {
  it("decodes &amp; in a query string — the InfoQ sourceUrl case", () => {
    expect(
      cleanUrl(
        "https://www.infoq.cn/article/gk4rWsQg09PWTFTZlJE3?utm_source=rss&amp;utm_medium=article"
      )
    ).toBe(
      "https://www.infoq.cn/article/gk4rWsQg09PWTFTZlJE3?utm_source=rss&utm_medium=article"
    );
  });

  it("unwraps a double-escaped ampersand", () => {
    expect(cleanUrl("https://a.dev/?x=1&amp;amp;y=2")).toBe(
      "https://a.dev/?x=1&y=2"
    );
  });

  it("returns a clean URL byte for byte, only trimmed", () => {
    expect(cleanUrl("  https://a.dev/Path?q=%20x&y=2#Frag ")).toBe(
      "https://a.dev/Path?q=%20x&y=2#Frag"
    );
  });

  it("keeps the input when decoding would not leave an http(s) URL", () => {
    expect(cleanUrl("javascript&#58;alert(1)")).toBe("javascript&#58;alert(1)");
    expect(cleanUrl("not a url &amp; more")).toBe("not a url &amp; more");
  });

  it("treats a missing value as empty", () => {
    expect(cleanUrl(undefined)).toBe("");
  });
});

import { describe, expect, it } from "vitest";

import {
  cleanFeedText,
  cleanUrl,
  decodeHtmlEntities,
  htmlToPlainText,
  isFeedBoilerplateOnly
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

  it("reduces the phrase alone to nothing, with or without its arrow", () => {
    expect(cleanFeedText("点击查看原文>")).toBe("");
    expect(cleanFeedText("  点击查看原文  ")).toBe("");
    expect(cleanFeedText("点击查看原文 ›")).toBe("");
    expect(cleanFeedText("点击查看原文&raquo;")).toBe("");
    expect(cleanFeedText("点击查看原文＞")).toBe("");
  });

  it("removes a trailing phrase after body text, and a repeated one", () => {
    expect(cleanFeedText("正文第一句。 点击查看原文>")).toBe("正文第一句。");
    expect(cleanFeedText("正文。 点击查看原文> 点击查看原文>")).toBe("正文。");
  });

  it("leaves the phrase alone mid-text", () => {
    const middle = "点击查看原文> 之后还有一段正文。";

    expect(cleanFeedText(middle)).toBe(middle);
    expect(cleanFeedText("前文 点击查看原文 后文")).toBe(
      "前文 点击查看原文 后文"
    );
  });

  it("leaves prose that merely ends in the same words", () => {
    expect(cleanFeedText("完整报告请点击查看原文")).toBe(
      "完整报告请点击查看原文"
    );
  });

  it("handles other languages: strips the InfoQ tail, keeps unlisted phrases", () => {
    expect(
      cleanFeedText(
        "<p>Anthropic publishes three measurements.</p><div align='right'><a href='x'>点击查看原文></a></div>"
      )
    ).toBe("Anthropic publishes three measurements.");
    expect(cleanFeedText("A short note. Read the original >")).toBe(
      "A short note. Read the original >"
    );
    expect(cleanFeedText("リリースノート。 詳細はこちら>")).toBe(
      "リリースノート。 詳細はこちら>"
    );
  });
});

describe("cleanFeedText — GitHub Blog's WordPress footer", () => {
  const footer = (title: string) =>
    `<p>The post <a href="https://github.blog/x/">${title}</a> appeared first on <a href="https://github.blog">The GitHub Blog</a>.</p>`;

  it("removes the footer and keeps the summary before it", () => {
    expect(
      cleanFeedText(
        `<p>What is a developer to do when they need something more than a chat box? Enter canvases.</p>\n${footer("When chat is the wrong UI")}`
      )
    ).toBe(
      "What is a developer to do when they need something more than a chat box? Enter canvases."
    );
  });

  it("copes with punctuation in the title, and the old stored spacing", () => {
    expect(
      cleanFeedText(
        `<p>Hot takes.</p>${footer("Should you read the code, is RAG dead, and did Skills kill MCP?")}`
      )
    ).toBe("Hot takes.");
    expect(
      cleanFeedText(
        "Summary. The post AI-powered fuzzing with the GitHub Security Lab Taskflow Agent appeared first on The GitHub Blog ."
      )
    ).toBe("Summary.");
  });

  it("does not reach back to an earlier sentence starting 'The post '", () => {
    expect(
      cleanFeedText(
        "The post office opened late. The post Foo appeared first on The GitHub Blog."
      )
    ).toBe("The post office opened late.");
  });

  it("reduces a footer-only description to nothing", () => {
    expect(cleanFeedText(footer("Only a footer"))).toBe("");
  });

  it("leaves the sentence alone mid-text, for other sites, and for near misses", () => {
    const middle =
      "The post Foo appeared first on The GitHub Blog. Then the body goes on.";
    expect(cleanFeedText(middle)).toBe(middle);
    expect(
      cleanFeedText("Summary. The post Foo appeared first on Some Other Blog.")
    ).toBe("Summary. The post Foo appeared first on Some Other Blog.");
    expect(
      cleanFeedText("Summary. This post appeared first on The GitHub Blog.")
    ).toBe("Summary. This post appeared first on The GitHub Blog.");
    expect(
      cleanFeedText(
        "Summary. The post Foo was first published on The GitHub Blog."
      )
    ).toBe("Summary. The post Foo was first published on The GitHub Blog.");
  });
});

describe("cleanFeedText — an empty GitHub release body", () => {
  it("reduces 'No content.' to nothing, loosely on case, period and space", () => {
    expect(cleanFeedText("No content.")).toBe("");
    expect(cleanFeedText("  no content  ")).toBe("");
    expect(cleanFeedText("<p>NO CONTENT .</p>")).toBe("");
  });

  it("keeps the words anywhere they are not the whole text", () => {
    expect(cleanFeedText("Fixes a crash. No content.")).toBe(
      "Fixes a crash. No content."
    );
    expect(cleanFeedText("No content. Fixes a crash.")).toBe(
      "No content. Fixes a crash."
    );
    expect(cleanFeedText("No content changes in this release.")).toBe(
      "No content changes in this release."
    );
    expect(cleanFeedText("No contents.")).toBe("No contents.");
  });
});

describe("isFeedBoilerplateOnly", () => {
  it("recognises a stored InfoQ original, raw or already cleaned", () => {
    expect(
      isFeedBoilerplateOnly(
        "<div align='right'><a href='https://www.infoq.cn/article/x?utm_source=rss&utm_medium=article'>点击查看原文></a></div>"
      )
    ).toBe(true);
    expect(isFeedBoilerplateOnly("点击查看原文>")).toBe(true);
  });

  it("recognises the other two feeds' boilerplate standing alone", () => {
    expect(isFeedBoilerplateOnly("No content.")).toBe(true);
    expect(
      isFeedBoilerplateOnly("The post Foo appeared first on The GitHub Blog.")
    ).toBe(true);
    expect(
      isFeedBoilerplateOnly(
        "Summary. The post Foo appeared first on The GitHub Blog."
      )
    ).toBe(false);
  });

  it("is false for real text, empty text and markup with no phrase", () => {
    expect(isFeedBoilerplateOnly("正文。 点击查看原文>")).toBe(false);
    expect(isFeedBoilerplateOnly("")).toBe(false);
    expect(isFeedBoilerplateOnly(undefined)).toBe(false);
    expect(isFeedBoilerplateOnly("<div></div>")).toBe(false);
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

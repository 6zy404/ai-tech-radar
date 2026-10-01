import { describe, expect, it } from "vitest";

import { buildPageLinkUrl, getSectionLinkLabel } from "./page-link";

describe("buildPageLinkUrl", () => {
  it("joins the site URL and the page path", () => {
    expect(
      buildPageLinkUrl("https://aizyradar.cn", "/technologies/kimi-k3")
    ).toBe("https://aizyradar.cn/technologies/kimi-k3");
  });

  it("does not double or drop the slash between them", () => {
    expect(buildPageLinkUrl("https://aizyradar.cn/", "skills/rag")).toBe(
      "https://aizyradar.cn/skills/rag"
    );
    expect(buildPageLinkUrl("https://aizyradar.cn//", "//skills/rag")).toBe(
      "https://aizyradar.cn/skills/rag"
    );
  });

  it("drops a query or hash the path carries", () => {
    expect(
      buildPageLinkUrl("https://aizyradar.cn", "/digest/2026-10-01?x=1#top")
    ).toBe("https://aizyradar.cn/digest/2026-10-01");
  });

  it("appends the section as the hash", () => {
    expect(
      buildPageLinkUrl(
        "https://aizyradar.cn",
        "/technologies/kimi-k3?view=x",
        "section-why-it-matters"
      )
    ).toBe("https://aizyradar.cn/technologies/kimi-k3#section-why-it-matters");
  });
});

describe("getSectionLinkLabel", () => {
  it("names the section it copies", () => {
    expect(getSectionLinkLabel(" 为什么重要 ")).toBe(
      "复制「为什么重要」一节的链接"
    );
  });
});

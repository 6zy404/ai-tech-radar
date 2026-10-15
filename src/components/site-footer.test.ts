import { readFileSync } from "node:fs";
import path from "node:path";

import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getSiteFooterLinks,
  SiteFooter,
  siteFeedbackUrl
} from "@/components/site-footer";

// Vitest compiles .tsx with the classic JSX runtime (tsconfig says
// "preserve"), which reads a global React — as in structured-data.test.ts.
(globalThis as { React?: typeof React }).React = React;

describe("getSiteFooterLinks", () => {
  it("lists the Chinese-site paths in order on the Chinese site", () => {
    expect(getSiteFooterLinks("zh").map((link) => link.href)).toEqual([
      "/about",
      "/about#privacy",
      "/sources",
      "/feed.xml"
    ]);
  });

  it("prefixes the pages with /en on the English site, never the feed", () => {
    expect(getSiteFooterLinks("en").map((link) => link.href)).toEqual([
      "/en/about",
      "/en/about#privacy",
      "/en/sources",
      "/feed.xml"
    ]);
  });

  it("marks only the feed as a feed, and says on the English site that it is in Chinese", () => {
    const en = getSiteFooterLinks("en");

    expect(en.filter((link) => link.feed).map((link) => link.key)).toEqual([
      "rss"
    ]);
    expect(en.find((link) => link.feed)?.label).toMatch(/in Chinese/);
  });
});

describe("SiteFooter", () => {
  const render = (locale: "zh" | "en") =>
    renderToStaticMarkup(createElement(SiteFooter, { locale }));

  it("is a footer holding a labelled nav, in each language", () => {
    expect(render("zh")).toMatch(/^<footer class="site-footer">/);
    expect(render("zh")).toContain(
      '<nav class="site-footer__nav" aria-label="关于本站">'
    );
    expect(render("en")).toContain('aria-label="About this site"');
    expect(render("en")).toContain('href="/en/about#privacy"');
  });

  it("opens the feedback link on GitHub in a new tab, without an opener", () => {
    const html = render("zh");

    expect(siteFeedbackUrl).toBe(
      "https://github.com/6zy404/ai-tech-radar/issues"
    );
    expect(html).toContain(
      `<a href="${siteFeedbackUrl}" target="_blank" rel="noreferrer noopener">`
    );
    // The contact is a link to the issue tracker, not an address.
    expect(html).not.toMatch(/mailto:|@[a-z0-9-]+\.[a-z]/i);
  });

  it("announces the feed link as RSS", () => {
    expect(render("zh")).toContain(
      '<a href="/feed.xml" type="application/rss+xml">'
    );
  });

  it("links nowhere inside the workspace", () => {
    for (const locale of ["zh", "en"] as const) {
      expect(render(locale)).not.toMatch(/\/workspace|\/api\//);
    }
  });

  it("imports nothing from the workspace", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/site-footer.tsx"),
      "utf8"
    );
    const imports = source.match(/from "[^"]+"/g) ?? [];

    expect(imports.length).toBeGreaterThan(0);
    for (const statement of imports) {
      expect(statement).not.toMatch(/workspace|workflow|repositories/i);
    }
  });
});

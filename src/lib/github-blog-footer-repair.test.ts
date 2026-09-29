import { describe, expect, it } from "vitest";

import { planGitHubBlogFooterRepair } from "./github-blog-footer-repair";
import { makeWorkspaceRecord } from "./test-factories";

// The stored form on 2026-09-30: the old tag stripper left a space before the
// final period.
const storedSummary =
  "In this blog post, I explain the fuzzing taskflow. The post AI-powered fuzzing with the GitHub Security Lab Taskflow Agent appeared first on The GitHub Blog .";

describe("planGitHubBlogFooterRepair", () => {
  it("strips the footer from a published signal's original and en texts", () => {
    const record = makeWorkspaceRecord({
      slug: "seclab-fuzzing-taskflow",
      status: "published",
      summary: {
        original: storedSummary,
        zh: "中文摘要。",
        en: storedSummary
      }
    });

    const { next, changes, skipped } = planGitHubBlogFooterRepair([record]);

    expect(next[0].summary).toEqual({
      original: "In this blog post, I explain the fuzzing taskflow.",
      zh: "中文摘要。",
      en: "In this blog post, I explain the fuzzing taskflow."
    });
    expect(next[0].content).toBe(record.content);
    expect(changes.map((change) => change.field)).toEqual([
      "summary.original",
      "summary.en"
    ]);
    expect(changes[0].before).toBe(storedSummary);
    expect(skipped).toEqual([]);
  });

  it("keeps a body's line breaks, removing only the last sentence", () => {
    const record = makeWorkspaceRecord({
      status: "published",
      content: {
        original:
          "## Heading\n\nFirst paragraph.\n\n- item\n\nThe post Foo appeared first on The GitHub Blog.",
        zh: "中文正文"
      }
    });

    const { next } = planGitHubBlogFooterRepair([record]);

    expect(next[0].content.original).toBe(
      "## Heading\n\nFirst paragraph.\n\n- item"
    );
  });

  it("finds nothing on a second run", () => {
    const record = makeWorkspaceRecord({
      status: "published",
      summary: { original: storedSummary, zh: "中文摘要。" }
    });

    const first = planGitHubBlogFooterRepair([record]);

    expect(first.changes).toHaveLength(1);
    expect(planGitHubBlogFooterRepair(first.next).changes).toEqual([]);
  });

  it("leaves drafts, zh, other sites and mid-text sentences alone", () => {
    const footer = "The post Foo appeared first on The GitHub Blog.";
    const draft = makeWorkspaceRecord({
      slug: "draft",
      status: "draft",
      summary: { original: `Summary. ${footer}`, zh: "中文" }
    });
    const published = makeWorkspaceRecord({
      slug: "published",
      status: "published",
      title: { original: `Title ${footer}`, zh: "标题" },
      summary: {
        original: "Summary. The post Foo appeared first on Some Other Blog.",
        zh: `中文 ${footer}`
      },
      content: { original: `${footer} Then the body goes on.`, zh: "正文" }
    });

    const { next, changes, skipped } = planGitHubBlogFooterRepair([
      draft,
      published
    ]);

    expect(next).toEqual([draft, published]);
    expect(changes).toEqual([]);
    expect(skipped).toEqual([]);
  });

  it("skips a field that is only the footer instead of emptying it", () => {
    const record = makeWorkspaceRecord({
      slug: "footer-only",
      status: "published",
      summary: {
        original: "The post Foo appeared first on The GitHub Blog.",
        zh: "中文摘要"
      }
    });

    const { next, changes, skipped } = planGitHubBlogFooterRepair([record]);

    expect(next[0].summary).toEqual(record.summary);
    expect(changes).toEqual([]);
    expect(skipped).toEqual([
      {
        slug: "footer-only",
        field: "summary.original",
        reason: "只剩这句样板，清掉会变空"
      }
    ]);
  });
});

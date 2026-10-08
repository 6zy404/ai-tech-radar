import { describe, expect, it } from "vitest";

import {
  defaultTechnologyBrowserQuery,
  parseTechnologyBrowserQuery,
  sortTechnologiesForBrowser,
  withTechnologyBrowserQuery
} from "@/lib/technology-browser-query";
import {
  getPublisherSignalsHref,
  getPublisherSlug,
  getSourceDirectoryAnchor
} from "@/lib/source-directory";
import type { PriorityLevel } from "@/types/content";

const options = {
  types: ["model", "tool"],
  tagIds: ["agents", "rag"],
  publishers: ["openai", "量子位"]
};

describe("parseTechnologyBrowserQuery", () => {
  it("returns the defaults when nothing is given", () => {
    expect(parseTechnologyBrowserQuery({}, options)).toEqual(
      defaultTechnologyBrowserQuery
    );
  });

  it("reads every known value", () => {
    expect(
      parseTechnologyBrowserQuery(
        {
          q: "mcp",
          type: "tool",
          tag: "agents",
          priority: "watch",
          publisher: "量子位",
          sort: "priority",
          view: "news"
        },
        options
      )
    ).toEqual({
      q: "mcp",
      type: "tool",
      tag: "agents",
      priority: "watch",
      publisher: "量子位",
      sort: "priority"
    });
  });

  it("treats unknown or malformed values as absent", () => {
    expect(
      parseTechnologyBrowserQuery(
        {
          q: "   ",
          type: "spaceship",
          tag: "Agents",
          priority: "urgent",
          publisher: "OpenAI",
          sort: "latest"
        },
        options
      )
    ).toEqual(defaultTechnologyBrowserQuery);
    expect(
      parseTechnologyBrowserQuery(
        { q: "x".repeat(201), sort: "random" },
        options
      )
    ).toEqual(defaultTechnologyBrowserQuery);
  });

  it("takes the first value when a parameter repeats", () => {
    expect(
      parseTechnologyBrowserQuery(
        { type: ["model", "tool"], tag: [], priority: ["high_priority"] },
        options
      )
    ).toMatchObject({ type: "model", tag: "", priority: "high_priority" });
  });

  it("keeps a search as typed", () => {
    expect(parseTechnologyBrowserQuery({ q: " 智能体 " }, options).q).toBe(
      " 智能体 "
    );
  });
});

describe("withTechnologyBrowserQuery", () => {
  it("leaves the unfiltered list as a bare path", () => {
    expect(
      withTechnologyBrowserQuery(
        "/technologies?q=old&publisher=openai&sort=priority",
        defaultTechnologyBrowserQuery
      )
    ).toBe("/technologies");
  });

  it("writes only the non-default values", () => {
    expect(
      withTechnologyBrowserQuery("/technologies", {
        q: "agent 框架",
        type: "",
        tag: "rag",
        priority: "high_priority",
        publisher: "openai",
        sort: "priority"
      })
    ).toBe(
      "/technologies?q=agent+%E6%A1%86%E6%9E%B6&tag=rag&priority=high_priority&publisher=openai&sort=priority"
    );
  });

  it("drops a whitespace-only search", () => {
    expect(
      withTechnologyBrowserQuery("/technologies", {
        ...defaultTechnologyBrowserQuery,
        q: "  "
      })
    ).toBe("/technologies");
  });

  it("keeps other parameters and the hash", () => {
    expect(
      withTechnologyBrowserQuery("/technologies?utm=x&type=model#top", {
        ...defaultTechnologyBrowserQuery,
        type: "tool"
      })
    ).toBe("/technologies?utm=x&type=tool#top");
  });

  it("round-trips through the parser", () => {
    const query = {
      q: "长上下文",
      type: "model",
      tag: "agents",
      priority: "low_priority" as const,
      publisher: "量子位",
      sort: "priority" as const
    };
    const href = withTechnologyBrowserQuery("/technologies", query);
    const params = Object.fromEntries(
      new URL(href, "http://localhost").searchParams
    );

    expect(parseTechnologyBrowserQuery(params, options)).toEqual(query);
  });
});

describe("the publisher filter and /sources", () => {
  it("accepts exactly the slug a /sources card links with", () => {
    const names = ["OpenAI", "量子位", "METR / Redwood Research"];
    const publishers = names.map(getPublisherSlug);

    for (const name of names) {
      const href = getPublisherSignalsHref(name);
      const params = Object.fromEntries(
        new URL(href, "http://localhost").searchParams
      );
      const { publisher } = parseTechnologyBrowserQuery(params, {
        ...options,
        publishers
      });

      expect(publisher).toBe(getPublisherSlug(name));
      // The same string the card's fragment id carries.
      expect(getSourceDirectoryAnchor(name)).toBe(`publisher-${publisher}`);
      // Writing it back leaves the address as the card linked it.
      expect(
        withTechnologyBrowserQuery(href, {
          ...defaultTechnologyBrowserQuery,
          publisher
        })
      ).toBe(href);
    }
  });

  it("does not take the display name in place of the slug", () => {
    expect(
      parseTechnologyBrowserQuery({ publisher: "OpenAI" }, options).publisher
    ).toBe("");
  });
});

describe("sortTechnologiesForBrowser", () => {
  const items: { id: string; publishDate: string; level: PriorityLevel }[] = [
    { id: "a", publishDate: "2026-09-30", level: "watch" },
    { id: "b", publishDate: "2026-09-29", level: "high_priority" },
    { id: "c", publishDate: "2026-09-29", level: "low_priority" },
    { id: "d", publishDate: "2026-09-28", level: "high_priority" },
    { id: "e", publishDate: "2026-09-30", level: "high_priority" },
    { id: "f", publishDate: "2026-09-30", level: "watch" }
  ];
  const levelOf = (item: (typeof items)[number]) => item.level;

  it("keeps the incoming order for 最新发布", () => {
    const sorted = sortTechnologiesForBrowser(items, "latest", levelOf);

    expect(sorted.map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f"
    ]);
    expect(sorted).not.toBe(items);
  });

  it("groups by band, newest first within a band, ties in incoming order", () => {
    expect(
      sortTechnologiesForBrowser(items, "priority", levelOf).map(
        (item) => item.id
      )
    ).toEqual(["e", "b", "d", "a", "f", "c"]);
  });
});

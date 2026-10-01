import { describe, expect, it } from "vitest";

import {
  buildSourceDirectory,
  getSourceDirectoryAnchor,
  groupSourceDirectoryByPublisherType,
  recentSignalLimit
} from "@/lib/source-directory";
import { makeTechnologyItem } from "@/lib/test-factories";
import type { TechnologyItem } from "@/types/content";

function signal(
  id: string,
  overrides: Partial<TechnologyItem> = {}
): TechnologyItem {
  return makeTechnologyItem({
    id,
    slug: id,
    title: { original: `Title ${id}` },
    status: "published",
    ...overrides
  });
}

describe("buildSourceDirectory", () => {
  it("groups by publisherName and lists every feed the publisher came through", () => {
    const directory = buildSourceDirectory([
      signal("a", {
        publisherName: "OpenAI",
        sourceName: "OpenAI News",
        publishDate: "2026-09-01"
      }),
      signal("b", {
        publisherName: "OpenAI",
        sourceName: "量子位",
        publishDate: "2026-09-20"
      }),
      signal("c", {
        publisherName: "OpenAI",
        sourceName: "OpenAI News",
        publishDate: "2026-08-01"
      }),
      signal("d", { publisherName: "Ollama", sourceName: "Ollama Releases" })
    ]);

    expect(directory.entries.map((entry) => entry.publisherName)).toEqual([
      "OpenAI",
      "Ollama"
    ]);
    const openai = directory.entries[0];
    expect(openai.signalCount).toBe(3);
    expect(openai.sourceNames).toEqual(["OpenAI News", "量子位"]);
    expect(openai.recent).toEqual([
      { title: "Title b", slug: "b", publishDate: "2026-09-20" },
      { title: "Title a", slug: "a", publishDate: "2026-09-01" },
      { title: "Title c", slug: "c", publishDate: "2026-08-01" }
    ]);
    // A one-signal publisher lists exactly that signal — no empty slots.
    expect(directory.entries[1].recent).toHaveLength(1);
    expect(directory.totals).toEqual({
      publishers: 2,
      signals: 4,
      sources: 3,
      publisherNameFallbacks: 0
    });
  });

  it("lists at most three recent signals, newest first", () => {
    const directory = buildSourceDirectory(
      ["01", "05", "03", "04", "02"].map((day) =>
        signal(`s${day}`, {
          publisherName: "Busy",
          publishDate: `2026-09-${day}`
        })
      )
    );

    const [entry] = directory.entries;
    expect(recentSignalLimit).toBe(3);
    expect(entry.signalCount).toBe(5);
    expect(entry.recent.map((item) => item.slug)).toEqual([
      "s05",
      "s04",
      "s03"
    ]);
  });

  it("merges names that differ only in case or surrounding space", () => {
    const directory = buildSourceDirectory([
      signal("a", {
        publisherName: "Hugging Face ",
        publishDate: "2026-09-01"
      }),
      signal("b", { publisherName: "hugging face", publishDate: "2026-09-02" })
    ]);

    expect(directory.entries).toHaveLength(1);
    // The spelling on the newest signal wins.
    expect(directory.entries[0].publisherName).toBe("hugging face");
  });

  it("falls back to sourceName when publisherName is empty, and counts it", () => {
    const directory = buildSourceDirectory([
      signal("a", { publisherName: "", sourceName: "量子位" }),
      signal("b", { publisherName: "量子位", sourceName: "量子位" })
    ]);

    expect(directory.entries).toHaveLength(1);
    expect(directory.entries[0].signalCount).toBe(2);
    expect(directory.totals.publisherNameFallbacks).toBe(1);
  });

  it("never lets a draft or archived record in", () => {
    const directory = buildSourceDirectory([
      signal("a", { publisherName: "Visible" }),
      signal("b", { publisherName: "Draft Co", status: "draft" }),
      signal("c", { publisherName: "Archived Co", status: "archived" })
    ]);

    expect(directory.entries.map((entry) => entry.publisherName)).toEqual([
      "Visible"
    ]);
  });

  it("takes the most frequent publisher type, a tie going to the newest signal", () => {
    const directory = buildSourceDirectory([
      signal("a", {
        publisherName: "IBM Research",
        publisherType: "big-tech",
        publishDate: "2026-08-01"
      }),
      signal("b", {
        publisherName: "IBM Research",
        publisherType: "research-lab",
        publishDate: "2026-09-01"
      })
    ]);

    expect(directory.entries[0].publisherType).toBe("research-lab");
    expect(directory.entries[0].publisherTypeLabel).toBe("研究实验室");
  });

  it("orders by signal count, then by name", () => {
    const directory = buildSourceDirectory([
      signal("a", { publisherName: "Zeta" }),
      signal("b", { publisherName: "Alpha" }),
      signal("c", { publisherName: "Mid" }),
      signal("d", { publisherName: "Mid" })
    ]);

    expect(directory.entries.map((entry) => entry.publisherName)).toEqual([
      "Mid",
      "Alpha",
      "Zeta"
    ]);
  });

  it("carries only public fields — no URL, id, ranking or workflow state", () => {
    const directory = buildSourceDirectory([
      signal("a", {
        publisherName: "OpenAI",
        sourceUrl: "https://internal.example/feed?token=secret",
        sourceReferences: [
          { sourceName: "Ref", sourceUrl: "https://ref.example" }
        ],
        intelligenceStatus: "needs_enrichment"
      })
    ]);

    const [entry] = directory.entries;
    expect(Object.keys(entry).sort()).toEqual(
      [
        "publisherName",
        "publisherType",
        "publisherTypeLabel",
        "recent",
        "signalCount",
        "sourceNames"
      ].sort()
    );
    for (const item of entry.recent) {
      expect(Object.keys(item).sort()).toEqual(
        ["publishDate", "slug", "title"].sort()
      );
    }
    expect(Object.keys(directory).sort()).toEqual(["entries", "totals"]);
    const serialized = JSON.stringify(directory);
    expect(serialized).not.toContain("http");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("needs_enrichment");
  });
});

describe("groupSourceDirectoryByPublisherType", () => {
  it("puts the type with the most signals first and keeps entry order", () => {
    const { entries } = buildSourceDirectory([
      signal("a", { publisherName: "Lab", publisherType: "research-lab" }),
      signal("b", { publisherName: "Big", publisherType: "big-tech" }),
      signal("c", { publisherName: "Big", publisherType: "big-tech" }),
      signal("d", { publisherName: "Other Big", publisherType: "big-tech" })
    ]);

    const sections = groupSourceDirectoryByPublisherType(entries);
    expect(sections.map((section) => section.label)).toEqual([
      "大型科技公司",
      "研究实验室"
    ]);
    expect(sections[0].signalCount).toBe(3);
    expect(sections[0].entries.map((entry) => entry.publisherName)).toEqual([
      "Big",
      "Other Big"
    ]);
  });
});

describe("getSourceDirectoryAnchor", () => {
  it("keeps letters and digits in any script and joins the rest with hyphens", () => {
    expect(getSourceDirectoryAnchor("Google DeepMind")).toBe(
      "publisher-google-deepmind"
    );
    expect(getSourceDirectoryAnchor("METR / Redwood Research")).toBe(
      "publisher-metr-redwood-research"
    );
    expect(getSourceDirectoryAnchor("阿里巴巴通义千问")).toBe(
      "publisher-阿里巴巴通义千问"
    );
  });
});

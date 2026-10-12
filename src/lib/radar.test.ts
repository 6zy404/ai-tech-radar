import { describe, expect, it } from "vitest";

import { radarEntries } from "@/data/radar";
import {
  deriveRadarChange,
  getRadarEdition,
  toPublicRadarEntries
} from "@/lib/radar";
import { buildRadarShareCard } from "@/lib/share-card";
import { buildRadarJsonLd } from "@/lib/structured-data";
import { makeTechnologyItem } from "@/lib/test-factories";
import type { KnowledgeItem } from "@/types/content";
import type { RadarEntry } from "@/types/radar";

function makeEntry(overrides: Partial<RadarEntry> = {}): RadarEntry {
  return {
    id: "radar-a",
    name: "条目 A",
    slug: "entry-a",
    quadrant: "tools-methods",
    ring: "trial",
    ringReason: "理由。",
    evidenceTechnologyIds: [],
    relatedKnowledgeIds: [],
    relatedSkillIds: [],
    history: [{ date: "2026-10-13", toRing: "trial", reason: "首期收录。" }],
    ...overrides
  };
}

describe("deriveRadarChange", () => {
  const firstEdition = makeEntry();

  it("marks nothing on the first edition", () => {
    const edition = getRadarEdition([firstEdition, makeEntry({ id: "b" })]);

    expect(edition.isFirstEdition).toBe(true);
    expect(deriveRadarChange(firstEdition, edition).change).toBe("unchanged");
  });

  it("marks an entry added after the first edition as new", () => {
    const added = makeEntry({
      id: "b",
      history: [{ date: "2026-11-01", toRing: "assess", reason: "" }]
    });
    const edition = getRadarEdition([firstEdition, added]);

    expect(deriveRadarChange(added, edition).change).toBe("new");
    expect(deriveRadarChange(firstEdition, edition).change).toBe("unchanged");
  });

  it("marks a move inside the window, with the ring it left", () => {
    const moved = makeEntry({
      ring: "adopt",
      history: [
        { date: "2026-10-13", toRing: "trial", reason: "" },
        { date: "2026-11-20", fromRing: "trial", toRing: "adopt", reason: "" }
      ]
    });
    const edition = getRadarEdition([moved]);

    expect(deriveRadarChange(moved, edition)).toEqual({
      change: "moved",
      movedFrom: "trial"
    });
  });

  it("does not count a move older than the window, or a move and back", () => {
    const old = makeEntry({
      ring: "adopt",
      history: [
        { date: "2026-10-13", toRing: "trial", reason: "" },
        { date: "2026-10-20", fromRing: "trial", toRing: "adopt", reason: "" }
      ]
    });
    const later = makeEntry({
      id: "b",
      history: [
        { date: "2026-10-13", toRing: "trial", reason: "" },
        { date: "2026-12-30", fromRing: "trial", toRing: "hold", reason: "" },
        { date: "2026-12-31", fromRing: "hold", toRing: "trial", reason: "" }
      ]
    });
    const edition = getRadarEdition([old, later]);

    expect(deriveRadarChange(old, edition).change).toBe("unchanged");
    expect(deriveRadarChange(later, edition).change).toBe("unchanged");
  });
});

describe("toPublicRadarEntries", () => {
  const published = makeTechnologyItem({
    id: "tech-1",
    slug: "signal-one",
    status: "published",
    publishDate: "2026-09-01"
  });
  const draft = makeTechnologyItem({
    id: "tech-2",
    slug: "draft-signal",
    status: "draft"
  });
  const knowledge = {
    id: "knowledge-a",
    slug: "concept-a",
    title: "概念 A"
  } as KnowledgeItem;

  it("resolves only published references and numbers in list order", () => {
    const entries = toPublicRadarEntries(
      [
        makeEntry({
          id: "z",
          slug: "z",
          quadrant: "tools-methods",
          evidenceTechnologyIds: ["tech-1", "tech-2", "missing"],
          relatedKnowledgeIds: ["knowledge-a", "knowledge-draft"]
        }),
        makeEntry({ id: "y", slug: "y", quadrant: "models-training" })
      ],
      { technologies: [published, draft], knowledge: [knowledge], skills: [] }
    );

    expect(entries.map((entry) => [entry.number, entry.slug])).toEqual([
      [1, "y"],
      [2, "z"]
    ]);
    expect(entries[1].evidence.map((signal) => signal.slug)).toEqual([
      "signal-one"
    ]);
    expect(entries[1].knowledge).toEqual([
      { slug: "concept-a", title: "概念 A" }
    ]);
    expect(entries[1]).not.toHaveProperty("id");
    expect(entries[1]).not.toHaveProperty("evidenceTechnologyIds");
  });

  it("keeps the seed's numbering stable: quadrant, then ring", () => {
    const entries = toPublicRadarEntries(radarEntries, {
      technologies: [],
      knowledge: [],
      skills: []
    });

    expect(entries).toHaveLength(radarEntries.length);
    expect(entries[0].quadrant).toBe("models-training");
    expect(entries[0].ring).toBe("adopt");
    expect(entries.at(-1)?.quadrant).toBe("tools-methods");
    expect(entries.at(-1)?.ring).toBe("hold");
  });
});

describe("radar seed data", () => {
  it("has unique ids and slugs, 2–4 evidence signals and a matching last history line", () => {
    expect(new Set(radarEntries.map((entry) => entry.id)).size).toBe(
      radarEntries.length
    );
    expect(new Set(radarEntries.map((entry) => entry.slug)).size).toBe(
      radarEntries.length
    );

    for (const entry of radarEntries) {
      expect(entry.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(entry.evidenceTechnologyIds.length).toBeGreaterThanOrEqual(2);
      expect(entry.evidenceTechnologyIds.length).toBeLessThanOrEqual(4);
      expect(entry.ringReason.trim()).not.toBe("");
      expect(entry.history.at(-1)?.toRing).toBe(entry.ring);
    }
  });
});

describe("radar share card and JSON-LD", () => {
  it("prints the ring counts and falls back to the site card when empty", () => {
    const card = buildRadarShareCard({
      entryCount: 40,
      ringCounts: [14, 10, 11, 5],
      latestDate: "2026-10-13"
    });

    expect(card.kind).toBe("radar");
    expect(card.byline).toBe("采用 14 · 试用 10 · 评估 11 · 暂缓 5");
    expect(card.date).toBe("2026-10-13");
    expect(
      buildRadarShareCard({ entryCount: 0, ringCounts: [], latestDate: "" })
        .kind
    ).toBe("site");
  });

  it("lists the entries as DefinedTerms with their numbers", () => {
    const [page, crumbs] = buildRadarJsonLd(
      { title: "技术雷达", description: "说明", latestDate: "2026-10-13" },
      [{ number: 1, name: "vLLM", ringReason: "默认起点。" }],
      "https://example.test"
    );

    expect(page["@type"]).toBe("CollectionPage");
    expect(page.url).toBe("https://example.test/radar");
    expect(page.mainEntity).toMatchObject({
      numberOfItems: 1,
      itemListElement: [
        {
          position: 1,
          item: { "@type": "DefinedTerm", name: "vLLM" }
        }
      ]
    });
    expect(crumbs["@type"]).toBe("BreadcrumbList");
  });
});

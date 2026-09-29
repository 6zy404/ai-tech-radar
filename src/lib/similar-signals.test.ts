import { describe, expect, it, vi } from "vitest";

import type { IndexedCorpus } from "@/lib/hybrid-search";
import type { SearchDocument } from "@/lib/search";
import {
  buildCenteredPool,
  centerVectors,
  getSimilarSignals,
  selectSimilarSignals,
  type EmbeddedSignal
} from "@/lib/similar-signals";

// Keep the model package out of a pure unit test: only `cosine` is used, and
// the corpus loader is injected per test.
vi.mock("@/lib/embeddings", () => ({
  cosine: (a: number[], b: number[]) =>
    a.reduce((sum, value, index) => sum + value * b[index], 0)
}));
vi.mock("@/lib/hybrid-search", () => ({
  getIndexedCorpusWithinTimeout: () => Promise.reject(new Error("unused"))
}));

const dimensions = 16;

function basis(index: number, shared = 0): number[] {
  const vector = new Array<number>(dimensions).fill(shared);
  vector[index] += 1;
  return vector;
}

function mix(a: number[], b: number[], weight: number): number[] {
  return a.map((value, index) => value * (1 - weight) + b[index] * weight);
}

/**
 * Ten unrelated signals (one axis each), plus "a" and its near-twin "a2", and
 * "b" with its near-twin "b2". Every vector also carries a large shared
 * component, like the "AI / agents" direction every real signal shares.
 */
function samplePool(): EmbeddedSignal[] {
  const shared = 0.8;
  const signals: EmbeddedSignal[] = [];

  for (let index = 0; index < 10; index += 1) {
    signals.push({ id: `noise-${index}`, vector: basis(index, shared) });
  }

  signals.push({ id: "a", vector: basis(10, shared) });
  signals.push({
    id: "a2",
    vector: mix(basis(10, shared), basis(11, shared), 0.2)
  });
  signals.push({ id: "b", vector: basis(12, shared) });
  signals.push({
    id: "b2",
    vector: mix(basis(12, shared), basis(13, shared), 0.3)
  });

  return signals;
}

describe("centerVectors", () => {
  it("removes the shared direction and re-normalizes", () => {
    const centered = centerVectors([
      [1, 1],
      [1, -1]
    ]);

    expect(centered[0][0]).toBeCloseTo(0);
    expect(centered[0][1]).toBeCloseTo(1);
    expect(centered[1][1]).toBeCloseTo(-1);
  });
});

describe("selectSimilarSignals", () => {
  const pool = buildCenteredPool(samplePool());

  it("returns the near-twin and never the signal itself", () => {
    expect(selectSimilarSignals(pool, "a").map((entry) => entry.id)).toEqual([
      "a2"
    ]);
  });

  it("returns nothing for a signal with no neighbour above the floor", () => {
    expect(selectSimilarSignals(pool, "noise-3")).toEqual([]);
  });

  it("skips what the page already links to", () => {
    expect(selectSimilarSignals(pool, "b").map((entry) => entry.id)).toEqual([
      "b2"
    ]);
    expect(selectSimilarSignals(pool, "b", ["b2"])).toEqual([]);
  });

  it("honours the floor and the limit", () => {
    const everything = selectSimilarSignals(pool, "a", [], {
      minZ: -10,
      limit: 3
    });

    expect(everything).toHaveLength(3);
    expect(everything[0].id).toBe("a2");
    expect(
      selectSimilarSignals(pool, "a", [], { minZ: 100, limit: 3 })
    ).toEqual([]);
  });

  it("returns nothing for an unknown id or a flat pool", () => {
    expect(selectSimilarSignals(pool, "missing")).toEqual([]);

    const flat = buildCenteredPool([
      { id: "x", vector: basis(0) },
      { id: "y", vector: basis(0) }
    ]);
    expect(selectSimilarSignals(flat, "x")).toEqual([]);
  });
});

function document(
  id: string,
  group: SearchDocument["group"] = "technologies"
): SearchDocument {
  return {
    group,
    evalKey: `T:${id}`,
    link: {
      key: id,
      title: `title ${id}`,
      summary: `summary ${id}`,
      href: `/technologies/${id}`,
      tags: []
    },
    titleText: id,
    haystack: id,
    embedText: id
  };
}

function sampleCorpus(): IndexedCorpus {
  const signals = samplePool();

  return {
    signature: "test",
    documents: [
      ...signals.map((signal) => document(signal.id)),
      // A skill sitting right on top of "a": only signals may be suggested.
      document("skill-near-a", "skills")
    ],
    vectors: [...signals.map((signal) => signal.vector), basis(10, 0.8)]
  };
}

describe("getSimilarSignals", () => {
  it("maps matches to public links, signals only", async () => {
    const links = await getSimilarSignals("a", [], async () => sampleCorpus());

    expect(links).toEqual([
      {
        id: "a2",
        title: "title a2",
        href: "/technologies/a2",
        summary: "summary a2"
      }
    ]);
  });

  it("returns nothing when the model or the vectors are not ready", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      getSimilarSignals("a", [], () =>
        Promise.reject(new Error("not ready within 3000ms"))
      )
    ).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledOnce();

    warn.mockRestore();
  });
});

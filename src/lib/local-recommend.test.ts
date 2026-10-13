import { describe, expect, it, vi } from "vitest";

import type { SearchDocument } from "@/lib/search";
import {
  SIGNAL_VECTOR_FORMAT,
  decodeSignalVectorFile,
  dequantizeVector,
  describeRecommendationReason,
  dot,
  quantizeVector,
  recommendFromReading,
  selectSeeds,
  signalVectorEntryKeys,
  type DecodedSignalPool
} from "@/lib/local-recommend";
import { buildSignalVectorFile } from "@/lib/local-recommend-vectors";
import { toVisitKey } from "@/lib/visit-state";

// Keep the model package and the content store out of a pure unit test.
vi.mock("@/lib/embeddings", () => ({
  EMBEDDING_MODEL: "test-model",
  cosine: (a: number[], b: number[]) =>
    a.reduce((sum, value, index) => sum + value * b[index], 0)
}));
vi.mock("@/lib/hybrid-search", () => ({
  getIndexedCorpusWithinTimeout: () => Promise.reject(new Error("unused"))
}));
vi.mock("@/lib/content", () => ({ getAllTechnologies: () => [] }));

const dimensions = 24;

function basis(index: number, shared = 0.8): number[] {
  const vector = new Array<number>(dimensions).fill(shared);
  vector[index] += 1;
  return vector;
}

function mix(a: number[], b: number[], weight: number): number[] {
  return a.map((value, index) => value * (1 - weight) + b[index] * weight);
}

function document(
  id: string,
  group: SearchDocument["group"] = "technologies"
): SearchDocument {
  return {
    group,
    evalKey: `T:${id}`,
    link: { key: longId(id), title: id, href: `/technologies/${id}`, tags: [] },
    titleText: id,
    haystack: id,
    embedText: id
  };
}

/**
 * Twelve unrelated signals (one axis each), "a" with two near-twins, "b" with
 * one. Every vector also carries the large shared component real signals do.
 */
function sampleCorpus() {
  const entries: { id: string; vector: number[] }[] = [];

  for (let index = 0; index < 12; index += 1) {
    entries.push({ id: `noise-${index}`, vector: basis(index) });
  }

  entries.push({ id: "a", vector: basis(12) });
  entries.push({ id: "a2", vector: mix(basis(12), basis(13), 0.2) });
  entries.push({ id: "a3", vector: mix(basis(12), basis(14), 0.3) });
  entries.push({ id: "b", vector: basis(15) });
  entries.push({ id: "b2", vector: mix(basis(15), basis(16), 0.25) });

  return {
    documents: entries.map((entry) => document(entry.id)),
    vectors: entries.map((entry) => entry.vector)
  };
}

// Long, like the real workspace ids, so a test can see they never ship.
function longId(id: string): string {
  return `draft-candidate-rss-https-example-com-${id}`;
}

const topicsById: Record<string, string[]> = {
  a3: ["agents"],
  "noise-5": ["agents"]
};

function published(ids: string[]) {
  return ids.map((id) => ({
    id: longId(id),
    slug: `slug-${id}`,
    title: `标题 ${id}`,
    summary: `摘要 ${id}`,
    publishDate: "2026-10-13",
    priorityLabel: "值得跟踪",
    tagIds: topicsById[id] ?? []
  }));
}

/** The pool key of a sample signal, as the browser hashes a stored mark. */
function k(id: string): string {
  return toVisitKey(longId(id));
}

function samplePool(): DecodedSignalPool {
  const corpus = sampleCorpus();
  const file = buildSignalVectorFile(
    corpus,
    published(
      corpus.documents.map((item) => item.link.key.replace(longId(""), ""))
    )
  );

  return decodeSignalVectorFile(file) as DecodedSignalPool;
}

describe("quantizeVector / dequantizeVector", () => {
  it("round-trips a unit vector to within the int8 step", () => {
    const raw = Array.from({ length: 384 }, (_, index) =>
      Math.sin(index * 0.37)
    );
    const length = Math.sqrt(raw.reduce((sum, value) => sum + value ** 2, 0));
    const unit = raw.map((value) => value / length);
    const decoded = dequantizeVector(quantizeVector(unit));

    expect(dot(unit, decoded)).toBeGreaterThan(0.9999);
    // 384 bytes of base64.
    expect(quantizeVector(unit).vector).toHaveLength(512);
  });
});

describe("buildSignalVectorFile", () => {
  it("contains only published signals, each with the fixed key set", () => {
    const corpus = sampleCorpus();
    corpus.documents.push(document("a-skill", "skills"));
    corpus.vectors.push(basis(20));
    corpus.documents.push(document("a-knowledge", "knowledge"));
    corpus.vectors.push(basis(21));
    // In the corpus but no longer published: must not reach the file.
    corpus.documents.push(document("archived"));
    corpus.vectors.push(basis(22));

    const ids = sampleCorpus().documents.map((item) =>
      item.link.key.replace(longId(""), "")
    );
    const file = buildSignalVectorFile(corpus, published(ids));

    expect(file.format).toBe(SIGNAL_VECTOR_FORMAT);
    expect(file.model).toBe("test-model");
    expect(file.dimensions).toBe(dimensions);
    expect(file.signals.map((signal) => signal.slug)).toEqual(
      ids.map((id) => `slug-${id}`)
    );
    expect(file.signals.map((signal) => signal.key)).toEqual(ids.map(k));

    for (const signal of file.signals) {
      expect(Object.keys(signal).sort()).toEqual([...signalVectorEntryKeys]);
    }

    // The long workspace ids never ship, only their hashes.
    expect(JSON.stringify(file)).not.toContain("draft-candidate");

    expect(Object.keys(file).sort()).toEqual([
      "dimensions",
      "format",
      "model",
      "pairDeviation",
      "pairMean",
      "signals"
    ]);
  });

  it("is empty when nothing is published", () => {
    const file = buildSignalVectorFile(sampleCorpus(), []);

    expect(file.signals).toEqual([]);
    expect(decodeSignalVectorFile(file)?.ids).toEqual([]);
  });
});

describe("decodeSignalVectorFile", () => {
  it("carries the card fields through", () => {
    const pool = decodeSignalVectorFile(
      buildSignalVectorFile(sampleCorpus(), published(["a", "a3"]))
    ) as DecodedSignalPool;

    expect(pool.cards.get(k("a3"))).toEqual({
      slug: "slug-a3",
      title: "标题 a3",
      summary: "摘要 a3",
      publishDate: "2026-10-13",
      priorityLabel: "值得跟踪",
      tagIds: ["agents"]
    });
  });

  it("rejects another format, a broken vector, or not-an-object", () => {
    const file = buildSignalVectorFile(
      sampleCorpus(),
      published(["a", "a2", "b"])
    );

    expect(decodeSignalVectorFile(undefined)).toBeUndefined();
    expect(decodeSignalVectorFile({ ...file, format: 99 })).toBeUndefined();
    expect(
      decodeSignalVectorFile({
        ...file,
        signals: [{ ...file.signals[0], vector: "!!not base64!!" }]
      })
    ).toBeUndefined();
    expect(
      decodeSignalVectorFile({ ...file, dimensions: dimensions + 1 })
    ).toBeUndefined();
  });
});

describe("selectSeeds", () => {
  it("takes the newest marks first, and a signal both read and saved counts as read", () => {
    expect(selectSeeds(["r1", "r2", "x"], ["s1", "x"], 10)).toEqual([
      { id: "x", mark: "read" },
      { id: "r2", mark: "read" },
      { id: "s1", mark: "saved" },
      { id: "r1", mark: "read" }
    ]);
    expect(
      selectSeeds(["r1", "r2", "r3"], [], 2).map((seed) => seed.id)
    ).toEqual(["r3", "r2"]);
  });
});

describe("recommendFromReading", () => {
  it("is empty without reading marks", () => {
    expect(
      recommendFromReading({ pool: samplePool(), readIds: [], savedIds: [] })
    ).toEqual([]);
  });

  it("is empty when the marks are not in the pool", () => {
    expect(
      recommendFromReading({
        pool: samplePool(),
        readIds: [k("gone")],
        savedIds: []
      })
    ).toEqual([]);
  });

  it("recommends the near-twins of what was read, best first, naming the seed", () => {
    const result = recommendFromReading({
      pool: samplePool(),
      readIds: [k("a")],
      savedIds: []
    });

    expect(result.map((item) => item.id)).toEqual([k("a2"), k("a3")]);
    expect(result.every((item) => item.seedId === k("a"))).toBe(true);
    expect(result.every((item) => item.seedMark === "read")).toBe(true);
  });

  it("never recommends a signal already read or saved", () => {
    const result = recommendFromReading({
      pool: samplePool(),
      readIds: [k("a")],
      savedIds: [k("a2")]
    });

    expect(result.map((item) => item.id)).toEqual([k("a3")]);
  });

  it("recommends nothing for a seed with no neighbour above the floor", () => {
    expect(
      recommendFromReading({
        pool: samplePool(),
        readIds: [k("noise-3")],
        savedIds: []
      })
    ).toEqual([]);
  });

  it("names a saved seed as saved", () => {
    const [first] = recommendFromReading({
      pool: samplePool(),
      readIds: [],
      savedIds: [k("b")]
    });

    expect(first).toMatchObject({
      id: k("b2"),
      seedId: k("b"),
      seedMark: "saved"
    });
  });

  it("caps recommendations per seed and in total", () => {
    const pool = samplePool();

    expect(
      recommendFromReading(
        { pool, readIds: [k("a"), k("b")], savedIds: [] },
        { maxPerSeed: 1 }
      ).map((item) => item.seedId)
    ).toEqual(expect.arrayContaining([k("a"), k("b")]));
    expect(
      recommendFromReading(
        { pool, readIds: [k("a"), k("b")], savedIds: [] },
        { limit: 1 }
      )
    ).toHaveLength(1);
  });

  it("lets a followed topic reorder, but never lets a dissimilar signal in", () => {
    const pool = samplePool();
    const result = recommendFromReading(
      {
        pool,
        readIds: [k("a")],
        savedIds: [],
        followedTagIds: ["agents"]
      },
      { topicBoost: 50 }
    );

    expect(result.map((item) => item.id)).toEqual([k("a3"), k("a2")]);
    expect(result[0].matchedTagIds).toEqual(["agents"]);
    expect(result[1].matchedTagIds).toEqual([]);
  });
});

describe("describeRecommendationReason", () => {
  it("names the seed and how it was marked", () => {
    expect(
      describeRecommendationReason({ seedTitle: "vLLM 0.9", seedMark: "read" })
    ).toBe("和你读过的《vLLM 0.9》相近");
    expect(
      describeRecommendationReason({ seedTitle: "vLLM 0.9", seedMark: "saved" })
    ).toBe("和你存下的《vLLM 0.9》相近");
  });

  it("adds followed topics only when given", () => {
    expect(
      describeRecommendationReason({
        seedTitle: "vLLM 0.9",
        seedMark: "read",
        matchedTagNames: ["推理与部署", "量化", "第三个"]
      })
    ).toBe("和你读过的《vLLM 0.9》相近，也属于你关注的「推理与部署」「量化」");
  });

  it("shortens a long seed title", () => {
    const reason = describeRecommendationReason({
      seedTitle:
        "一个非常非常长的信号标题，长到放进一行推荐理由里会把卡片撑出好几行的那种，真的很长",
      seedMark: "read"
    });

    expect(reason.length).toBeLessThan(50);
  });
});

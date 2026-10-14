import { signalsCopy } from "@/lib/i18n/copy/signals";
import type { Locale } from "@/lib/i18n/locale";
import { compactText } from "@/lib/compact-text";

/**
 * 「和你读过的相近」: local, explainable recommendations from the reader's own
 * reading marks. Client-safe and pure — no Node imports.
 *
 * The marks (已读 / 稍后读, `src/lib/reading-state.ts`) never leave the
 * browser. So the server publishes one recommendation data file that is the
 * same for everyone — each published signal's search vector, centered and
 * quantized, plus the public card fields the list page already shows
 * (`/signal-vectors.json`, built by `local-recommend-vectors.ts`) — and the
 * browser does the matching here.
 *
 * Entries are keyed by `toVisitKey(id)`, the 7-character hash the 新 stamps
 * and the 阅读码 already use (`src/lib/visit-state.ts`), so the long
 * workspace ids never ship; the browser hashes its marks the same way.
 *
 * The scoring follows 内容相近的信号 (`src/lib/similar-signals.ts`): vectors
 * are centered on the pool mean, and a pair counts as similar only when it
 * scores `minZ` standard deviations above the mean of all pairwise scores.
 * The floor applies to the raw similarity; a followed topic can lift a
 * candidate's rank among those that clear it, never let one in.
 */

/** Bump when the file's shape or the vector encoding changes. */
export const SIGNAL_VECTOR_FORMAT = 2;

export const signalVectorsPath = "/signal-vectors.json";

/** What a card shows: fields the public list page already renders. */
export interface SignalCardFields {
  slug: string;
  /** Chinese when available, as on the list page. */
  title: string;
  /** Cut to a one-line gist. */
  summary: string;
  publishDate: string;
  /** The productized band label (立即关注 / 值得跟踪 / 了解即可). */
  priorityLabel: string;
  tagIds: string[];
}

export interface SignalVectorEntry extends SignalCardFields {
  /** `toVisitKey(id)`: what the reader's marks are matched against. */
  key: string;
  /** Multiply each int8 component by this to get the centered vector back. */
  scale: number;
  /** The int8 components, base64. */
  vector: string;
}

export interface SignalVectorFile {
  format: number;
  model: string;
  dimensions: number;
  /** Mean and standard deviation of every unordered pair's decoded score. */
  pairMean: number;
  pairDeviation: number;
  signals: SignalVectorEntry[];
}

/**
 * The only keys an entry may carry. The server builds entries field by field
 * and the tests and `validate:deployment` check every entry against this.
 */
export const signalVectorEntryKeys = [
  "key",
  "priorityLabel",
  "publishDate",
  "scale",
  "slug",
  "summary",
  "tagIds",
  "title",
  "vector"
] as const;

export interface DecodedSignalPool {
  /** Entry keys (`toVisitKey(id)`), in file order. */
  ids: string[];
  /** Unit-length, centered vectors decoded from the file. */
  vectors: Float32Array[];
  mean: number;
  deviation: number;
  cards: Map<string, SignalCardFields>;
}

// ---------------------------------------------------------------------------
// Encoding

/** Base64 without Buffer, so the same code runs in the browser and in tests. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

/** Symmetric int8: the largest component maps to ±127. */
export function quantizeVector(vector: ArrayLike<number>): {
  scale: number;
  vector: string;
} {
  let maxAbs = 0;

  for (let index = 0; index < vector.length; index += 1) {
    maxAbs = Math.max(maxAbs, Math.abs(vector[index]));
  }

  const scale = maxAbs > 0 ? maxAbs / 127 : 1;
  const quantized = new Int8Array(vector.length);

  for (let index = 0; index < vector.length; index += 1) {
    quantized[index] = Math.round(vector[index] / scale);
  }

  return {
    // Six significant digits are far below the int8 step.
    scale: Number(scale.toPrecision(6)),
    vector: bytesToBase64(new Uint8Array(quantized.buffer))
  };
}

/** The int8 vector back as floats, re-normalized so a dot product is a cosine. */
export function dequantizeVector(
  entry: Pick<SignalVectorEntry, "scale" | "vector">
): Float32Array {
  const bytes = base64ToBytes(entry.vector);
  const quantized = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.length);
  const vector = new Float32Array(quantized.length);
  let length = 0;

  for (let index = 0; index < quantized.length; index += 1) {
    vector[index] = quantized[index] * entry.scale;
    length += vector[index] * vector[index];
  }

  length = Math.sqrt(length);

  if (length > 0) {
    for (let index = 0; index < vector.length; index += 1) {
      vector[index] /= length;
    }
  }

  return vector;
}

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;

  for (let index = 0; index < a.length; index += 1) {
    sum += a[index] * b[index];
  }

  return sum;
}

/** Mean and population standard deviation of every unordered pair's score. */
export function computePairStats(vectors: ArrayLike<number>[]): {
  mean: number;
  deviation: number;
} {
  let count = 0;
  let sum = 0;
  let sumSquares = 0;

  for (let a = 0; a < vectors.length; a += 1) {
    for (let b = a + 1; b < vectors.length; b += 1) {
      const score = dot(vectors[a], vectors[b]);
      count += 1;
      sum += score;
      sumSquares += score * score;
    }
  }

  if (count === 0) {
    return { mean: 0, deviation: 0 };
  }

  const mean = sum / count;

  return {
    mean,
    deviation: Math.sqrt(Math.max(0, sumSquares / count - mean * mean))
  };
}

/**
 * Checks the file is one this code understands; anything else is treated as
 * "vectors not ready" and the block stays hidden.
 */
export function decodeSignalVectorFile(
  value: unknown
): DecodedSignalPool | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const file = value as Partial<SignalVectorFile>;

  if (
    file.format !== SIGNAL_VECTOR_FORMAT ||
    !Array.isArray(file.signals) ||
    typeof file.pairMean !== "number" ||
    typeof file.pairDeviation !== "number" ||
    typeof file.dimensions !== "number"
  ) {
    return undefined;
  }

  const ids: string[] = [];
  const vectors: Float32Array[] = [];
  const cards = new Map<string, SignalCardFields>();

  try {
    for (const entry of file.signals) {
      if (
        typeof entry?.key !== "string" ||
        typeof entry.slug !== "string" ||
        typeof entry.title !== "string" ||
        typeof entry.vector !== "string" ||
        typeof entry.scale !== "number" ||
        !Array.isArray(entry.tagIds)
      ) {
        return undefined;
      }

      // A hash collision: keep the first, never guess.
      if (cards.has(entry.key)) {
        continue;
      }

      const vector = dequantizeVector(entry);

      if (vector.length !== file.dimensions) {
        return undefined;
      }

      ids.push(entry.key);
      vectors.push(vector);
      cards.set(entry.key, {
        slug: entry.slug,
        title: entry.title,
        summary: typeof entry.summary === "string" ? entry.summary : "",
        publishDate:
          typeof entry.publishDate === "string" ? entry.publishDate : "",
        priorityLabel:
          typeof entry.priorityLabel === "string" ? entry.priorityLabel : "",
        tagIds: entry.tagIds.filter(
          (tagId): tagId is string => typeof tagId === "string"
        )
      });
    }
  } catch {
    // atob throws on a malformed string.
    return undefined;
  }

  return {
    ids,
    vectors,
    mean: file.pairMean,
    deviation: file.pairDeviation,
    cards
  };
}

// ---------------------------------------------------------------------------
// Recommending

export interface LocalRecommendCutoff {
  /** Standard deviations above the mean pairwise similarity. */
  minZ: number;
  /** At most this many recommendations. */
  limit: number;
  /** At most this many recommendations explained by the same seed. */
  maxPerSeed: number;
  /** Only the most recent marks are used as seeds. */
  maxSeeds: number;
  /**
   * How far a followed topic lifts a candidate's rank, in standard
   * deviations. It reorders what already cleared the floor; it never adds.
   */
  topicBoost: number;
}

export const defaultLocalRecommendCutoff: LocalRecommendCutoff = {
  minZ: 2.5,
  limit: 3,
  maxPerSeed: 2,
  maxSeeds: 30,
  topicBoost: 0.5
};

export type SeedMark = "read" | "saved";

export interface LocalRecommendInput {
  pool: DecodedSignalPool;
  /**
   * Marks as pool keys (`toVisitKey` of the stored ids), stored order,
   * oldest mark first (`reading-state.ts`).
   */
  readIds: string[];
  savedIds: string[];
  followedTagIds?: string[];
}

export interface LocalRecommendation {
  id: string;
  /** Centered cosine to the closest seed. */
  score: number;
  /** The signal this one is close to — what the reason names. */
  seedId: string;
  seedMark: SeedMark;
  /** Followed topics the recommendation carries, in followed order. */
  matchedTagIds: string[];
}

/**
 * The reader's seeds, most recent first: the last `maxSeeds` marks, read and
 * saved interleaved by recency within each list. A signal both read and saved
 * counts as read — that is the stronger statement.
 */
export function selectSeeds(
  readIds: string[],
  savedIds: string[],
  maxSeeds: number
): { id: string; mark: SeedMark }[] {
  const read = new Set(readIds);
  const seen = new Set<string>();
  const seeds: { id: string; mark: SeedMark }[] = [];
  const newestRead = [...readIds].reverse();
  const newestSaved = [...savedIds].reverse();

  for (
    let index = 0;
    index < Math.max(newestRead.length, newestSaved.length);
    index += 1
  ) {
    for (const id of [newestRead[index], newestSaved[index]]) {
      if (id && !seen.has(id)) {
        seen.add(id);
        seeds.push({ id, mark: read.has(id) ? "read" : "saved" });
      }
    }
  }

  return seeds.slice(0, maxSeeds);
}

export function recommendFromReading(
  input: LocalRecommendInput,
  cutoff: Partial<LocalRecommendCutoff> = {}
): LocalRecommendation[] {
  const settings = { ...defaultLocalRecommendCutoff, ...cutoff };
  const { pool } = input;

  // A flat pool (one signal, identical vectors) has no meaningful floor.
  if (pool.ids.length < 2 || pool.deviation < 1e-9 || settings.limit <= 0) {
    return [];
  }

  const indexById = new Map(pool.ids.map((id, index) => [id, index]));
  const seeds = selectSeeds(
    input.readIds,
    input.savedIds,
    settings.maxSeeds
  ).filter((seed) => indexById.has(seed.id));

  if (seeds.length === 0) {
    return [];
  }

  const excluded = new Set([...input.readIds, ...input.savedIds]);
  const threshold = pool.mean + settings.minZ * pool.deviation;
  const followed = input.followedTagIds ?? [];
  const candidates: (LocalRecommendation & { rank: number })[] = [];

  pool.ids.forEach((id, index) => {
    if (excluded.has(id)) {
      return;
    }

    let best: { seed: (typeof seeds)[number]; score: number } | undefined;

    for (const seed of seeds) {
      const score = dot(
        pool.vectors[index],
        pool.vectors[indexById.get(seed.id) as number]
      );

      // Ties go to the more recent seed, which comes first.
      if (!best || score > best.score) {
        best = { seed, score };
      }
    }

    if (!best || best.score < threshold) {
      return;
    }

    const tagIds = pool.cards.get(id)?.tagIds ?? [];
    const matchedTagIds = followed.filter((tagId) => tagIds.includes(tagId));

    candidates.push({
      id,
      score: best.score,
      seedId: best.seed.id,
      seedMark: best.seed.mark,
      matchedTagIds,
      rank:
        best.score +
        (matchedTagIds.length > 0 ? settings.topicBoost * pool.deviation : 0)
    });
  });

  candidates.sort((a, b) => b.rank - a.rank || b.score - a.score);

  const perSeed = new Map<string, number>();
  const picked: LocalRecommendation[] = [];

  for (const candidate of candidates) {
    const used = perSeed.get(candidate.seedId) ?? 0;

    if (used >= settings.maxPerSeed) {
      continue;
    }

    perSeed.set(candidate.seedId, used + 1);
    picked.push({
      id: candidate.id,
      score: candidate.score,
      seedId: candidate.seedId,
      seedMark: candidate.seedMark,
      matchedTagIds: candidate.matchedTagIds
    });

    if (picked.length >= settings.limit) {
      break;
    }
  }

  return picked;
}

const maxSeedTitleLength = 28;

/**
 * The one line each card carries. It names the seed the score came from, and
 * mentions followed topics only when they actually lifted the card.
 */
export function describeRecommendationReason({
  seedTitle,
  seedMark,
  matchedTagNames = [],
  locale = "zh"
}: {
  seedTitle: string;
  seedMark: SeedMark;
  matchedTagNames?: string[];
  locale?: Locale;
}): string {
  return signalsCopy[locale].recommend.reason(
    seedMark === "read" ? "read" : "saved",
    compactText(seedTitle, maxSeedTitleLength),
    matchedTagNames.slice(0, 2)
  );
}

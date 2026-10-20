/**
 * Measures how often 「和你读过的相近」 has something to show, on the current
 * published pool.
 *
 *   node scripts/run-ts.cjs scripts/measure-local-recommend.ts
 *   node scripts/run-ts.cjs scripts/measure-local-recommend.ts --created-before 2026-10-14 --draws 500
 *
 * Builds the same recommendation data file the server serves
 * (`/signal-vectors.json`, `src/lib/local-recommend-vectors.ts`), decodes it
 * as the browser does, and runs the browser's own scoring
 * (`recommendFromReading` in `src/lib/local-recommend.ts`) for every signal as
 * a reader's single mark, and for `--draws` random sets of three marks. It
 * reports, per cutoff (the shipped mean + 2.5 standard deviations, and 2 and
 * 3 beside it), how many single-mark readers get at least one card, how many
 * cards they get on average, and the same for three marks on the home page
 * (3 cards) and the 稍后读 view (4 cards).
 *
 * `--created-before <date>` drops the signals published from that day on, so
 * an earlier pool can be re-measured with today's code (the 2026-10-13
 * numbers were taken on 110 signals; 2026-10-14 reproduces that pool).
 *
 * Read-only against the stores; the only write is search's vector cache
 * (`.cache/search-embeddings.json`). Runs the local model; calls no API.
 */
import { gzipSync } from "node:zlib";

import { getAllTechnologies } from "../src/lib/content";
import { embedPassages } from "../src/lib/embeddings";
import {
  decodeSignalVectorFile,
  defaultLocalRecommendCutoff,
  recommendFromReading,
  type DecodedSignalPool
} from "../src/lib/local-recommend";
import {
  buildSignalVectorFile,
  toPublishedSignalCard
} from "../src/lib/local-recommend-vectors";
import { getSearchDocuments } from "../src/lib/search";
import { getTechnologyWorkspaceRecords } from "../src/lib/technology-draft-workflow";

function readArgs(): { createdBefore?: string; draws: number } {
  const args = process.argv.slice(3);
  const value = (name: string) => {
    const index = args.indexOf(name);

    return index >= 0 ? args[index + 1] : undefined;
  };
  const createdBefore = value("--created-before");

  if (
    createdBefore !== undefined &&
    !/^\d{4}-\d{2}-\d{2}$/.test(createdBefore)
  ) {
    throw new Error(
      `--created-before takes a YYYY-MM-DD date, got ${createdBefore}`
    );
  }

  return {
    createdBefore,
    draws: Math.max(1, Number(value("--draws") ?? 500) || 500)
  };
}

/** A small seeded generator, so a re-run draws the same random marks. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawDistinct(
  count: number,
  from: number,
  random: () => number
): number[] {
  const picked = new Set<number>();

  while (picked.size < count) {
    picked.add(Math.floor(random() * from));
  }

  return [...picked];
}

interface Coverage {
  /** Readers (or draws) with at least one recommendation. */
  covered: number;
  total: number;
  /** Recommendations per reader, over every reader. */
  meanCards: number;
  /** How many readers got 0, 1, 2 … cards. */
  byCount: number[];
}

function summarize(counts: number[]): Coverage {
  const byCount: number[] = [];

  for (const count of counts) {
    byCount[count] = (byCount[count] ?? 0) + 1;
  }

  return {
    covered: counts.filter((count) => count > 0).length,
    total: counts.length,
    meanCards: counts.reduce((sum, count) => sum + count, 0) / counts.length,
    byCount: Array.from({ length: byCount.length }, (_, i) => byCount[i] ?? 0)
  };
}

function measure(
  pool: DecodedSignalPool,
  minZ: number,
  limit: number,
  seeds: string[][]
): Coverage {
  return summarize(
    seeds.map(
      (readIds) =>
        recommendFromReading({ pool, readIds, savedIds: [] }, { minZ, limit })
          .length
    )
  );
}

const percent = (numerator: number, denominator: number) =>
  `${Math.round((numerator / denominator) * 100)}%`;

function describe(coverage: Coverage): string {
  return `${coverage.covered}/${coverage.total} (${percent(coverage.covered, coverage.total)})\t均 ${coverage.meanCards.toFixed(2)} 条\t分布 ${coverage.byCount.join("/")}`;
}

async function main() {
  const { createdBefore, draws } = readArgs();
  const excluded = new Set(
    createdBefore
      ? getTechnologyWorkspaceRecords()
          .filter((record) => record.createdAt.slice(0, 10) >= createdBefore)
          .map((record) => record.id)
      : []
  );
  const cards = getAllTechnologies()
    .filter((technology) => !excluded.has(technology.id))
    .map(toPublishedSignalCard);
  const documents = getSearchDocuments();
  const startedAt = Date.now();
  const vectors = await embedPassages(
    documents.map((document) => document.embedText)
  );
  const file = buildSignalVectorFile({ documents, vectors }, cards);
  const pool = decodeSignalVectorFile(file);

  if (!pool) {
    throw new Error("the recommendation file did not decode");
  }

  const json = JSON.stringify(file);

  console.log(
    `已发布信号 ${cards.length} 条${createdBefore ? `（去掉 ${createdBefore} 起创建的 ${excluded.size} 条）` : ""}，向量 ${Date.now() - startedAt}ms；文件 ${(json.length / 1024).toFixed(0)} KB，gzip ${(gzipSync(json).length / 1024).toFixed(0)} KB`
  );
  console.log(
    `配对分数均值 ${pool.mean.toFixed(4)}，标准差 ${pool.deviation.toFixed(4)}；上线门槛 minZ ${defaultLocalRecommendCutoff.minZ} → ${(pool.mean + defaultLocalRecommendCutoff.minZ * pool.deviation).toFixed(4)}`
  );

  const single = pool.ids.map((id) => [id]);
  const random = createRandom(20261020);
  const triples = Array.from({ length: draws }, () =>
    drawDistinct(3, pool.ids.length, random).map((index) => pool.ids[index])
  );

  for (const minZ of [2, defaultLocalRecommendCutoff.minZ, 3]) {
    const shipped = minZ === defaultLocalRecommendCutoff.minZ ? "（上线）" : "";

    console.log(`\nminZ ${minZ}${shipped}`);
    console.log(
      `  1 条记录，首页（最多 ${defaultLocalRecommendCutoff.limit} 条，同一来源最多 ${defaultLocalRecommendCutoff.maxPerSeed} 条）\t${describe(measure(pool, minZ, defaultLocalRecommendCutoff.limit, single))}`
    );
    console.log(
      `  3 条随机记录 × ${draws}，首页（最多 3 条）\t${describe(measure(pool, minZ, 3, triples))}`
    );
    console.log(
      `  3 条随机记录 × ${draws}，稍后读（最多 4 条）\t${describe(measure(pool, minZ, 4, triples))}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Scores keyword, semantic and hybrid search against eval/search/queries.json.
 *
 *   npm run eval:search              # tune + test, current cutoff
 *   npm run eval:search -- --grid    # sweep the cutoff on the tune split only
 *
 * Runs the same ranking functions the /search page runs, over the live public
 * corpus, with the local embedding model. Nothing here calls an API.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import {
  cosine,
  embedPassages,
  embedQuery,
  EMBEDDING_MODEL
} from "../src/lib/embeddings";
import { rankDocumentsHybrid } from "../src/lib/hybrid-search";
import {
  defaultSemanticCutoff,
  type SemanticCutoff
} from "../src/lib/hybrid-search-ranking";
import {
  getSearchDocuments,
  parseQueryTerms,
  searchGroups,
  type SearchDocument
} from "../src/lib/search";

interface EvalQuery {
  id: string;
  split: "tune" | "test";
  query: string;
  relevant: string[];
}

type Mode = "keyword" | "semantic" | "hybrid";

interface QueryOutcome {
  id: string;
  query: string;
  returned: string[];
  relevantFound: string[];
  relevantMissed: string[];
  firstRelevantRank?: number;
}

const root = process.cwd();
const queriesPath = path.join(root, "eval", "search", "queries.json");
const resultsDir = path.join(root, "eval", "search", "results");

function flattenInPageOrder(
  grouped: ReturnType<typeof rankDocumentsHybrid>,
  keyToEval: Map<string, string>
): string[] {
  // The page shows groups in a fixed order (signals, skills, knowledge), each
  // already ranked. That is the order a reader scans, so it is the order MRR
  // is measured in.
  return searchGroups.flatMap((group) =>
    grouped[group].map((item) => keyToEval.get(item.key) as string)
  );
}

function runMode(
  mode: Mode,
  documents: SearchDocument[],
  query: EvalQuery,
  scores: number[],
  cutoff: SemanticCutoff,
  keyToEval: Map<string, string>
): QueryOutcome {
  const { terms } = parseQueryTerms(query.query);
  const grouped = rankDocumentsHybrid(
    documents,
    mode === "semantic" ? [] : terms,
    mode === "keyword" ? undefined : scores,
    cutoff
  );
  const returned = flattenInPageOrder(grouped, keyToEval);
  const relevant = new Set(query.relevant);
  const firstIndex = returned.findIndex((key) => relevant.has(key));

  return {
    id: query.id,
    query: query.query,
    returned,
    relevantFound: query.relevant.filter((key) => returned.includes(key)),
    relevantMissed: query.relevant.filter((key) => !returned.includes(key)),
    firstRelevantRank: firstIndex >= 0 ? firstIndex + 1 : undefined
  };
}

interface Summary {
  queries: number;
  hitRate: number;
  recall: number;
  precision: number;
  mrr: number;
  meanReturned: number;
  negatives: number;
  negativesWithResults: number;
  meanReturnedOnNegatives: number;
}

function summarize(queries: EvalQuery[], outcomes: QueryOutcome[]): Summary {
  const positive = outcomes.filter(
    (_, index) => queries[index].relevant.length > 0
  );
  const negative = outcomes.filter(
    (_, index) => queries[index].relevant.length === 0
  );
  const mean = (values: number[]) =>
    values.length === 0
      ? 0
      : values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    queries: positive.length,
    hitRate: mean(positive.map((o) => (o.relevantFound.length > 0 ? 1 : 0))),
    recall: mean(
      positive.map(
        (o) =>
          o.relevantFound.length /
          (o.relevantFound.length + o.relevantMissed.length)
      )
    ),
    // A query that returns nothing has no precision to speak of; it is
    // counted in hit rate and recall instead of being scored 0 or 1 here.
    precision: mean(
      positive
        .filter((o) => o.returned.length > 0)
        .map((o) => o.relevantFound.length / o.returned.length)
    ),
    mrr: mean(
      positive.map((o) => (o.firstRelevantRank ? 1 / o.firstRelevantRank : 0))
    ),
    meanReturned: mean(positive.map((o) => o.returned.length)),
    negatives: negative.length,
    negativesWithResults: negative.filter((o) => o.returned.length > 0).length,
    meanReturnedOnNegatives: mean(negative.map((o) => o.returned.length))
  };
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function printTable(title: string, rows: Record<Mode, Summary>) {
  console.log(`\n== ${title} ==`);
  console.log(
    "mode      hit    recall  precision  MRR    returned  negatives-with-results"
  );
  for (const mode of ["keyword", "semantic", "hybrid"] as Mode[]) {
    const s = rows[mode];
    console.log(
      `${mode.padEnd(9)} ${pct(s.hitRate).padStart(6)} ${pct(s.recall).padStart(7)} ${pct(
        s.precision
      ).padStart(9)}  ${s.mrr.toFixed(3)}  ${s.meanReturned
        .toFixed(1)
        .padStart(
          8
        )}  ${s.negativesWithResults}/${s.negatives} (mean ${s.meanReturnedOnNegatives.toFixed(1)})`
    );
  }
}

async function main() {
  const grid = process.argv.includes("--grid");
  const file = JSON.parse(readFileSync(queriesPath, "utf8")) as {
    queries: EvalQuery[];
  };
  const documents = getSearchDocuments();
  const keyToEval = new Map(
    documents.map((document) => [document.link.key, document.evalKey])
  );
  const knownKeys = new Set(documents.map((document) => document.evalKey));

  for (const query of file.queries) {
    for (const key of query.relevant) {
      if (!knownKeys.has(key)) {
        throw new Error(`${query.id}: unknown relevant item ${key}`);
      }
    }
  }

  const started = Date.now();
  const vectors = await embedPassages(documents.map((d) => d.embedText));
  console.log(
    `${documents.length} documents embedded with ${EMBEDDING_MODEL} in ${Date.now() - started}ms`
  );

  const scoresById = new Map<string, number[]>();
  for (const query of file.queries) {
    const queryVector = await embedQuery(query.query);
    scoresById.set(
      query.id,
      vectors.map((vector) => cosine(queryVector, vector))
    );
  }

  const splitQueries = (split: EvalQuery["split"]) =>
    file.queries.filter((query) => query.split === split);

  const evaluate = (queries: EvalQuery[], mode: Mode, cutoff: SemanticCutoff) =>
    queries.map((query) =>
      runMode(
        mode,
        documents,
        query,
        scoresById.get(query.id) as number[],
        cutoff,
        keyToEval
      )
    );

  if (grid) {
    const tune = splitQueries("tune");
    console.log("\nCutoff sweep, tune split only (hybrid mode):");
    console.log(
      "minZ  limit   recall  precision  MRR    returned  negatives(mean)"
    );
    for (const minZ of [1.5, 1.75, 2, 2.25, 2.5, 2.75, 3]) {
      for (const perGroupLimit of [3, 5]) {
        const cutoff = { minZ, perGroupLimit };
        const s = summarize(tune, evaluate(tune, "hybrid", cutoff));
        console.log(
          `${minZ.toFixed(2)}  ${perGroupLimit}      ${pct(s.recall).padStart(6)} ${pct(
            s.precision
          ).padStart(9)}  ${s.mrr.toFixed(3)}  ${s.meanReturned
            .toFixed(1)
            .padStart(
              8
            )}  ${s.negativesWithResults}/${s.negatives} (${s.meanReturnedOnNegatives.toFixed(1)})`
        );
      }
    }

    // Best raw cosine per tune query, negatives marked. Kept because it is the
    // evidence for a relative cutoff: the English queries top out below the
    // off-topic Chinese ones, so no absolute floor separates them.
    console.log("\nBest semantic score per tune query:");
    for (const query of tune) {
      const scores = scoresById.get(query.id) as number[];
      console.log(
        `  ${Math.max(...scores).toFixed(4)}  ${query.relevant.length === 0 ? "NEG" : "   "}  ${query.query}`
      );
    }
    return;
  }

  const cutoff = defaultSemanticCutoff;
  const report: Record<string, unknown> = {
    model: EMBEDDING_MODEL,
    cutoff,
    generatedAt: new Date().toISOString()
  };

  for (const split of ["tune", "test"] as const) {
    const queries = splitQueries(split);
    const rows = {} as Record<Mode, Summary>;
    const outcomes = {} as Record<Mode, QueryOutcome[]>;

    for (const mode of ["keyword", "semantic", "hybrid"] as Mode[]) {
      outcomes[mode] = evaluate(queries, mode, cutoff);
      rows[mode] = summarize(queries, outcomes[mode]);
    }

    printTable(`${split} split (${queries.length} queries)`, rows);
    report[split] = { summary: rows, outcomes };
  }

  if (process.argv.includes("--verbose")) {
    const test = (report.test as { outcomes: Record<Mode, QueryOutcome[]> })
      .outcomes.hybrid;
    console.log("\nHybrid, test split, per query:");
    for (const outcome of test) {
      console.log(
        `  ${outcome.id} ${outcome.query}  returned=${outcome.returned.length}  found=${outcome.relevantFound.length}  missed=${outcome.relevantMissed.join(",") || "-"}`
      );
    }
  }

  mkdirSync(resultsDir, { recursive: true });
  const out = path.join(resultsDir, "hybrid-search.json");
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${path.relative(root, out)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

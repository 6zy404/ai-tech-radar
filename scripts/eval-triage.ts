/**
 * Evaluate LLM candidate triage against real editorial decisions.
 *
 *   npm run eval:triage                 # full test split
 *   npm run eval:triage -- --limit 40   # a quick sample
 *   npm run eval:triage -- --prompt v3 --fresh --since 2026-10-13
 *                                       # one prompt, blind rows from a date on
 *
 * Reads eval/triage/dataset.jsonl and eval/triage/fewshot.json (both produced
 * by `npm run build:triage-dataset`), runs the configured provider over the
 * test split, and compares it with two baselines that need no model:
 *
 * - majority: predict the most common label of the example split for
 *   everything. This is the number a model has to beat to be worth anything —
 *   on this data it is already ~60% accuracy with zero publish recall.
 * - rule: the existing pre-release flag, the same check the task runner
 *   auto-rejects on. It only ever says "reject", so it is reported as
 *   coverage + precision rather than folded into accuracy.
 *
 * Successful answers are cached per prompt version and model under
 * eval/triage/cache/, so an interrupted run resumes and a re-run costs
 * nothing. Failures are not cached and are retried on the next run.
 *
 * A mock run prints its numbers but writes no result file: the mock is a
 * keyword rule, and a committed "mock accuracy" would read like a model result.
 *
 * v3 also sees the titles the site had published in the 30 days before each
 * row's decision, read from the technology workspace store (a record counts
 * from its createdAt, its conversion time). Nothing published after the
 * decision, and never the row's own signal.
 */

import fs from "node:fs";
import path from "node:path";
import { fetchArticleExcerpt } from "@/lib/candidate-article";
import {
  TRIAGE_PROMPT_VERSION,
  TRIAGE_PROMPT_VERSIONS,
  PUBLISHED_TITLES_WINDOW_DAYS,
  runCandidateTriage,
  selectRecentPublishedTitles,
  triageLabels,
  type PublishedSignalTitle,
  type TriageExample,
  type TriageLabel,
  type TriagePromptVersion,
  type TriageSuggestion
} from "@/lib/candidate-llm-triage";
import {
  computeClassificationReport,
  percentile,
  type ClassificationReport
} from "@/lib/classification-metrics";
import { createConfiguredLlmProvider } from "@/lib/llm/providers";
import { evaluateCandidateQuality } from "@/lib/quality-signals";
import { getTechnologyWorkspaceRecords } from "@/lib/technology-draft-workflow";
import type { ImportedCandidate } from "@/types/content";

interface DatasetRow extends TriageExample {
  id: string;
  split: "examples" | "test";
  decidedAt: string;
  /** Decided after the v1 eval, with no suggestion on screen (build-triage-dataset). */
  fresh?: boolean;
}

interface Outcome {
  suggestion?: TriageSuggestion;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
}

interface CachedAnswer extends Outcome {
  id: string;
  suggestion: TriageSuggestion;
}

const evalDir = path.join(process.cwd(), "eval", "triage");

function readArgs() {
  const args = process.argv.slice(3);
  const value = (name: string) => {
    const index = args.indexOf(name);

    return index >= 0 ? args[index + 1] : undefined;
  };

  const prompt = value("--prompt");
  const promptVersion = prompt
    ? TRIAGE_PROMPT_VERSIONS.find((version) => version.endsWith(`-${prompt}`))
    : TRIAGE_PROMPT_VERSION;

  if (!promptVersion) {
    throw new Error(`unknown --prompt ${prompt}; use v1, v2 or v3`);
  }

  const since = value("--since");

  if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    throw new Error(`--since takes a YYYY-MM-DD date, got ${since}`);
  }

  return {
    limit: Number(value("--limit") ?? 0) || undefined,
    concurrency: Math.max(1, Number(value("--concurrency") ?? 4) || 4),
    promptVersion: promptVersion as TriagePromptVersion,
    // --fresh scores only the decisions made after the v1 eval with no
    // suggestion on screen: the one set a v2 prompt was not fitted to. v3 was
    // written after reading v2's errors on it, so for v3 it is not held out.
    fresh: args.includes("--fresh"),
    // --since keeps only rows decided on or after a day: with --fresh, the
    // blind rounds a prompt was not written against (v3: 2026-10-13 on).
    since
  };
}

// Article text is third-party content, so it is cached outside the tracked
// tree (.cache/ is git-ignored), keyed by URL, failures included — a page
// that refused once is not asked again on a re-run.
const articleCacheFile = path.join(
  process.cwd(),
  ".cache",
  "triage-articles.json"
);

async function withArticles(rows: DatasetRow[]): Promise<DatasetRow[]> {
  const cache: Record<string, { text?: string; error?: string }> =
    fs.existsSync(articleCacheFile)
      ? JSON.parse(fs.readFileSync(articleCacheFile, "utf8"))
      : {};
  let fetched = 0;

  await runPool(rows, 4, async (row) => {
    if (!cache[row.sourceUrl]) {
      const excerpt = await fetchArticleExcerpt(row.sourceUrl);
      cache[row.sourceUrl] = excerpt.ok
        ? { text: excerpt.text }
        : { error: excerpt.error };
      fetched += 1;
    }
  });

  fs.mkdirSync(path.dirname(articleCacheFile), { recursive: true });
  fs.writeFileSync(articleCacheFile, JSON.stringify(cache), "utf8");
  const readable = rows.filter((row) => cache[row.sourceUrl].text).length;
  console.log(
    `articles: ${readable}/${rows.length} readable, ${fetched} fetched this run`
  );

  return rows.map((row) => ({
    ...row,
    articleExcerpt: cache[row.sourceUrl].text,
    articleError: cache[row.sourceUrl].error
  }));
}

function readDataset(): DatasetRow[] {
  return fs
    .readFileSync(path.join(evalDir, "dataset.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as DatasetRow);
}

function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-");
}

function readCache(file: string): Map<string, CachedAnswer> {
  const cache = new Map<string, CachedAnswer>();

  if (!fs.existsSync(file)) {
    return cache;
  }

  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.trim()) {
      const answer = JSON.parse(line) as CachedAnswer;
      cache.set(answer.id, answer);
    }
  }

  return cache;
}

function isPrerelease(row: DatasetRow): boolean {
  const candidate = {
    originalTitle: row.title,
    originalSummary: row.summary,
    originalContent: row.content,
    sourceUrl: row.sourceUrl,
    publisherName: row.publisherName,
    publishDate: row.publishDate,
    tags: [],
    relatedCandidateIds: [],
    importStatus: "new"
  } as unknown as ImportedCandidate;

  return evaluateCandidateQuality(candidate).flags.includes(
    "prerelease_version"
  );
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await worker(item);
    }
  });

  await Promise.all(lanes);
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

function printReport(title: string, report: ClassificationReport<TriageLabel>) {
  console.log(`\n${title}`);
  console.log(
    `  accuracy ${percent(report.accuracy)}   macro-F1 ${report.macroF1.toFixed(3)}   failed ${report.failed}/${report.total}`
  );

  for (const label of triageLabels) {
    const metrics = report.perClass[label];
    console.log(
      `  ${label.padEnd(8)} precision ${percent(metrics.precision).padStart(6)}   recall ${percent(metrics.recall).padStart(6)}   support ${metrics.support}`
    );
  }
}

function printConfusion(report: ClassificationReport<TriageLabel>) {
  const columns = [...triageLabels, "none"] as const;

  console.log(
    `\n  actual \\ predicted ${columns.map((c) => c.padStart(8)).join("")}`
  );

  for (const actual of triageLabels) {
    console.log(
      `  ${actual.padEnd(18)} ${columns
        .map((column) => String(report.confusion[actual][column]).padStart(8))
        .join("")}`
    );
  }
}

/**
 * Next reads .env.local for the app; a plain script does not, so the LLM_*
 * keys the owner wrote there would be invisible here. Variables already set in
 * the shell win — loadEnvFile does not override them.
 */
function loadLocalEnv() {
  // EVAL_ENV_FILE lets a worktree borrow the main checkout's key, as eval:ask
  // does; the key is only read into this process.
  for (const file of [process.env.EVAL_ENV_FILE, ".env.local", ".env"]) {
    if (file && fs.existsSync(file)) {
      process.loadEnvFile(file);
    }
  }
}

async function main() {
  loadLocalEnv();
  const { limit, concurrency, promptVersion, fresh, since } = readArgs();
  const dataset = readDataset();
  const examples = JSON.parse(
    fs.readFileSync(path.join(evalDir, "fewshot.json"), "utf8")
  ) as TriageExample[];
  const exampleSplit = dataset.filter((row) => row.split === "examples");
  let testSplit = dataset.filter(
    (row) =>
      (fresh ? row.fresh : row.split === "test") &&
      (!since || row.decidedAt.slice(0, 10) >= since)
  );

  if (promptVersion !== "candidate-triage-v1") {
    testSplit = await withArticles(testSplit);
  }

  // As of each row's decision, so no row sees a signal published after it.
  const publishedTitles = new Map<string, PublishedSignalTitle[]>();

  if (promptVersion === "candidate-triage-v3") {
    const records = getTechnologyWorkspaceRecords();

    for (const row of testSplit) {
      publishedTitles.set(
        row.id,
        selectRecentPublishedTitles(records, row.decidedAt, {
          excludeCandidateId: row.id
        })
      );
    }
  }

  const shownCounts = [...publishedTitles.values()].map((list) => list.length);

  if (limit) {
    // Deterministic spread across the whole period rather than the first N,
    // which would all come from one or two editorial rounds.
    const step = testSplit.length / limit;
    testSplit = Array.from(
      { length: Math.min(limit, testSplit.length) },
      (_, i) => testSplit[Math.floor(i * step)]
    );
  }

  const provider = createConfiguredLlmProvider();
  const isMock = provider.name === "mock";
  const runKey = `${promptVersion}__${slug(provider.modelName)}`;
  const cacheFile = path.join(evalDir, "cache", `${runKey}.jsonl`);
  const cache = readCache(cacheFile);

  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });

  console.log(
    `triage eval — prompt ${promptVersion}, provider ${provider.name}, model ${provider.modelName}`
  );
  console.log(
    `${fresh ? "fresh" : "test"} items ${testSplit.length}${since ? ` (decided since ${since})` : ""}${limit ? ` (sampled from ${dataset.filter((r) => r.split === "test").length})` : ""}, few-shot examples ${examples.length}, cached ${cache.size}`
  );

  if (shownCounts.length > 0) {
    console.log(
      `published titles shown per item (last ${PUBLISHED_TITLES_WINDOW_DAYS} days before the decision): min ${Math.min(...shownCounts)}, p50 ${percentile(shownCounts, 0.5)}, max ${Math.max(...shownCounts)}`
    );
  }

  // --- baselines ---------------------------------------------------------
  const labelCounts = new Map<TriageLabel, number>();

  for (const row of exampleSplit) {
    labelCounts.set(row.label, (labelCounts.get(row.label) ?? 0) + 1);
  }

  const majority = [...labelCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const majorityReport = computeClassificationReport(
    triageLabels,
    testSplit.map((row) => ({ actual: row.label, predicted: majority }))
  );
  const ruleHits = testSplit.filter(isPrerelease);
  const ruleCorrect = ruleHits.filter((row) => row.label === "reject").length;

  printReport(`baseline: always "${majority}"`, majorityReport);
  console.log(
    `\nbaseline: pre-release rule — fires on ${ruleHits.length}/${testSplit.length}, editors rejected ${ruleCorrect}/${ruleHits.length}`
  );

  // --- model ---------------------------------------------------------------
  const results = new Map<string, Outcome>();
  let done = 0;
  let calls = 0;

  await runPool(testSplit, concurrency, async (row) => {
    const cached = cache.get(row.id);

    if (cached) {
      results.set(row.id, cached);
      return;
    }

    let result = await runCandidateTriage(row, examples, provider, {
      promptVersion,
      publishedTitles: publishedTitles.get(row.id)
    });
    calls += 1;

    if (!result.suggestion) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      result = await runCandidateTriage(row, examples, provider, {
        promptVersion,
        publishedTitles: publishedTitles.get(row.id)
      });
      calls += 1;
    }

    const outcome: Outcome = {
      suggestion: result.suggestion,
      promptTokens: result.tokenUsage?.promptTokens,
      completionTokens: result.tokenUsage?.completionTokens,
      latencyMs: result.latencyMs
    };
    results.set(row.id, outcome);

    if (outcome.suggestion && !isMock) {
      fs.appendFileSync(
        cacheFile,
        `${JSON.stringify({ id: row.id, ...outcome })}\n`,
        "utf8"
      );
    }

    done += 1;

    if (done % 25 === 0) {
      console.log(`  … ${done} new answers`);
    }
  });

  const predictions = testSplit.map((row) => ({
    actual: row.label,
    predicted: results.get(row.id)?.suggestion?.decision ?? null
  }));
  const report = computeClassificationReport(triageLabels, predictions);

  printReport(
    `model: ${provider.modelName}${isMock ? "  (MOCK — a keyword rule, not a model)" : ""}`,
    report
  );
  printConfusion(report);

  // review vs reject is the noisy boundary: the same kind of item (an rc tag)
  // was rejected 30 times and marked reviewed 9 times. Publish vs not is the
  // decision that matters and the one the labels agree on, so report it alone.
  const binaryLabels = ["publish", "skip"] as const;
  const toBinary = (label: TriageLabel | null) =>
    label === null ? null : label === "publish" ? "publish" : "skip";
  const binary = computeClassificationReport(
    binaryLabels,
    predictions.map(({ actual, predicted }) => ({
      actual: toBinary(actual) as "publish" | "skip",
      predicted: toBinary(predicted)
    }))
  );

  console.log(
    `\n  publish vs not: accuracy ${percent(binary.accuracy)}, publish precision ${percent(binary.perClass.publish.precision)}, publish recall ${percent(binary.perClass.publish.recall)}`
  );

  // Which suggestions are trustworthy enough to act on quickly?
  const confident = testSplit.filter(
    (row) => (results.get(row.id)?.suggestion?.confidence ?? 0) >= 0.8
  );
  const confidentCorrect = confident.filter(
    (row) => results.get(row.id)?.suggestion?.decision === row.label
  ).length;
  const all = [...results.values()];
  const latencies = all.map((result) => result.latencyMs);
  // Cached answers are included, so these are the cost of evaluating the
  // whole set, not of this invocation alone.
  const promptTokens = all.reduce(
    (sum, result) => sum + (result.promptTokens ?? 0),
    0
  );
  const completionTokens = all.reduce(
    (sum, result) => sum + (result.completionTokens ?? 0),
    0
  );
  const inputPrice = Number(process.env.TRIAGE_PRICE_INPUT_PER_M ?? NaN);
  const outputPrice = Number(process.env.TRIAGE_PRICE_OUTPUT_PER_M ?? NaN);
  const cost =
    Number.isFinite(inputPrice) && Number.isFinite(outputPrice)
      ? (promptTokens * inputPrice + completionTokens * outputPrice) / 1e6
      : undefined;

  console.log(
    `\n  confidence ≥ 0.8: ${confident.length}/${testSplit.length} items, ${percent(confident.length ? confidentCorrect / confident.length : 0)} correct`
  );
  console.log(
    `  tokens: ${promptTokens} in / ${completionTokens} out${cost !== undefined ? `, cost ≈ ${cost.toFixed(4)}` : " (set TRIAGE_PRICE_INPUT_PER_M / _OUTPUT_PER_M for a cost figure)"}`
  );
  console.log(
    `  latency p50 ${percentile(latencies, 0.5)}ms, p95 ${percentile(latencies, 0.95)}ms, provider calls this run ${calls}`
  );

  if (isMock) {
    console.log(
      "\nMock provider: no result file written. Set LLM_PROVIDER / LLM_API_KEY / LLM_BASE_URL / LLM_MODEL to evaluate a real model."
    );
    return;
  }

  const resultFile = path.join(
    evalDir,
    "results",
    `${runKey}${fresh ? "__fresh" : ""}${since ? `__since${since}` : ""}${limit ? `__sample${limit}` : ""}.json`
  );
  fs.mkdirSync(path.dirname(resultFile), { recursive: true });
  fs.writeFileSync(
    resultFile,
    JSON.stringify(
      {
        promptVersion,
        fresh,
        ...(since ? { since } : {}),
        model: provider.modelName,
        ranAt: new Date().toISOString(),
        testItems: testSplit.length,
        sampled: Boolean(limit),
        ...(shownCounts.length > 0
          ? {
              publishedTitles: {
                windowDays: PUBLISHED_TITLES_WINDOW_DAYS,
                asOf: "each row's decidedAt",
                perItem: {
                  min: Math.min(...shownCounts),
                  p50: percentile(shownCounts, 0.5),
                  max: Math.max(...shownCounts)
                }
              }
            }
          : {}),
        fewShotIds: examples.map((example) => (example as DatasetRow).id),
        baselines: {
          majority: { label: majority, report: majorityReport },
          prereleaseRule: {
            fires: ruleHits.length,
            editorsRejected: ruleCorrect
          }
        },
        report,
        publishVsNot: binary,
        confident: {
          threshold: 0.8,
          items: confident.length,
          correct: confidentCorrect
        },
        usage: { promptTokens, completionTokens, cost },
        latencyMs: {
          p50: percentile(latencies, 0.5),
          p95: percentile(latencies, 0.95)
        },
        predictions: testSplit.map((row) => ({
          id: row.id,
          title: row.title,
          actual: row.label,
          ...(results.get(row.id)?.suggestion ?? { decision: null })
        }))
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.log(`\nwrote ${path.relative(process.cwd(), resultFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

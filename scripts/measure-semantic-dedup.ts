/**
 * Measures semantic duplicate detection against hand-labelled history.
 *
 *   node scripts/run-ts.cjs scripts/measure-semantic-dedup.ts
 *       precision / recall per threshold, for candidate↔candidate and
 *       candidate↔published pairs, split by language pair, counting only what
 *       the existing deterministic rules do NOT already catch
 *   node scripts/run-ts.cjs scripts/measure-semantic-dedup.ts --unlabelled
 *       also writes eval/dedup/unlabelled.jsonl: pairs some threshold in the
 *       grid would flag that eval/dedup/labels.jsonl has no label for
 *       (git-ignored; label them and append to labels.jsonl before trusting a
 *       new number)
 *
 * Read-only against the stores. The corpus is eval/triage/dataset.jsonl
 * (every decided candidate's text, rebuilt from git history) plus the current
 * candidate snapshot, compared against the published signals in
 * technology-workspace.json. The only write besides the optional file above is
 * the vector cache (.cache/candidate-embeddings.json). Runs the local model;
 * calls no API. See eval/dedup/README.md for how the labels were made.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getDuplicateReasons } from "../src/lib/candidate-duplicate-rules";
import { embedPassages, EMBEDDING_MODEL } from "../src/lib/embeddings";
import {
  buildPublishedSignalFingerprints,
  evaluateCandidateQuality
} from "../src/lib/quality-signals";
import {
  CANDIDATE_VECTOR_CACHE_FILE,
  SEMANTIC_DEDUP_RULES,
  buildCandidateDedupText,
  buildSignalDedupTexts,
  cosineSimilarity,
  getDayDistance,
  getDedupLanguage,
  type DedupLanguage
} from "../src/lib/semantic-dedup";
import type { ImportedCandidate } from "../src/types/content";

const root = process.cwd();
const labelsPath = path.join(root, "eval", "dedup", "labels.jsonl");
const unlabelledPath = path.join(root, "eval", "dedup", "unlabelled.jsonl");

type Label = "same" | "event" | "different";
type PairKind = "candidate" | "published";
type LanguagePair = "zh-zh" | "en-en" | "cross";

interface LabelRow {
  kind: PairKind;
  a: string;
  b: string;
  label: Label;
}

interface Signal {
  id: string;
  status: string;
  sourceUrl: string;
  publishDate: string;
  sourceCandidateId?: string;
  title: { original: string; zh?: string; en?: string };
  summary: { original: string; zh?: string };
}

/**
 * Three ways to score a pair. `raw` is the plain cosine and is what ships;
 * the centred variants subtract the corpus mean (or each language's mean)
 * first. They were the obvious alternatives and are kept as comparison rows —
 * see eval/dedup/README.md for why they lost.
 */
const schemes = ["raw", "centred", "centredPerLanguage"] as const;
type Scheme = (typeof schemes)[number];

const grids: Record<Scheme, number[]> = {
  raw: [0.9, 0.91, 0.92, 0.93, 0.94, 0.95, 0.96, 0.97],
  centred: [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],
  centredPerLanguage: [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]
};

interface ScoredPair {
  kind: PairKind;
  a: string;
  b: string;
  aTitle: string;
  bTitle: string;
  days: number;
  languages: LanguagePair;
  /** Already caught by the deterministic rules. */
  deterministic: boolean;
  scores: Record<Scheme, number>;
  label?: Label;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

function loadCandidates(): ImportedCandidate[] {
  const byId = new Map<string, ImportedCandidate>();
  const reviewState = readJson<{
    items: Record<string, { convertedTechnologyId?: string }>;
  }>("config/candidate-review-state.json");

  for (const line of readFileSync(
    path.join(root, "eval", "triage", "dataset.jsonl"),
    "utf8"
  )
    .split("\n")
    .filter(Boolean)) {
    const row = JSON.parse(line) as Record<string, string>;

    byId.set(row.id, {
      id: row.id,
      sourceType: /\/releases\/tag\//i.test(row.sourceUrl)
        ? "github-release"
        : "rss-feed",
      sourceName: row.sourceName,
      sourceUrl: row.sourceUrl,
      originalTitle: row.title,
      originalSummary: row.summary ?? "",
      originalLanguage: row.language === "zh" ? "zh" : "en",
      publishDate: row.publishDate,
      publisherName: row.publisherName ?? "",
      normalizedType: "unknown",
      tags: [],
      importStatus: "new",
      relatedCandidateIds: [],
      rawPayload: {}
    } as ImportedCandidate);
  }

  const snapshot = readJson<{ candidates: ImportedCandidate[] }>(
    "config/imported-candidates.live.json"
  );

  for (const candidate of snapshot.candidates) {
    if (!byId.has(candidate.id)) {
      byId.set(candidate.id, { ...candidate, relatedCandidateIds: [] });
    }
  }

  return [...byId.values()].map((candidate) => ({
    ...candidate,
    convertedTechnologyId:
      reviewState.items[candidate.id]?.convertedTechnologyId
  }));
}

function pairKey(kind: PairKind, a: string, b: string): string {
  return kind === "published"
    ? `${kind}|${a}|${b}`
    : `${kind}|${[a, b].sort().join("|")}`;
}

function readLabels(): Map<string, Label> {
  if (!existsSync(labelsPath)) {
    return new Map();
  }

  return new Map(
    readFileSync(labelsPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const row = JSON.parse(line) as LabelRow;
        return [pairKey(row.kind, row.a, row.b), row.label] as const;
      })
  );
}

function meanOf(vectors: number[][]): number[] {
  return vectors[0].map(
    (_, index) =>
      vectors.reduce((sum, vector) => sum + vector[index], 0) / vectors.length
  );
}

function centre(vector: number[], mean: number[]): number[] {
  const centred = vector.map((value, index) => value - mean[index]);
  const norm = Math.sqrt(
    centred.reduce((sum, value) => sum + value * value, 0)
  );

  return centred.map((value) => value / norm);
}

function percent(numerator: number, denominator: number): string {
  return denominator === 0
    ? "—"
    : `${Math.round((numerator / denominator) * 100)}%`;
}

async function main() {
  const candidates = loadCandidates();
  const signals = readJson<{ records: Signal[] }>(
    "config/technology-workspace.json"
  ).records.filter((record) => record.status === "published");
  const labels = readLabels();
  const startedAt = Date.now();
  const candidateVectors = await embedPassages(
    candidates.map((candidate) =>
      buildCandidateDedupText(
        candidate.originalTitle,
        candidate.originalSummary
      )
    ),
    { cacheFile: CANDIDATE_VECTOR_CACHE_FILE }
  );
  const signalTexts = signals.map((signal) => buildSignalDedupTexts(signal));
  const flatSignalVectors = await embedPassages(
    signalTexts.flatMap((texts) => texts.map((text) => text.text)),
    { cacheFile: CANDIDATE_VECTOR_CACHE_FILE }
  );

  console.log(
    `模型 ${EMBEDDING_MODEL}；候选 ${candidates.length} 条，已发布信号 ${signals.length} 条；已标注 ${labels.size} 对；向量 ${Date.now() - startedAt}ms`
  );

  let offset = 0;
  const signalVectors = signalTexts.map((texts) => {
    const vectors = flatSignalVectors.slice(offset, offset + texts.length);
    offset += texts.length;
    return vectors;
  });
  const candidateLanguages = candidates.map((candidate) =>
    getDedupLanguage(candidate.originalTitle)
  );
  const allVectors = [...candidateVectors, ...flatSignalVectors];
  const allLanguages: DedupLanguage[] = [
    ...candidateLanguages,
    ...signalTexts.flatMap((texts) => texts.map((text) => text.language))
  ];
  const globalMean = meanOf(allVectors);
  const languageMean: Record<DedupLanguage, number[]> = {
    zh: meanOf(allVectors.filter((_, index) => allLanguages[index] === "zh")),
    en: meanOf(allVectors.filter((_, index) => allLanguages[index] === "en"))
  };
  const transform = (
    scheme: Scheme,
    vector: number[],
    language: DedupLanguage
  ): number[] =>
    scheme === "raw"
      ? vector
      : centre(
          vector,
          scheme === "centred" ? globalMean : languageMean[language]
        );
  const schemeCandidateVectors = {} as Record<Scheme, number[][]>;
  const schemeSignalVectors = {} as Record<Scheme, number[][][]>;

  for (const scheme of schemes) {
    schemeCandidateVectors[scheme] = candidateVectors.map((vector, index) =>
      transform(scheme, vector, candidateLanguages[index])
    );
    schemeSignalVectors[scheme] = signalVectors.map((vectors, index) =>
      vectors.map((vector, textIndex) =>
        transform(scheme, vector, signalTexts[index][textIndex].language)
      )
    );
  }

  const publishedFingerprints = buildPublishedSignalFingerprints(signals);
  const isRelease = (candidate: ImportedCandidate) =>
    candidate.sourceType === "github-release";
  const pairs: ScoredPair[] = [];
  const maxDays = 14;

  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const days = getDayDistance(
        candidates[left].publishDate,
        candidates[right].publishDate
      );

      if (
        isRelease(candidates[left]) ||
        isRelease(candidates[right]) ||
        days > maxDays
      ) {
        continue;
      }

      const scores = {} as Record<Scheme, number>;

      for (const scheme of schemes) {
        scores[scheme] = cosineSimilarity(
          schemeCandidateVectors[scheme][left],
          schemeCandidateVectors[scheme][right]
        );
      }

      pairs.push({
        kind: "candidate",
        a: candidates[left].id,
        b: candidates[right].id,
        aTitle: candidates[left].originalTitle,
        bTitle: candidates[right].originalTitle,
        days,
        languages:
          candidateLanguages[left] !== candidateLanguages[right]
            ? "cross"
            : candidateLanguages[left] === "zh"
              ? "zh-zh"
              : "en-en",
        deterministic:
          getDuplicateReasons(candidates[left], candidates[right]).length > 0,
        scores,
        label: labels.get(
          pairKey("candidate", candidates[left].id, candidates[right].id)
        )
      });
    }
  }

  candidates.forEach((candidate, index) => {
    if (isRelease(candidate)) {
      return;
    }

    signals.forEach((signal, signalIndex) => {
      const days = getDayDistance(candidate.publishDate, signal.publishDate);

      if (
        signal.id === candidate.convertedTechnologyId ||
        signal.sourceCandidateId === candidate.id ||
        days > maxDays
      ) {
        return;
      }

      const scores = {} as Record<Scheme, number>;

      for (const scheme of schemes) {
        scores[scheme] = Math.max(
          ...schemeSignalVectors[scheme][signalIndex].map((vector) =>
            cosineSimilarity(schemeCandidateVectors[scheme][index], vector)
          )
        );
      }

      pairs.push({
        kind: "published",
        a: candidate.id,
        b: signal.id,
        aTitle: candidate.originalTitle,
        bTitle: signal.title.zh ?? signal.title.original,
        days,
        // Every signal carries a Chinese version as well as its original, so
        // a candidate always has a same-language side to match; the split is
        // by the candidate's language.
        languages: candidateLanguages[index] === "zh" ? "zh-zh" : "en-en",
        deterministic: evaluateCandidateQuality(candidate, {
          publishedSignals: [publishedFingerprints[signalIndex]]
        }).flags.includes("already_published"),
        scores,
        label: labels.get(pairKey("published", candidate.id, signal.id))
      });
    });
  });

  const unlabelled = new Map<string, ScoredPair>();

  for (const kind of ["candidate", "published"] as const) {
    const ofKind = pairs.filter((pair) => pair.kind === kind);
    const sameTotal = ofKind.filter((pair) => pair.label === "same").length;
    const sameCaught = ofKind.filter(
      (pair) => pair.label === "same" && pair.deterministic
    ).length;
    const wronglyCaught = ofKind.filter(
      (pair) => pair.label === "different" && pair.deterministic
    ).length;

    console.log(
      `\n## ${kind === "candidate" ? "候选 ↔ 候选" : "候选 ↔ 已发布信号"}：「同一条」${sameTotal} 对，现有规则抓到 ${sameCaught} 对（另误抓无关 ${wronglyCaught} 对）`
    );

    for (const scheme of schemes) {
      for (const days of [3, 7]) {
        console.log(
          `\n${scheme}，相隔 ≤ ${days} 天；只计现有规则之外新增的命中。语言列为「同一条 / 命中」`
        );
        console.log(
          [
            "阈值",
            "新增",
            "同一条",
            "同一事件",
            "无关",
            "未标注",
            "精确率",
            "含同一事件",
            "合计召回",
            "zh-zh",
            "en-en",
            "cross"
          ].join("\t")
        );

        for (const threshold of grids[scheme]) {
          const flagged = ofKind.filter(
            (pair) =>
              !pair.deterministic &&
              pair.days <= days &&
              pair.scores[scheme] >= threshold
          );
          const same = flagged.filter((pair) => pair.label === "same").length;
          const event = flagged.filter((pair) => pair.label === "event").length;
          const missing = flagged.filter((pair) => pair.label === undefined);
          const labelled = flagged.length - missing.length;
          const byLanguage = (languages: LanguagePair) => {
            const subset = flagged.filter(
              (pair) => pair.languages === languages
            );
            return `${subset.filter((pair) => pair.label === "same").length}/${subset.length}`;
          };

          for (const pair of missing) {
            unlabelled.set(pairKey(pair.kind, pair.a, pair.b), pair);
          }

          console.log(
            [
              threshold.toFixed(2),
              flagged.length,
              same,
              event,
              labelled - same - event,
              missing.length,
              percent(same, labelled),
              percent(same + event, labelled),
              percent(sameCaught + same, sameTotal),
              byLanguage("zh-zh"),
              byLanguage("en-en"),
              byLanguage("cross")
            ].join("\t")
          );
        }
      }
    }
  }

  console.log("\n## 上线规则下新增的命中（现有规则之外）");

  for (const pair of pairs.filter(
    (item) =>
      !item.deterministic &&
      item.days <= SEMANTIC_DEDUP_RULES.maxDayDistance &&
      item.scores.raw >=
        (item.kind === "candidate"
          ? SEMANTIC_DEDUP_RULES.candidateThreshold
          : SEMANTIC_DEDUP_RULES.publishedThreshold)
  )) {
    console.log(
      [
        pair.kind === "candidate" ? "候选" : "已发布",
        pair.label ?? "未标注",
        `raw ${pair.scores.raw.toFixed(3)}`,
        `${pair.aTitle.slice(0, 36)} ‖ ${pair.bTitle.slice(0, 36)}`
      ].join("  ")
    );
  }

  console.log("\n## 现有规则抓不到的「同一条」，各自的分数");

  for (const pair of pairs
    .filter((item) => item.label === "same" && !item.deterministic)
    .sort((left, right) => right.scores.raw - left.scores.raw)) {
    console.log(
      [
        pair.kind === "candidate" ? "候选" : "已发布",
        pair.languages,
        `${pair.days.toFixed(0)}天`,
        `raw ${pair.scores.raw.toFixed(3)}`,
        `centred ${pair.scores.centred.toFixed(3)}`,
        `perLang ${pair.scores.centredPerLanguage.toFixed(3)}`,
        `${pair.aTitle.slice(0, 36)} ‖ ${pair.bTitle.slice(0, 36)}`
      ].join("  ")
    );
  }

  if (process.argv.includes("--unlabelled")) {
    writeFileSync(
      unlabelledPath,
      [...unlabelled.values()]
        .map((pair) =>
          JSON.stringify({
            kind: pair.kind,
            a: pair.a,
            b: pair.b,
            raw: Number(pair.scores.raw.toFixed(4)),
            days: pair.days,
            aTitle: pair.aTitle,
            bTitle: pair.bTitle
          })
        )
        .join("\n"),
      "utf8"
    );
    console.log(
      `\n未标注 ${unlabelled.size} 对 → ${path.relative(root, unlabelledPath)}`
    );
  }

  console.log(
    `\n上线的规则：候选之间 raw ≥ ${SEMANTIC_DEDUP_RULES.candidateThreshold}，对已发布 raw ≥ ${SEMANTIC_DEDUP_RULES.publishedThreshold}，相隔 ≤ ${SEMANTIC_DEDUP_RULES.maxDayDistance} 天，发布订阅源的条目不参与`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

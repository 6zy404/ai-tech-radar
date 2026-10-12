// Trial-imports candidate sources into a COPY of the data directory and
// reports, per source, what the project's own importer and quality rules make
// of them. Read-only with respect to the live site: it refuses to run unless
// LOCAL_DATA_DIR points somewhere other than the repository's config/ and the
// live checkout's config/.
//
//   LOCAL_DATA_DIR=<copy of config> node scripts/with-proxy-env.mjs \
//     node scripts/run-ts.cjs eval/source-trial/trial-import.ts <out.json>
//
// The trial list lives in trial-sources.json next to this file.
import fs from "node:fs";
import path from "node:path";

import {
  runCandidateAutoTriage,
  selectAutoRejections
} from "../../src/lib/candidate-auto-triage";
import {
  getCandidateIdsWithReviewDecision,
  getImportedCandidates
} from "../../src/lib/candidate-workflow";
import { getPublicNewsItems } from "../../src/lib/news";
import {
  buildPublishedSignalFingerprints,
  evaluateCandidateQuality
} from "../../src/lib/quality-signals";
import {
  createExternalSource,
  getExternalSources,
  runImportForSource,
  type ExternalSourceInput
} from "../../src/lib/source-workflow";
import { getPublishedTechnologyWorkspaceRecords } from "../../src/lib/technology-draft-workflow";

const dataDir = path.resolve(process.env.LOCAL_DATA_DIR ?? "config");
const forbidden = [
  path.resolve("config"),
  path.resolve("C:/Users/Administrator/ai-tech-radar/config")
].map((p) => p.toLowerCase());

if (!process.env.LOCAL_DATA_DIR || forbidden.includes(dataDir.toLowerCase())) {
  console.error(
    `拒绝运行：LOCAL_DATA_DIR 必须指向一份副本（当前 ${dataDir}）。`
  );
  process.exit(2);
}

const outPath =
  process.argv[3] ?? path.join(dataDir, "..", "trial-result.json");
const trial: Array<ExternalSourceInput & { maxItems?: number }> = JSON.parse(
  fs.readFileSync(path.join(__dirname, "trial-sources.json"), "utf8")
);

async function main() {
  const existing = new Set(getExternalSources().map((s) => s.url));
  const created: string[] = [];

  for (const input of trial) {
    if (existing.has(input.url)) continue;
    const { maxItems, ...rest } = input;
    const source = createExternalSource({ ...rest, enabled: true });
    created.push(source.id);
    // createExternalSource always writes maxItems 4; the live sources run at 12.
    const storePath = path.join(dataDir, "external-sources.json");
    const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
    store.sources = store.sources.map((s: { id: string }) =>
      s.id === source.id ? { ...s, maxItems: maxItems ?? 12 } : s
    );
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  }

  const importResults = [];
  for (const id of created) {
    const started = Date.now();
    const result = await runImportForSource(id, {
      useFallbackOnFailure: false
    });
    importResults.push({
      id,
      name: result.source.name,
      status: result.status,
      message: result.message,
      created: result.candidatesCreated,
      ms: Date.now() - started
    });
    console.log(`${result.source.name}: ${result.status} — ${result.message}`);
  }

  const published = buildPublishedSignalFingerprints(
    getPublishedTechnologyWorkspaceRecords()
  );
  const candidates = getImportedCandidates();
  const autoRejections = selectAutoRejections(
    candidates,
    published,
    getCandidateIdsWithReviewDecision()
  );
  const autoById = new Map(autoRejections.map((r) => [r.candidateId, r.flag]));
  // Apply the same auto-reject the task runner does after an import, so the
  // news-lane count matches what readers would actually see.
  runCandidateAutoTriage();
  const news = getPublicNewsItems();

  const perSource = importResults.map((r) => {
    const own = candidates.filter((c) => c.sourceId === r.id);
    return {
      ...r,
      candidates: own.map((c) => {
        const q = evaluateCandidateQuality(c, { publishedSignals: published });
        return {
          title: c.originalTitle,
          date: c.publishDate,
          url: c.sourceUrl,
          summaryLength: (c.originalSummary ?? "").trim().length,
          contentLength: (c.originalContent ?? "").trim().length,
          summary: (c.originalSummary ?? "").slice(0, 280),
          duplicateGroupId: c.duplicateGroupId,
          flags: q.flags,
          autoReject: autoById.get(c.id)
        };
      }),
      newsLaneItems: news.filter((n) => n.sourceName === r.name).length
    };
  });

  const laneBySource: Record<string, number> = {};
  for (const n of news)
    laneBySource[n.sourceName] = (laneBySource[n.sourceName] ?? 0) + 1;

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { dataDir, ranAt: new Date().toISOString(), perSource, laneBySource },
      null,
      2
    )
  );
  console.log(`结果：${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

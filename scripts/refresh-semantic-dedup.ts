/**
 * Runs the post-import semantic dedup once, by hand, and prints what it found
 * and how long it took — the same call the task runner makes after the daily
 * import.
 *
 *   node scripts/run-ts.cjs scripts/refresh-semantic-dedup.ts
 *
 * Writes `candidate-semantic-matches.json` in the data directory the launcher
 * prints (a regenerable cache — it changes which duplicate groups exist, and
 * so which items the 全部快讯 lane hides, but no candidate's status), and the
 * vector cache under `.cache/`. Not needed day to day: the next scheduled
 * import does the same.
 */
import { getSemanticCandidatePairs, getSemanticPublishedMatches } from "../src/lib/semantic-dedup-store";
import { refreshSemanticDuplicateMatches } from "../src/lib/semantic-dedup-refresh";

async function main() {
  const summary = await refreshSemanticDuplicateMatches();

  console.log(summary.message);

  for (const pair of getSemanticCandidatePairs()) {
    console.log(`同组 ${pair.score.toFixed(3)}  ${pair.leftId} ↔ ${pair.rightId}`);
  }

  for (const [candidateId, match] of getSemanticPublishedMatches()) {
    console.log(
      `疑似已发布 ${match.score.toFixed(3)}  ${candidateId} → ${match.technologyTitle}`
    );
  }

  // The model keeps the event loop alive after a timeout; nothing else is pending.
  process.exit(summary.status === "failed" ? 1 : 0);
}

main();

#!/usr/bin/env node

/**
 * Rebuild the candidate-triage evaluation set from git history.
 *
 * The review-state file keeps only each editorial decision (`importStatus` +
 * `reviewedAt`), never the candidate text, and the candidate snapshot is a
 * rolling window: on 2026-09-23 it held 146 candidates against 630 decisions.
 * But every editorial round committed the snapshot, so the text of almost every
 * decided candidate still exists in some past commit. This script walks those
 * commits newest-first, keeps the newest copy of each candidate, and joins it
 * to the decision recorded at HEAD.
 *
 * Output: eval/triage/dataset.jsonl — one decided candidate per line, labelled
 * publish / review / reject, with a time-based split (see SPLIT_DATE) — and
 * eval/triage/fewshot.json, the examples the model is shown. Read-only against
 * the stores; it only writes those two files.
 *
 * Since 2026-10-15 the snapshot is not in the public history (it held
 * third-party article text, removed from every commit), and it is no longer
 * committed, so a decided candidate's text lives in one of two places: the
 * live snapshot in the data directory (rounds since 10-15, until the rolling
 * window drops them) or a commit in the private full-history bundle (rounds
 * before). The live file is read first; the history is walked in the current
 * repository, or in the clone `--history <git dir>` (or TRIAGE_HISTORY_REPO)
 * names — see eval/triage/README.md.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SNAPSHOT = "config/imported-candidates.live.json";
const REVIEW_STATE = "config/candidate-review-state.json";
const OUTPUT = "eval/triage/dataset.jsonl";
const FEW_SHOT_OUTPUT = "eval/triage/fewshot.json";
const FEW_SHOT_PER_LABEL = 3;

/**
 * Decisions before this date form the example pool; decisions on or after it
 * are the test set. A time split rather than a random one, because a random
 * split lets the few-shot examples come from the same editorial round as the
 * item under test — the model would be shown the answer to its neighbour.
 */
const SPLIT_DATE = "2026-08-10";

/**
 * Decisions from this date on postdate the v1 eval, so they are the only
 * place a v2 prompt can be judged without having been fitted to the numbers.
 * A row is `fresh` when it is in that window, was not auto-rejected by the
 * task runner, and no suggestion was on screen when it was decided (see
 * isAnchored). That last condition is read from the live data directory,
 * whose suggestion and event stores are not in git.
 */
const FRESH_FROM = "2026-09-24";
const TEXT_LIMIT = 700;

const labelByStatus = {
  converted: "publish",
  reviewed: "review",
  rejected: "reject"
};

function git(args, cwd = process.cwd()) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024
  });
}

/** The repository whose history holds the snapshot commits. */
function readHistoryRepo() {
  const index = process.argv.indexOf("--history");

  if (index >= 0 && process.argv[index + 1]) {
    return path.resolve(process.argv[index + 1]);
  }

  return process.env.TRIAGE_HISTORY_REPO?.trim() || process.cwd();
}

function toPlainText(value) {
  if (!value) {
    return "";
  }

  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TEXT_LIMIT);
}

function readLiveStore(name, fallback) {
  const dir = process.env.LOCAL_DATA_DIR?.trim() || "config";
  const file = path.join(dir, name);

  return fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : fallback;
}

function main() {
  const suggestions =
    readLiveStore("candidate-triage-suggestions.json", {}).suggestions ?? {};
  const autoRejected = new Set(
    (readLiveStore("workflow-events.json", {}).events ?? [])
      .filter(
        (event) =>
          event.action === "candidate.status_updated" &&
          event.actorType === "task_runner"
      )
      .map((event) => event.entityId)
  );
  // A suggestion counts as seen when it existed before the decision and the
  // decision was not made in the console's blind mode.
  const isAnchored = (id, decision) => {
    const suggestion = suggestions[id];

    return (
      !decision.blind &&
      Boolean(suggestion) &&
      (suggestion.createdAt ?? "") <= (decision.reviewedAt ?? "")
    );
  };

  const historyRepo = readHistoryRepo();
  const shas = git(["log", "--format=%H", "--", SNAPSHOT], historyRepo)
    .trim()
    .split("\n")
    .filter(Boolean);
  const newestCopy = new Map();

  // The live snapshot first: it is newer than any commit, and since
  // 2026-10-15 it is the only place the latest rounds' candidates exist.
  for (const candidate of readLiveStore("imported-candidates.live.json", {})
    .candidates ?? []) {
    newestCopy.set(candidate.id, candidate);
  }

  if (shas.length === 0 && newestCopy.size === 0) {
    console.error(
      `No commit in ${historyRepo} holds ${SNAPSHOT} and the data directory has no live snapshot. The snapshot left the public history on 2026-10-15; pass --history <clone of the full-history bundle> (eval/triage/README.md).`
    );
    process.exit(1);
  }

  if (shas.length === 0) {
    console.warn(
      `No commit in ${historyRepo} holds ${SNAPSHOT}: only the live snapshot's candidates will have text. Pass --history <clone of the full-history bundle> for the rounds before 2026-10-15.`
    );
  }

  for (const sha of shas) {
    let snapshot;

    try {
      snapshot = JSON.parse(git(["show", `${sha}:${SNAPSHOT}`], historyRepo));
    } catch {
      continue;
    }

    for (const candidate of snapshot.candidates ?? []) {
      if (!newestCopy.has(candidate.id)) {
        newestCopy.set(candidate.id, candidate);
      }
    }
  }

  const review = JSON.parse(git(["show", `HEAD:${REVIEW_STATE}`]));
  const decisions = review.items ?? {};
  const rows = [];
  const missing = [];
  let skippedFallback = 0;

  for (const [id, decision] of Object.entries(decisions)) {
    const label = labelByStatus[decision.importStatus];

    if (!label) {
      continue;
    }

    const candidate = newestCopy.get(id);

    if (!candidate) {
      missing.push(id);
      continue;
    }

    if ((candidate.tags ?? []).includes("fallback")) {
      skippedFallback += 1;
      continue;
    }

    const decidedAt = decision.reviewedAt ?? "";

    rows.push({
      id,
      label,
      split: decidedAt.slice(0, 10) < SPLIT_DATE ? "examples" : "test",
      decidedAt,
      title: candidate.originalTitle ?? "",
      summary: toPlainText(candidate.originalSummary),
      content: toPlainText(candidate.originalContent),
      sourceName: candidate.sourceName ?? "",
      sourceUrl: candidate.sourceUrl ?? "",
      publisherName: candidate.publisherName ?? "",
      publishDate: candidate.publishDate ?? "",
      language: candidate.originalLanguage ?? "",
      fresh:
        decidedAt.slice(0, 10) >= FRESH_FROM &&
        !autoRejected.has(id) &&
        !isAnchored(id, decision),
      // Decided in the console's blind mode (no suggestion shown), as the
      // review state records it; every blind row is fresh, not every fresh
      // row is blind.
      blind: Boolean(decision.blind)
    });
  }

  rows.sort(
    (a, b) => a.decidedAt.localeCompare(b.decidedAt) || a.id.localeCompare(b.id)
  );

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(
    OUTPUT,
    rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "utf8"
  );

  // The examples shown to the model: the most recent decisions per label
  // from the example split, skipping title-only items (an example with no
  // text teaches nothing). Most recent, because editorial standards moved
  // over the months and the latest ones are closest to the test period.
  // At most one per source within a label: the first version of this picked
  // all three publish examples from one blog and all three review examples
  // from one vendor, which teaches "the source decides" rather than the rubric.
  const fewShot = [];

  for (const label of ["publish", "review", "reject"]) {
    const usedSources = new Set();
    const pool = rows
      .filter(
        (row) =>
          row.split === "examples" &&
          row.label === label &&
          row.summary.length > 40
      )
      .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));

    for (const row of pool) {
      if (usedSources.size >= FEW_SHOT_PER_LABEL) {
        break;
      }

      if (!usedSources.has(row.sourceName)) {
        usedSources.add(row.sourceName);
        fewShot.push(row);
      }
    }
  }

  fs.writeFileSync(
    FEW_SHOT_OUTPUT,
    JSON.stringify(
      fewShot.map(
        ({
          split: _split,
          content: _content,
          fresh: _fresh,
          blind: _blind,
          ...row
        }) => row
      ),
      null,
      2
    ) + "\n",
    "utf8"
  );

  const count = (split, label) =>
    rows.filter(
      (row) =>
        (!split || row.split === split) && (!label || row.label === label)
    ).length;

  console.log(`snapshots walked: ${shas.length} (history: ${historyRepo})`);
  console.log(`decisions: ${Object.keys(decisions).length}`);
  console.log(`rows written: ${rows.length} -> ${OUTPUT}`);
  console.log(
    `skipped: ${missing.length} without text, ${skippedFallback} fallback placeholders`
  );

  const fresh = rows.filter((row) => row.fresh);
  console.log(
    `  fresh    ${String(fresh.length).padStart(4)}  publish ${fresh.filter((r) => r.label === "publish").length} / review ${fresh.filter((r) => r.label === "review").length} / reject ${fresh.filter((r) => r.label === "reject").length}  (decided since ${FRESH_FROM}, no suggestion on screen, not auto-rejected)`
  );

  for (const split of ["examples", "test"]) {
    console.log(
      `  ${split.padEnd(8)} ${String(count(split)).padStart(4)}  publish ${count(split, "publish")} / review ${count(split, "review")} / reject ${count(split, "reject")}`
    );
  }
}

main();

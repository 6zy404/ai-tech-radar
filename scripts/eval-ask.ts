/**
 * Scores 问雷达 against eval/ask/questions.json, with checks that need no
 * second model:
 *
 * - citation validity: every [n] must be a number some tool returned;
 * - grounding: an answerable question must cite at least one expected item;
 * - refusal: an unanswerable one must open with the fixed refusal phrase,
 *   and an answerable one must not.
 *
 *   npm run eval:ask
 *
 * Uses whatever LLM_* variables are set (it reads .env.local). With the mock
 * it prints numbers but writes no result file, like eval:triage.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  ASK_PROMPT_VERSION,
  runAskRadar,
  type AskEvent,
  type AskRunStats
} from "../src/lib/ask-radar";
import { siteAskTools } from "../src/lib/ask-radar-tools";
import { createConfiguredChatStream } from "../src/lib/llm/chat-clients";
import { percentile } from "../src/lib/classification-metrics";

// EVAL_ENV_FILE lets a checkout without its own .env.local (a git worktree)
// borrow another's; the key is read into this process and never printed.
for (const file of [process.env.EVAL_ENV_FILE, ".env.local", ".env"]) {
  if (!file) {
    continue;
  }

  try {
    process.loadEnvFile(file);
  } catch {
    // Missing file: fall through to whatever the shell provides.
  }
}

interface EvalQuestion {
  id: string;
  question: string;
  expected: string[];
  /**
   * Who wrote it. "outside" questions come from readers who had not seen the
   * corpus (eval/outside-questions/) and are reported separately, because
   * questions written with the corpus in view all passed. Absent = "builder".
   */
  author?: "builder" | "outside";
  /**
   * "partial": the site covers part of the question. A good answer uses what
   * the site has (grounded, not refused) and says what it does not cover —
   * which no string check can judge, so those answers are listed in the
   * result file for a person to read. `expected` lists the items covering
   * the covered part.
   */
  kind?: "partial";
}

interface Outcome {
  id: string;
  question: string;
  author: "builder" | "outside";
  partial: boolean;
  answerable: boolean;
  answer: string;
  refused: boolean;
  cited: string[];
  invalidCitations: number;
  citedExpected: string[];
  grounded: boolean;
  toolCalls: number;
  rounds: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  error?: string;
}

async function runOne(question: EvalQuestion): Promise<Outcome> {
  const client = createConfiguredChatStream();
  const started = Date.now();
  let stats: AskRunStats | undefined;
  let done: Extract<AskEvent, { type: "done" }> | undefined;
  let error: string | undefined;

  try {
    for await (const event of runAskRadar(question.question, {
      client,
      tools: siteAskTools,
      onStats: (value) => {
        stats = value;
      }
    })) {
      if (event.type === "done") {
        done = event;
      }
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  const byRef = new Map(
    (stats?.sources ?? []).map((source) => [source.ref, source.key])
  );
  const cited = (done?.cited ?? [])
    .map((ref) => byRef.get(ref))
    .filter((key): key is string => Boolean(key));
  const citedExpected = cited.filter((key) => question.expected.includes(key));

  return {
    id: question.id,
    question: question.question,
    author: question.author ?? "builder",
    partial: question.kind === "partial",
    answerable: question.expected.length > 0,
    answer: stats?.answer ?? "",
    refused: done?.refused ?? false,
    cited,
    invalidCitations: done?.invalid.length ?? 0,
    citedExpected,
    grounded: citedExpected.length > 0,
    toolCalls: stats?.toolCalls ?? 0,
    rounds: stats?.rounds ?? 0,
    latencyMs: Date.now() - started,
    promptTokens: stats?.usage.promptTokens ?? 0,
    completionTokens: stats?.usage.completionTokens ?? 0,
    error
  };
}

function pct(numerator: number, denominator: number) {
  return denominator === 0
    ? "—"
    : `${((numerator / denominator) * 100).toFixed(1)}% (${numerator}/${denominator})`;
}

async function main() {
  const file = JSON.parse(
    readFileSync(path.join("eval", "ask", "questions.json"), "utf8")
  ) as { questions: EvalQuestion[] };
  const model = createConfiguredChatStream().modelName;
  const isMock = model.startsWith("mock");
  console.log(
    `${file.questions.length} questions · ${ASK_PROMPT_VERSION} · ${model}${isMock ? " (mock: no result file)" : ""}`
  );

  const outcomes: Outcome[] = [];

  // Sequential on purpose: two dozen questions, and the rate the provider
  // sees should look like a reader, not a load test.
  for (const question of file.questions) {
    const outcome = await runOne(question);
    outcomes.push(outcome);
    const verdict = outcome.error
      ? `ERROR ${outcome.error}`
      : outcome.answerable
        ? outcome.refused
          ? "refused (should answer)"
          : outcome.grounded
            ? `grounded ${outcome.citedExpected.length}/${question.expected.length}`
            : `NOT grounded, cited ${outcome.cited.join(",") || "nothing"}`
        : outcome.refused
          ? "refused (correct)"
          : `ANSWERED (should refuse), cited ${outcome.cited.join(",") || "nothing"}`;
    const label = outcome.partial
      ? `partial · ${verdict} — read the answer`
      : verdict;
    console.log(
      `  ${outcome.id} ${label} · tools ${outcome.toolCalls} · ${outcome.latencyMs}ms`
    );
  }

  // Reported per author: the builder's questions all passed, so mixing an
  // outside set into them would only dilute what the outside set shows.
  const summary: Record<string, ReturnType<typeof summarize>> = {};
  for (const author of ["builder", "outside"] as const) {
    const group = outcomes.filter((o) => o.author === author);
    if (group.length > 0) {
      summary[author] = summarize(group);
    }
  }

  for (const [author, values] of Object.entries(summary)) {
    console.log(`\nSummary · ${author}`);
    for (const [key, value] of Object.entries(values)) {
      console.log(`  ${key.padEnd(28)} ${value}`);
    }
  }

  const partialToRead = outcomes
    .filter((o) => o.partial)
    .map(({ id, question, answer, cited }) => ({
      id,
      question,
      answer,
      cited
    }));

  if (isMock) {
    return;
  }

  const outDir = path.join("eval", "ask", "results");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(
    outDir,
    `${ASK_PROMPT_VERSION}__${model.replace(/[^A-Za-z0-9._-]/g, "_")}.json`
  );
  writeFileSync(
    outFile,
    `${JSON.stringify(
      {
        promptVersion: ASK_PROMPT_VERSION,
        model,
        generatedAt: new Date().toISOString(),
        summary,
        partialToRead,
        outcomes
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(`\nWrote ${outFile}`);
}

function summarize(group: Outcome[]) {
  const answerable = group.filter((o) => o.answerable && !o.partial);
  const unanswerable = group.filter((o) => !o.answerable);
  const partial = group.filter((o) => o.partial);
  const citations = group.reduce((sum, o) => sum + o.cited.length, 0);
  const invalid = group.reduce((sum, o) => sum + o.invalidCitations, 0);
  const latencies = group.map((o) => o.latencyMs);

  return {
    questions: group.length,
    answerableGrounded: pct(
      answerable.filter((o) => o.grounded && !o.refused).length,
      answerable.length
    ),
    answerableFalseRefusals: pct(
      answerable.filter((o) => o.refused).length,
      answerable.length
    ),
    answerableWithoutCitations: pct(
      answerable.filter((o) => !o.refused && o.cited.length === 0).length,
      answerable.length
    ),
    unanswerableRefused: pct(
      unanswerable.filter((o) => o.refused).length,
      unanswerable.length
    ),
    // Partial: used what the site has. Whether it named what the site lacks
    // is read by a person — see partialToRead in the result file.
    partialGroundedNotRefused: pct(
      partial.filter((o) => o.grounded && !o.refused).length,
      partial.length
    ),
    partialRefused: pct(
      partial.filter((o) => o.refused).length,
      partial.length
    ),
    invalidCitations: pct(invalid, citations + invalid),
    errors: group.filter((o) => o.error).length,
    meanToolCalls: (
      group.reduce((sum, o) => sum + o.toolCalls, 0) / group.length
    ).toFixed(2),
    latencyP50Ms: percentile(latencies, 0.5),
    latencyP95Ms: percentile(latencies, 0.95),
    promptTokens: group.reduce((sum, o) => sum + o.promptTokens, 0),
    completionTokens: group.reduce((sum, o) => sum + o.completionTokens, 0)
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

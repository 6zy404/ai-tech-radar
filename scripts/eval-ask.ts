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
}

interface Outcome {
  id: string;
  question: string;
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
    console.log(
      `  ${outcome.id} ${verdict} · tools ${outcome.toolCalls} · ${outcome.latencyMs}ms`
    );
  }

  const answerable = outcomes.filter((o) => o.answerable);
  const unanswerable = outcomes.filter((o) => !o.answerable);
  const citations = outcomes.reduce((sum, o) => sum + o.cited.length, 0);
  const invalid = outcomes.reduce((sum, o) => sum + o.invalidCitations, 0);
  const latencies = outcomes.map((o) => o.latencyMs);
  const summary = {
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
    invalidCitations: pct(invalid, citations + invalid),
    errors: outcomes.filter((o) => o.error).length,
    meanToolCalls: (
      outcomes.reduce((sum, o) => sum + o.toolCalls, 0) / outcomes.length
    ).toFixed(2),
    latencyP50Ms: percentile(latencies, 0.5),
    latencyP95Ms: percentile(latencies, 0.95),
    promptTokens: outcomes.reduce((sum, o) => sum + o.promptTokens, 0),
    completionTokens: outcomes.reduce((sum, o) => sum + o.completionTokens, 0)
  };

  console.log("\nSummary");
  for (const [key, value] of Object.entries(summary)) {
    console.log(`  ${key.padEnd(28)} ${value}`);
  }

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
        outcomes
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(`\nWrote ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

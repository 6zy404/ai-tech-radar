import { runBatchImportForEnabledSources } from "../src/lib/source-workflow";

async function main() {
  const { run, results } = await runBatchImportForEnabledSources();

  console.log(
    `Synced ${run.totalCandidatesCreated} new candidates from ${run.enabledSources} enabled sources; skipped ${run.totalCandidatesSkipped}.`
  );

  for (const result of results) {
    console.log(
      `- [${result.status}] ${result.source.name}: ${result.message}`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

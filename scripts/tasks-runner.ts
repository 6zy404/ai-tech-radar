import {
  runScheduledDeliveryTask,
  watchScheduledDeliveryTasks
} from "../src/lib/task-runner";

function getArgumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const argument = process.argv.find((item) => item.startsWith(prefix));

  return argument?.slice(prefix.length);
}

function getIntervalMs(): number {
  const rawValue =
    getArgumentValue("interval") ?? process.env.TASK_RUNNER_INTERVAL_SECONDS;
  const seconds = rawValue ? Number(rawValue) : 60;

  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 60_000;
}

async function main() {
  const mode =
    process.argv.find(
      (argument) => argument === "run-once" || argument === "watch"
    ) ?? "run-once";

  if (mode === "watch") {
    const controller = new AbortController();

    process.once("SIGINT", () => {
      console.log("Task runner received SIGINT. Shutting down...");
      controller.abort();
    });
    process.once("SIGTERM", () => {
      console.log("Task runner received SIGTERM. Shutting down...");
      controller.abort();
    });

    await watchScheduledDeliveryTasks({
      intervalMs: getIntervalMs(),
      signal: controller.signal,
      logger: console.log
    });

    return;
  }

  if (mode === "run-once") {
    await runScheduledDeliveryTask({
      mode: "run_once",
      logger: console.log
    });

    return;
  }

  console.error(
    "Usage: tsx scripts/tasks-runner.ts <run-once|watch> [--interval=60]"
  );
  process.exitCode = 1;
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Unknown task runner error."
  );
  process.exitCode = 1;
});

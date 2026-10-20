#!/usr/bin/env node
/**
 * Runs a command with this project's proxy environment applied.
 *
 * Usage:  node scripts/with-proxy-env.mjs <command> [args...]
 *
 * `NODE_USE_ENV_PROXY` is read at process **bootstrap**, so it cannot be set
 * from inside the app (see `proxy-env.mjs` for the measurement that settles
 * this). Wrapping the launch is therefore the only place the Next server and
 * the task runner can be given the same network path as each other.
 *
 * The child inherits stdio and this process mirrors its exit code, so the
 * wrapper is invisible to npm, to Task Scheduler, and to whatever reads the
 * cron log.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFileKeys } from "./env-file.mjs";
import { formatLogTimestamp, pipeWithTimestamps } from "./log-lines.mjs";
import {
  applyProxyEnvDefaults,
  getConfiguredProxyUrl,
  probeProxy
} from "./proxy-env.mjs";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

/**
 * Variables worth reading out of this checkout's `.env.local` before the
 * child starts (`env-file.mjs` has the parser and the reason Next's own
 * loading is too late):
 *
 * - the proxy settings. Reading them here makes the configuration work
 *   regardless of who launches the server: a terminal that exports the
 *   variables, a service manager that does not, or an IDE preview pane that
 *   starts with a bare environment (measured 2026-08-10 — the preview pane
 *   reported "未检测到代理配置" while the same command from a shell did not);
 * - the site address. The task runner sends scheduled digests and builds
 *   their links from `NEXT_PUBLIC_SITE_URL`, and until 2026-10-21 a run
 *   from Task Scheduler had no such variable at all, so every link would
 *   have read `http://localhost:3000` (the send paths now also refuse a
 *   local address, `src/lib/site-url.ts`).
 *
 * `LOCAL_DATA_DIR` is deliberately not read here: a worktree's
 * `tasks:run-once` writes the worktree's own copy, and `run-ts.cjs` prints
 * which directory a run used.
 */
const ENV_FILE_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "http_proxy",
  "https_proxy",
  "NO_PROXY",
  "no_proxy",
  "NODE_USE_ENV_PROXY",
  "NEXT_PUBLIC_SITE_URL"
];

/**
 * Resolves the target to something Node can execute directly.
 *
 * Spawning with `shell: true` would also work, but on Windows that is the only
 * way to reach a `.cmd` shim — and it emits `DEP0190` on every run, which would
 * land in `config/task-runner-cron.log` daily, and concatenates arguments
 * instead of escaping them. Running the package's JS entry point under the
 * current Node binary avoids both.
 */
function resolveTarget(command, args) {
  if (command === "node") {
    return { file: process.execPath, args, shell: false };
  }

  try {
    const binEntry = require.resolve(`${command}/dist/bin/${command}`);

    return { file: process.execPath, args: [binEntry, ...args], shell: false };
  } catch {
    // Unknown command: fall back to the shell so the wrapper stays usable for
    // one-off invocations, accepting the deprecation warning there.
    return { file: command, args, shell: process.platform === "win32" };
  }
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("用法：node scripts/with-proxy-env.mjs <命令> [参数...]");
  process.exit(2);
}

// `LOG_TIMESTAMPS=1` puts an ISO time in front of every line the child
// writes, and this launcher's own line, for a log that is only ever read
// after the fact — `config/server.log` from the server task had none
// (`log-lines.mjs`). Opt-in: it pipes the child's output instead of
// inheriting it, so the task's command line decides (docs/deployment.md →
// "Timestamps in the service logs").
const stampLogLines = process.env.LOG_TIMESTAMPS === "1";
const stamp = (line) =>
  stampLogLines ? `${formatLogTimestamp(new Date())} ${line}` : line;

const env = { ...process.env };
const loadedFromEnvFile = loadEnvFileKeys(
  path.join(repoRoot, ".env.local"),
  ENV_FILE_KEYS,
  env
);

// Probe the proxy before deciding. The live server's proxy runs only inside a
// logged-on session while the server task starts at boot, so a fresh reboot
// would otherwise route every outbound request into a dead port until someone
// logs in (found 2026-09-24). Direct connections reach the LLM provider and
// the source feeds from this machine, so a dead proxy means "go direct".
const proxyUrl = getConfiguredProxyUrl(env);
const probe = proxyUrl ? await probeProxy(proxyUrl) : undefined;
const outcome = applyProxyEnvDefaults(
  env,
  probe
    ? {
        proxyReachable: probe.reachable,
        proxyAddress: probe.address,
        proxyError: probe.error
      }
    : {}
);

// Always logged, including the "did nothing" case. Silence on the inactive
// branch is indistinguishable from the wrapper not running at all — which cost
// a real diagnostic detour the day this was written.
if (process.env.PROXY_ENV_QUIET !== "1") {
  const excluded =
    outcome.addedDirectHosts.length > 0
      ? `，直连例外：${outcome.addedDirectHosts.join(", ")}`
      : "";
  const source =
    loadedFromEnvFile.length > 0
      ? `（来自 .env.local：${loadedFromEnvFile.join(", ")}）`
      : "";

  console.log(stamp(`[proxy] ${outcome.reason}${excluded}${source}`));
}

const target = resolveTarget(command, args);

const child = spawn(target.file, target.args, {
  stdio: stampLogLines ? ["inherit", "pipe", "pipe"] : "inherit",
  env,
  shell: target.shell
});

if (stampLogLines) {
  pipeWithTimestamps(child.stdout, process.stdout);
  pipeWithTimestamps(child.stderr, process.stderr);
}

child.on("error", (error) => {
  console.error(stamp(`无法启动命令 ${command}：${error.message}`));
  process.exit(1);
});

// Mirror the child's fate exactly, so a signal-killed child is not reported as
// a clean exit — the failure mode that hid five Ctrl+C-killed task runs. With
// piped output, wait for `close` (both streams ended and flushed) rather than
// `exit`, or the last lines could be lost.
child.on(stampLogLines ? "close" : "exit", (code, signal) => {
  if (signal) {
    console.error(stamp(`命令被信号终止：${signal}`));
    process.exit(1);
  }

  process.exit(code ?? 0);
});

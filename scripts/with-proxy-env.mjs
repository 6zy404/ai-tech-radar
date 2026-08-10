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
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applyProxyEnvDefaults } from "./proxy-env.mjs";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

/** Variables worth reading out of `.env.local` before the child starts. */
const PROXY_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "http_proxy",
  "https_proxy",
  "NO_PROXY",
  "no_proxy",
  "NODE_USE_ENV_PROXY"
];

/**
 * Next loads `.env.local` itself, but only *after* bootstrap — too late for
 * `NODE_USE_ENV_PROXY`. Reading the proxy keys here makes the configuration
 * work regardless of who launches the server: a terminal that exports the
 * variables, a service manager that does not, or an IDE preview pane that
 * starts with a bare environment (measured 2026-08-10 — the preview pane
 * reported "未检测到代理配置" while the same command from a shell did not).
 *
 * Deliberately minimal: `KEY=VALUE`, `#` comments, optional surrounding
 * quotes. It is not a general dotenv implementation and only ever fills keys
 * the real environment has left unset, so an exported value always wins.
 */
function loadProxyKeysFromEnvFile(env) {
  const envFile = path.join(repoRoot, ".env.local");

  if (!existsSync(envFile)) {
    return [];
  }

  const loaded = [];

  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["'](.*)["']$/, "$1");

    if (!PROXY_KEYS.includes(key) || value.length === 0) {
      continue;
    }

    if ((env[key] ?? "").trim().length === 0) {
      env[key] = value;
      loaded.push(key);
    }
  }

  return loaded;
}

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

const env = { ...process.env };
const loadedFromEnvFile = loadProxyKeysFromEnvFile(env);
const outcome = applyProxyEnvDefaults(env);

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

  console.log(`[proxy] ${outcome.reason}${excluded}${source}`);
}

const target = resolveTarget(command, args);

const child = spawn(target.file, target.args, {
  stdio: "inherit",
  env,
  shell: target.shell
});

child.on("error", (error) => {
  console.error(`无法启动命令 ${command}：${error.message}`);
  process.exit(1);
});

// Mirror the child's fate exactly, so a signal-killed child is not reported as
// a clean exit — the failure mode that hid five Ctrl+C-killed task runs.
child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`命令被信号终止：${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 0);
});

/**
 * `fetch` for the internal workspace API, carrying the access token when one is
 * configured.
 *
 * Why this exists: editorial rounds drive `/api/workspace/*` and
 * `/api/candidates/*` over HTTP, and `src/middleware.ts` guards those prefixes
 * without looking at where the request came from. So the moment
 * `WORKSPACE_ACCESS_ENABLED=true` — which the tunnel deployment needs, because
 * a tunnel maps a hostname straight at the local port and cannot keep
 * `/workspace` private on its own — every round would start getting `401`
 * from localhost. This module is what makes "token on" and "rounds still work"
 * compatible.
 *
 * It is deliberately not clever: with no token configured it behaves exactly
 * like `fetch`, so nothing changes until the token is switched on.
 *
 * Usage:
 *   import { workspaceFetch } from "./workspace-fetch.mjs";
 *   await workspaceFetch("http://localhost:3000/api/candidates/x/status", {
 *     method: "POST",
 *     headers: { "content-type": "application/json" },
 *     body: JSON.stringify({ status: "rejected" })
 *   });
 *
 * Self-check (prints the status of any URL, with and without the token):
 *   node scripts/workspace-fetch.mjs http://localhost:3000/workspace
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const TOKEN_KEY = "WORKSPACE_ACCESS_TOKEN";
const ENABLED_KEY = "WORKSPACE_ACCESS_ENABLED";

/**
 * Minimal `KEY=VALUE` reader for `.env.local`.
 *
 * `scripts/with-proxy-env.mjs` carries a near-identical one. That duplication
 * is deliberate: the launcher is what makes the daily scheduled import take the
 * proxy, and it is not worth risking that path to save twenty lines here. If a
 * third caller ever needs this, extract it then — and re-verify the launcher by
 * running it, since it logs which keys it picked up.
 */
function readEnvFile(keys) {
  const envFile = path.join(repoRoot, ".env.local");
  const values = {};

  if (!existsSync(envFile)) {
    return values;
  }

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

    if (!keys.includes(key)) {
      continue;
    }

    values[key] = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["'](.*)["']$/, "$1");
  }

  return values;
}

/**
 * The real environment wins over `.env.local`, matching how the launcher and
 * Next both behave.
 */
function resolve(key) {
  const fromEnv = (process.env[key] ?? "").trim();

  if (fromEnv.length > 0) {
    return fromEnv;
  }

  return (readEnvFile([TOKEN_KEY, ENABLED_KEY])[key] ?? "").trim();
}

export function getWorkspaceToken() {
  return resolve(TOKEN_KEY);
}

export function isWorkspaceAccessEnabled() {
  return ["true", "1", "yes"].includes(resolve(ENABLED_KEY).toLowerCase());
}

/**
 * Adds `x-workspace-access-token` when a token is configured, leaving an
 * explicit one already on the request alone.
 *
 * The header form is used rather than Bearer because `Authorization` is the one
 * a browser or proxy is most likely to rewrite, and all three forms are
 * accepted by the middleware anyway.
 */
export function workspaceFetch(url, init = {}) {
  const token = getWorkspaceToken();

  if (token.length === 0) {
    return fetch(url, init);
  }

  const headers = new Headers(init.headers ?? {});

  if (!headers.has("x-workspace-access-token")) {
    headers.set("x-workspace-access-token", token);
  }

  return fetch(url, { ...init, headers });
}

/** Warns once when the guard is on but no token is readable — that combination
 * makes every workspace call fail with `503`, and the cause is not obvious from
 * the response. */
export function warnIfMisconfigured() {
  if (isWorkspaceAccessEnabled() && getWorkspaceToken().length === 0) {
    console.warn(
      `[workspace-fetch] ${ENABLED_KEY} 为真但读不到 ${TOKEN_KEY}；内部路由会返回 503。`
    );
    return false;
  }

  return true;
}

// Self-check: compare a plain fetch with a token-carrying one.
if (
  process.argv[1] &&
  import.meta.url.endsWith(path.basename(process.argv[1]))
) {
  const target = process.argv[2] ?? "http://localhost:3000/workspace";
  const token = getWorkspaceToken();

  console.log(`目标      ${target}`);
  console.log(`守卫开关  ${isWorkspaceAccessEnabled() ? "已启用" : "未启用"}`);
  console.log(
    `令牌      ${token.length > 0 ? `已读到（${token.length} 字符）` : "未配置"}`
  );

  const plain = await fetch(target).then(
    (r) => r.status,
    () => "连接失败"
  );
  const withToken = await workspaceFetch(target).then(
    (r) => r.status,
    () => "连接失败"
  );

  console.log(`裸 fetch  ${plain}`);
  console.log(`带令牌    ${withToken}`);

  if (isWorkspaceAccessEnabled() && plain === 200) {
    console.log(
      "\n注意：守卫已启用，但未带令牌的请求仍返回 200 —— 守卫没有生效。"
    );
  }
}
